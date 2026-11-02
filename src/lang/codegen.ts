import { OPCODE } from '../opcodes/constants.ts';
import { opcodeByName, opcodeByNumber } from '../opcodes/table.ts';
import { labelOperand, literal, textOperand, variable } from '../compiler/ir.ts';
import type { Condition, Instruction, Module, Operand, SourceLocation, TimerSpec, Value } from '../compiler/ir.ts';
import type { Names } from '../compiler/names.ts';
import { CompileError } from '../compiler/names.ts';
import type { Declaration, Expression, Location, SourceFile, Statement, TemplatePart } from './ast.ts';
import { SourceError } from './lexer.ts';
import {
  ADDRESS_NAME, ARITHMETIC, BUILTIN, COMPARISONS, EMPTY_TEXT, EVENT, FALSE_TEXT, HIDDEN, LABEL, NEGATIVE, SPLIT_EVERY_CHARACTER, STACK_POINTER, TRUE_TEXT,
  WHOLE_NUMBER,
} from './keys.ts';
import type { BinaryOperator } from './keys.ts';
import { ACTION_ARGUMENTS, DEFAULT_SAY_COLOR, SAY_ARGUMENTS, UNLIMITED_TIMER_CALLS } from './constants.ts';
import {
  Frame, arrayLengthName, elementName, functionReturnName, parameterName, stackElementName,
} from './symbols.ts';
import type { FunctionInfo, SymbolEntry } from './symbols.ts';
import { TEXT } from './text.ts';
import { callGraph, reachable } from './calls.ts';

const NEGATED: Readonly<Record<string, Condition>> = { '==': 'ne', '!=': 'eq', '<': 'ge', '<=': 'gt', '>': 'le', '>=': 'lt' };
const DIRECT: Readonly<Record<string, Condition>> = { '==': 'eq', '!=': 'ne', '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge' };
const VALUE_BUILTINS: ReadonlySet<string> = new Set([
  BUILTIN.len, BUILTIN.contains, BUILTIN.random, BUILTIN.floor, BUILTIN.round, BUILTIN.slot, BUILTIN.initiator, BUILTIN.name, BUILTIN.time,
  BUILTIN.number, BUILTIN.text, BUILTIN.charAt, BUILTIN.drop,
]);
const VOID_BUILTINS: ReadonlySet<string> = new Set([BUILTIN.say, BUILTIN.push, BUILTIN.action]);
const BUILTIN_ARITY: Readonly<Record<string, number>> = {
  len: 1, contains: 2, random: 1, floor: 1, round: 1, slot: 0, initiator: 0, name: 1, time: 0, number: 1, text: 1, push: 2, charAt: 2, drop: 2,
};

const fail = (location: Location, message: string): never => {
  throw new SourceError(location.line, message);
};

const isLiteralExpression = (expression: Expression): boolean =>
  expression.kind === 'number' || expression.kind === 'boolean' || (expression.kind === 'string' && expression.parts.every((part) => part.kind === 'text'));

const literalText = (expression: Expression): string => {
  switch (expression.kind) {
    case 'number':
      return expression.text;
    case 'boolean':
      return expression.value ? TRUE_TEXT : FALSE_TEXT;
    case 'string':
      return expression.parts.map((part) => (part.kind === 'text' ? part.text : EMPTY_TEXT)).join(EMPTY_TEXT);
    default:
      return EMPTY_TEXT;
  }
};

const negateLiteral = (text: string): string => (text.startsWith(NEGATIVE) ? text.slice(NEGATIVE.length) : NEGATIVE + text);

const normalizeIndex = (text: string): string => {
  const number = Number(text);
  return text.trim() !== EMPTY_TEXT && Number.isFinite(number) ? String(number) : text;
};

function hasCall(expression: Expression): boolean {
  switch (expression.kind) {
    case 'call':
      return !VALUE_BUILTINS.has(expression.callee) || expression.args.some(hasCall);
    case 'index':
      return hasCall(expression.index);
    case 'unary':
      return hasCall(expression.operand);
    case 'binary':
      return hasCall(expression.left) || hasCall(expression.right);
    case 'string':
      return expression.parts.some((part) => part.kind === 'expression' && hasCall(part.expression));
    default:
      return false;
  }
}

function flattenConcat(expression: Expression): Expression[] {
  if (expression.kind === 'binary' && expression.operator === '..') return [...flattenConcat(expression.left), ...flattenConcat(expression.right)];
  if (expression.kind === 'string' && expression.parts.some((part) => part.kind === 'expression')) {
    return expression.parts.map((part: TemplatePart): Expression =>
      (part.kind === 'text' ? { kind: 'string', parts: [part], location: expression.location } : part.expression));
  }
  return [expression];
}

function terminates(statements: readonly Statement[]): boolean {
  const last = statements[statements.length - 1];
  if (!last) return false;
  switch (last.kind) {
    case 'return':
    case 'break':
    case 'continue':
      return true;
    case 'if':
      return last.otherwise !== null && terminates(last.then) && terminates(last.otherwise);
    case 'block':
      return terminates(last.body);
    default:
      return false;
  }
}

export class Generator {
  private readonly names: Names;
  private readonly globals = new Map<string, SymbolEntry>();
  private readonly functions = new Map<string, FunctionInfo>();
  private readonly timers: TimerSpec[] = [];
  private readonly reach: Map<string, Set<string>>;
  private readonly usesStack: boolean;
  private instructions: Instruction[] = [];
  private frame: Frame;
  private location: SourceLocation = { line: 0 };

  constructor(names: Names, file: SourceFile) {
    this.names = names;
    this.frame = new Frame(names, EMPTY_TEXT, false);
    this.reach = reachable(callGraph(file));
    this.usesStack = [...this.reach.entries()].some(([name, targets]) => targets.has(name));
  }

  private emit(instruction: Instruction): void {
    this.instructions.push(instruction);
  }

  private act(opcode: number, targetA: string | Operand, targetB: string | Operand = FALSE_TEXT): void {
    const operand = (value: string | Operand): Operand => (typeof value === 'string' ? textOperand(value) : value);
    this.emit({ kind: 'action', opcode, targetA: operand(targetA), targetB: operand(targetB), location: this.location });
  }

  private label(label: string, entry = false): void {
    this.emit({ kind: 'label', label, entry });
  }

  private jump(label: string): void {
    this.emit({ kind: 'jump', label, location: this.location });
  }

  private branch(condition: Condition, left: Value, right: Value, label: string): void {
    this.emit({ kind: 'branch', condition, left, right, label, location: this.location });
  }

  private fresh(hint: string): string {
    return this.names.freshLabel(hint);
  }

  private at(location: Location): void {
    this.location = { line: location.line };
  }

  generate(file: SourceFile): Module {
    this.collect(file);
    const startBody: Statement[] = [];
    const sections: Instruction[][] = [];
    let hasJoin = false;
    for (const declaration of file.declarations) {
      if (declaration.kind === 'on' && declaration.event === EVENT.start) startBody.push(...declaration.body);
      if (declaration.kind === 'on' && declaration.event === EVENT.join) hasJoin = true;
    }
    sections.push(this.section(LABEL.start, EVENT.start, false, () => {
      for (const declaration of file.declarations) this.initializeGlobal(declaration);
      if (hasJoin) this.act(OPCODE.onPlayerJoin, labelOperand(LABEL.join));
      this.statements(startBody);
    }));
    for (const declaration of file.declarations) {
      if (declaration.kind === 'on' && declaration.event === EVENT.join) {
        sections.push(this.section(LABEL.join, EVENT.join, false, () => this.statements(declaration.body)));
      } else if (declaration.kind === 'every') {
        const handler = this.fresh(LABEL.every);
        const timer = this.fresh(LABEL.timer);
        this.timers.push({ label: timer, target: handler, enabled: true, maxCalls: UNLIMITED_TIMER_CALLS, delay: declaration.frames });
        sections.push(this.section(handler, handler, false, () => this.statements(declaration.body)));
      }
    }
    for (const declaration of file.declarations) {
      if (declaration.kind === 'function') sections.push(this.functionSection(declaration));
    }
    return { instructions: sections.flat(), start: LABEL.start, timers: this.timers };
  }

  private collect(file: SourceFile): void {
    const events = new Set<string>();
    const define = (name: string, location: Location): void => {
      if (this.globals.has(name) || this.functions.has(name)) fail(location, TEXT.duplicate(name));
    };
    for (const declaration of file.declarations) {
      switch (declaration.kind) {
        case 'var':
          define(declaration.name, declaration.location);
          this.globals.set(declaration.name, declaration.array
            ? { kind: 'array', base: declaration.name, length: arrayLengthName(this.names, declaration.name) }
            : { kind: 'variable', name: this.names.variable(declaration.name), constant: false });
          break;
        case 'const':
          define(declaration.name, declaration.location);
          if (!isLiteralExpression(declaration.value)) fail(declaration.location, TEXT.constantNeedsLiteral(declaration.name));
          this.globals.set(declaration.name, { kind: 'constant', text: literalText(declaration.value) });
          break;
        case 'extern':
          define(declaration.name, declaration.location);
          this.globals.set(declaration.name, { kind: 'variable', name: declaration.hostName, constant: false });
          break;
        case 'function': {
          define(declaration.name, declaration.location);
          const seen = new Set<string>();
          for (const parameter of declaration.params) {
            if (seen.has(parameter)) fail(declaration.location, TEXT.duplicate(parameter));
            seen.add(parameter);
          }
          this.functions.set(declaration.name, {
            name: declaration.name,
            params: declaration.params,
            paramVariables: declaration.params.map((parameter) => parameterName(this.names, declaration.name, parameter)),
            returnVariable: functionReturnName(this.names, declaration.name),
            exported: declaration.exported,
          });
          break;
        }
        case 'on':
          if (events.has(declaration.event) && declaration.event !== EVENT.start) fail(declaration.location, TEXT.duplicateEvent(declaration.event));
          events.add(declaration.event);
          break;
        case 'every':
          if (!Number.isInteger(declaration.frames) || declaration.frames <= 0) fail(declaration.location, TEXT.everyDelay);
          break;
      }
    }
  }

  private section(label: string, key: string, isFunction: boolean, body: () => void, entry = true): Instruction[] {
    this.instructions = [];
    this.frame = new Frame(this.names, key, isFunction);
    this.label(label, entry);
    if (this.usesStack && entry) this.act(OPCODE.setIfUndefined, this.names.internalVariable(STACK_POINTER), FALSE_TEXT);
    body();
    this.emit({ kind: 'return', location: this.location });
    return this.instructions;
  }

  private functionSection(declaration: Extract<Declaration, { kind: 'function' }>): Instruction[] {
    const info = this.functions.get(declaration.name) as FunctionInfo;
    this.at(declaration.location);
    return this.section(declaration.name, declaration.name, true, () => {
      info.params.forEach((parameter, index) => this.frame.bindParameter(parameter, info.paramVariables[index] ?? EMPTY_TEXT));
      this.statements(declaration.body);
    }, declaration.exported);
  }

  private initializeGlobal(declaration: Declaration): void {
    if (declaration.kind !== 'var') return;
    this.at(declaration.location);
    const entry = this.globals.get(declaration.name);
    if (entry?.kind === 'array') this.act(OPCODE.setVariable, entry.length, FALSE_TEXT);
    else if (entry?.kind === 'variable' && declaration.value) this.statementScope(() => this.into(declaration.value as Expression, entry.name));
  }

  private lookup(name: string, location: Location): SymbolEntry {
    return this.frame.lookup(name) ?? this.globals.get(name) ?? fail(location, TEXT.unknownVariable(name));
  }

  private variableOf(name: string, location: Location): string {
    const entry = this.lookup(name, location);
    if (entry.kind === 'constant') return fail(location, TEXT.constantAssignment(name));
    if (entry.kind === 'array') return fail(location, TEXT.arrayAsValue(name));
    return entry.name;
  }

  private arrayOf(name: string, location: Location): Extract<SymbolEntry, { kind: 'array' }> {
    const entry = this.lookup(name, location);
    return entry.kind === 'array' ? entry : fail(location, TEXT.notArray(name));
  }

  private statementScope(body: () => void): void {
    const mark = this.frame.tempMark;
    body();
    this.frame.release(mark);
  }

  private statements(statements: readonly Statement[]): void {
    this.frame.enter();
    for (const statement of statements) this.statementScope(() => this.statement(statement));
    this.frame.leave();
  }

  private statement(statement: Statement): void {
    this.at(statement.location);
    switch (statement.kind) {
      case 'let': {
        const initial = statement.value;
        if (initial && this.namesIn(initial).has(statement.name)) {
          const value = this.stableValue(initial, true);
          this.move(value, this.frame.declare(statement.name));
        } else {
          const name = this.frame.declare(statement.name);
          if (initial) this.into(initial, name);
        }
        break;
      }
      case 'assign':
        this.assign(statement);
        break;
      case 'expression':
        if (statement.expression.kind === 'call') this.call(statement.expression, false);
        else this.value(statement.expression);
        break;
      case 'block':
        this.statements(statement.body);
        break;
      case 'if':
        this.ifStatement(statement);
        break;
      case 'while': {
        const head = this.fresh(LABEL.head);
        const end = this.fresh(LABEL.end);
        this.label(head);
        this.condition(statement.condition, false, end);
        this.loopBody(statement.body, end, head);
        if (!terminates(statement.body)) this.jump(head);
        this.label(end);
        break;
      }
      case 'for':
        this.forStatement(statement);
        break;
      case 'forPlayer':
        this.forPlayer(statement);
        break;
      case 'break':
      case 'continue': {
        const loop = this.frame.loops[this.frame.loops.length - 1] ?? fail(statement.location, TEXT.outsideLoop(statement.kind));
        this.jump(statement.kind === 'break' ? loop.breakLabel : loop.continueLabel);
        break;
      }
      case 'return':
        if (statement.value) {
          if (!this.frame.isFunction) fail(statement.location, TEXT.valueOfVoid(this.frame.key));
          const info = this.functions.get(this.frame.key) as FunctionInfo;
          this.into(statement.value, info.returnVariable);
        }
        this.emit({ kind: 'return', location: this.location });
        break;
      case 'wait':
        this.wait(statement);
        break;
    }
  }

  private namesIn(expression: Expression, found = new Set<string>()): Set<string> {
    switch (expression.kind) {
      case 'name':
        found.add(expression.name);
        break;
      case 'index':
        found.add(expression.array);
        this.namesIn(expression.index, found);
        break;
      case 'call':
        for (const argument of expression.args) this.namesIn(argument, found);
        break;
      case 'unary':
        this.namesIn(expression.operand, found);
        break;
      case 'binary':
        this.namesIn(expression.left, found);
        this.namesIn(expression.right, found);
        break;
      case 'string':
        for (const part of expression.parts) if (part.kind === 'expression') this.namesIn(part.expression, found);
        break;
      default:
        break;
    }
    return found;
  }

  private loopBody(body: readonly Statement[], breakLabel: string, continueLabel: string): void {
    this.frame.loops.push({ breakLabel, continueLabel });
    this.statements(body);
    this.frame.loops.pop();
  }

  private ifStatement(statement: Extract<Statement, { kind: 'if' }>): void {
    const end = this.fresh(LABEL.end);
    const otherwise = statement.otherwise;
    const elseLabel = otherwise ? this.fresh(LABEL.else) : end;
    this.condition(statement.condition, false, elseLabel);
    this.statements(statement.then);
    if (otherwise) {
      if (!terminates(statement.then)) this.jump(end);
      this.label(elseLabel);
      this.statements(otherwise);
    }
    this.label(end);
  }

  private forStatement(statement: Extract<Statement, { kind: 'for' }>): void {
    this.frame.enter();
    if (statement.init) this.statementScope(() => this.statement(statement.init as Statement));
    const head = this.fresh(LABEL.head);
    const next = this.fresh(LABEL.next);
    const end = this.fresh(LABEL.end);
    this.label(head);
    if (statement.condition) this.statementScope(() => this.condition(statement.condition as Expression, false, end));
    this.loopBody(statement.body, end, next);
    this.label(next);
    if (statement.step) this.statementScope(() => this.statement(statement.step as Statement));
    this.at(statement.location);
    this.jump(head);
    this.label(end);
    this.frame.leave();
  }

  private forPlayer(statement: Extract<Statement, { kind: 'forPlayer' }>): void {
    const list = this.frame.hiddenVariable(HIDDEN.players);
    const count = this.frame.hiddenVariable(HIDDEN.count);
    const index = this.frame.hiddenVariable(HIDDEN.index);
    this.act(OPCODE.activeSlots, list);
    this.act(OPCODE.setVariable, count, EMPTY_TEXT);
    this.act(OPCODE.appendString, count, list);
    this.act(OPCODE.copyVariable, list, count);
    this.act(OPCODE.splitByValue, list, SPLIT_EVERY_CHARACTER);
    this.act(OPCODE.length, count, list);
    this.act(OPCODE.setVariable, index, FALSE_TEXT);
    const head = this.fresh(LABEL.head);
    const next = this.fresh(LABEL.next);
    const end = this.fresh(LABEL.end);
    this.label(head);
    this.branch('ge', variable(index), variable(count), end);
    this.frame.enter();
    const slot = this.frame.declare(statement.name);
    this.act(OPCODE.copyVariable, slot, list);
    this.act(OPCODE.arrayGetIndex, slot, index);
    this.loopBody(statement.body, end, next);
    this.frame.leave();
    this.label(next);
    this.at(statement.location);
    this.act(OPCODE.addValue, index, TRUE_TEXT);
    this.jump(head);
    this.label(end);
  }

  private wait(statement: Extract<Statement, { kind: 'wait' }>): void {
    if (this.frame.isFunction) fail(statement.location, TEXT.waitInFunction);
    const frames = statement.frames;
    const delay = frames.kind === 'number' ? Number(frames.text) : NaN;
    if (!Number.isInteger(delay) || delay <= 0) fail(statement.location, TEXT.everyDelay);
    const continuation = this.fresh(LABEL.wait);
    const timer = this.fresh(LABEL.timer);
    const timerUid = this.names.triggerUid(timer);
    this.timers.push({ label: timer, target: continuation, enabled: false, maxCalls: UNLIMITED_TIMER_CALLS, delay });
    this.act(OPCODE.resetTimer, timerUid);
    this.act(OPCODE.enableTimer, timerUid);
    this.emit({ kind: 'return', location: this.location });
    this.label(continuation, true);
    this.act(OPCODE.disableTimer, timerUid);
  }

  private assign(statement: Extract<Statement, { kind: 'assign' }>): void {
    const target = statement.target;
    const location = statement.location;
    if (target.kind === 'name') {
      const name = this.variableOf(target.name, location);
      const value: Expression = statement.operator
        ? { kind: 'binary', operator: statement.operator, left: { kind: 'name', name: target.name, location }, right: statement.value, location }
        : statement.value;
      this.into(value, name);
      return;
    }
    const array = this.arrayOf(target.array, location);
    const element: Expression = { kind: 'index', array: target.array, index: target.index, location };
    const value: Expression = statement.operator
      ? { kind: 'binary', operator: statement.operator, left: element, right: statement.value, location }
      : statement.value;
    const source = this.variableValue(value);
    this.storeElement(array.base, target.index, source);
  }

  private storeElement(base: string, index: Expression, source: string): void {
    if (isLiteralExpression(index)) {
      this.act(OPCODE.copyVariable, elementName(this.names, base, normalizeIndex(literalText(index))), source);
      return;
    }
    const address = this.addressOf(base, index);
    this.act(OPCODE.storeIndirect, address, source);
  }

  private addressOf(base: string, index: Expression): string {
    const indexName = this.variableValue(index);
    const address = this.frame.temp();
    this.act(OPCODE.replaceInValue, address, elementName(this.names, base, indexName));
    return address;
  }

  private value(expression: Expression): Value {
    this.at(expression.location);
    if (isLiteralExpression(expression)) return literal(literalText(expression));
    switch (expression.kind) {
      case 'name': {
        const entry = this.lookup(expression.name, expression.location);
        if (entry.kind === 'constant') return literal(entry.text);
        if (entry.kind === 'array') return fail(expression.location, TEXT.arrayAsValue(expression.name));
        return variable(entry.name);
      }
      case 'index': {
        const array = this.arrayOf(expression.array, expression.location);
        if (isLiteralExpression(expression.index)) return variable(elementName(this.names, array.base, normalizeIndex(literalText(expression.index))));
        break;
      }
      case 'call':
        if (!VALUE_BUILTINS.has(expression.callee)) {
          const result = this.call(expression, true);
          return result === null ? fail(expression.location, TEXT.valueOfVoid(expression.callee)) : variable(result);
        }
        break;
      case 'reference':
        return fail(expression.location, TEXT.labelArgument);
      default:
        break;
    }
    const temp = this.frame.temp();
    this.into(expression, temp);
    return variable(temp);
  }

  private variableValue(expression: Expression): string {
    const value = this.value(expression);
    if (value.kind === 'variable') return value.name;
    const temp = this.frame.temp();
    this.act(OPCODE.setVariable, temp, value.text);
    return temp;
  }

  private stableValue(expression: Expression, laterHasCall: boolean): Value {
    const value = this.value(expression);
    if (value.kind === 'literal' || !laterHasCall || this.frame.liveTemps().includes(value.name)) return value;
    const temp = this.frame.temp();
    this.act(OPCODE.copyVariable, temp, value.name);
    return variable(temp);
  }

  private move(value: Value, destination: string): void {
    if (value.kind === 'literal') this.act(OPCODE.setVariable, destination, value.text);
    else if (value.name !== destination) this.act(OPCODE.copyVariable, destination, value.name);
  }

  private mentions(expression: Expression, name: string): boolean {
    switch (expression.kind) {
      case 'name': {
        const entry = this.frame.lookup(expression.name) ?? this.globals.get(expression.name);
        return entry?.kind === 'variable' && entry.name === name;
      }
      case 'index':
        return this.mentions(expression.index, name);
      case 'call':
        return expression.args.some((argument) => this.mentions(argument, name));
      case 'unary':
        return this.mentions(expression.operand, name);
      case 'binary':
        return this.mentions(expression.left, name) || this.mentions(expression.right, name);
      case 'string':
        return expression.parts.some((part) => part.kind === 'expression' && this.mentions(part.expression, name));
      default:
        return false;
    }
  }

  private into(expression: Expression, destination: string): void {
    this.at(expression.location);
    if (isLiteralExpression(expression)) {
      this.act(OPCODE.setVariable, destination, literalText(expression));
      return;
    }
    switch (expression.kind) {
      case 'name':
        this.move(this.value(expression), destination);
        return;
      case 'index': {
        const array = this.arrayOf(expression.array, expression.location);
        if (isLiteralExpression(expression.index)) {
          this.move(this.value(expression), destination);
          return;
        }
        const address = this.addressOf(array.base, expression.index);
        this.act(OPCODE.loadIndirect, destination, address);
        return;
      }
      case 'call':
        if (VALUE_BUILTINS.has(expression.callee)) this.builtinInto(expression, destination);
        else this.move(this.value(expression), destination);
        return;
      case 'string':
        this.concatInto(flattenConcat(expression), destination);
        return;
      case 'unary':
        if (expression.operator === '-') {
          this.into(expression.operand, destination);
          this.act(OPCODE.negate, destination);
        } else {
          this.booleanInto(expression, destination);
        }
        return;
      case 'binary':
        if (expression.operator === '..') this.concatInto(flattenConcat(expression), destination);
        else if (ARITHMETIC.has(expression.operator)) this.arithmeticInto(expression.operator, expression.left, expression.right, destination);
        else if (COMPARISONS.has(expression.operator)) this.comparisonInto(expression, destination);
        else this.booleanInto(expression, destination);
        return;
      case 'reference':
        fail(expression.location, TEXT.labelArgument);
        return;
      default:
        return;
    }
  }

  private workTarget(destination: string, risky: boolean): string {
    return risky ? this.frame.temp() : destination;
  }

  private arithmeticInto(operator: BinaryOperator, left: Expression, right: Expression, destination: string): void {
    const work = this.workTarget(destination, this.mentions(right, destination) || hasCall(right));
    this.into(left, work);
    const value = this.value(right);
    this.applyArithmetic(operator, work, value);
    if (work !== destination) this.act(OPCODE.copyVariable, destination, work);
  }

  private applyArithmetic(operator: BinaryOperator, work: string, value: Value): void {
    const isLiteral = value.kind === 'literal';
    const text = value.kind === 'literal' ? value.text : value.name;
    switch (operator) {
      case '+':
        if (isLiteral) {
          this.act(OPCODE.addValue, work, text);
        } else {
          this.act(OPCODE.addValue, work, FALSE_TEXT);
          this.act(OPCODE.addVariable, work, text);
        }
        return;
      case '-':
        if (isLiteral) {
          this.act(OPCODE.addValue, work, negateLiteral(text));
        } else {
          const negated = this.frame.temp();
          this.act(OPCODE.copyVariable, negated, text);
          this.act(OPCODE.negate, negated);
          this.act(OPCODE.addValue, work, FALSE_TEXT);
          this.act(OPCODE.addVariable, work, negated);
        }
        return;
      case '*':
        this.act(isLiteral ? OPCODE.multiplyValue : OPCODE.multiplyVariable, work, text);
        return;
      case '/':
        this.act(isLiteral ? OPCODE.divideValue : OPCODE.divideVariable, work, text);
        return;
      case '%':
        this.act(isLiteral ? OPCODE.moduloValue : OPCODE.moduloVariable, work, text);
        return;
      default:
        return;
    }
  }

  private concatInto(parts: Expression[], destination: string): void {
    const merged: Expression[] = [];
    for (const part of parts) {
      const previous = merged[merged.length - 1];
      if (previous && isLiteralExpression(previous) && isLiteralExpression(part) && previous.kind === 'string' && part.kind === 'string') {
        merged[merged.length - 1] = { kind: 'string', parts: [{ kind: 'text', text: literalText(previous) + literalText(part) }], location: previous.location };
      } else {
        merged.push(part);
      }
    }
    const [first, ...rest] = merged;
    if (!first) {
      this.act(OPCODE.setVariable, destination, EMPTY_TEXT);
      return;
    }
    const startsWithDestination = first.kind === 'name' && this.mentions(first, destination);
    const risky = rest.some((part) => this.mentions(part, destination) || hasCall(part)) || (!startsWithDestination && this.mentions(first, destination));
    const work = this.workTarget(destination, risky);
    let remaining = merged;
    if (startsWithDestination && work === destination) {
      remaining = rest;
    } else if (isLiteralExpression(first) && !WHOLE_NUMBER.test(literalText(first))) {
      this.act(OPCODE.setVariable, work, literalText(first));
      remaining = rest;
    } else {
      this.act(OPCODE.setVariable, work, EMPTY_TEXT);
    }
    for (const part of remaining) {
      if (isLiteralExpression(part)) {
        const text = literalText(part);
        if (text === EMPTY_TEXT) continue;
        const temp = this.frame.temp();
        this.act(OPCODE.setVariable, temp, text);
        this.act(OPCODE.appendString, work, temp);
      } else {
        this.act(OPCODE.appendString, work, this.variableValue(part));
      }
    }
    if (work !== destination) this.act(OPCODE.copyVariable, destination, work);
  }

  private comparisonInto(expression: Extract<Expression, { kind: 'binary' }>, destination: string): void {
    const risky = this.mentions(expression, destination);
    const work = this.workTarget(destination, risky);
    const left = this.stableValue(expression.left, hasCall(expression.right));
    const right = this.value(expression.right);
    const condition = DIRECT[expression.operator] as Condition;
    this.skipBoolean(condition, left, right, work);
    if (work !== destination) this.act(OPCODE.copyVariable, destination, work);
  }

  private asVariable(value: Value): string {
    if (value.kind === 'variable') return value.name;
    const temp = this.frame.temp();
    this.act(OPCODE.setVariable, temp, value.text);
    return temp;
  }

  private skipBoolean(condition: Condition, left: Value, right: Value, work: string): void {
    if (condition === 'eq' || condition === 'ne') {
      const literalSide = left.kind === 'literal' ? left : right.kind === 'literal' ? right : null;
      const variableSide = left.kind === 'variable' ? left : right.kind === 'variable' ? right : null;
      if (literalSide?.kind === 'literal' && variableSide?.kind === 'variable') {
        this.act(OPCODE.setVariable, work, condition === 'eq' ? FALSE_TEXT : TRUE_TEXT);
        this.act(OPCODE.skipIfNotEqualValue, variableSide.name, literalSide.text);
        this.act(OPCODE.setVariable, work, condition === 'eq' ? TRUE_TEXT : FALSE_TEXT);
        return;
      }
    }
    const leftName = this.asVariable(left);
    const rightName = this.asVariable(right);
    const skip: Record<Condition, readonly [number, string, string]> = {
      eq: [OPCODE.skipIfEqual, TRUE_TEXT, FALSE_TEXT],
      ne: [OPCODE.skipIfEqual, FALSE_TEXT, TRUE_TEXT],
      lt: [OPCODE.skipIfLess, TRUE_TEXT, FALSE_TEXT],
      ge: [OPCODE.skipIfLess, FALSE_TEXT, TRUE_TEXT],
      gt: [OPCODE.skipIfGreater, TRUE_TEXT, FALSE_TEXT],
      le: [OPCODE.skipIfGreater, FALSE_TEXT, TRUE_TEXT],
    };
    const [opcode, whenSkipped, otherwise] = skip[condition];
    this.act(OPCODE.setVariable, work, whenSkipped);
    this.act(opcode, leftName, rightName);
    this.act(OPCODE.setVariable, work, otherwise);
  }

  private booleanInto(expression: Expression, destination: string): void {
    const falseLabel = this.fresh(LABEL.else);
    const end = this.fresh(LABEL.end);
    this.condition(expression, false, falseLabel);
    this.act(OPCODE.setVariable, destination, TRUE_TEXT);
    this.jump(end);
    this.label(falseLabel);
    this.act(OPCODE.setVariable, destination, FALSE_TEXT);
    this.label(end);
  }

  private condition(expression: Expression, jumpWhen: boolean, label: string): void {
    this.at(expression.location);
    if (expression.kind === 'boolean' || expression.kind === 'number') {
      const truthy = expression.kind === 'boolean' ? expression.value : expression.text !== FALSE_TEXT;
      if (truthy === jumpWhen) this.jump(label);
      return;
    }
    if (expression.kind === 'unary' && expression.operator === '!') {
      this.condition(expression.operand, !jumpWhen, label);
      return;
    }
    if (expression.kind === 'binary' && (expression.operator === '&&' || expression.operator === '||')) {
      const isAnd = expression.operator === '&&';
      if (isAnd !== jumpWhen) {
        this.condition(expression.left, jumpWhen, label);
        this.condition(expression.right, jumpWhen, label);
      } else {
        const skip = this.fresh(LABEL.skip);
        this.condition(expression.left, !jumpWhen, skip);
        this.condition(expression.right, jumpWhen, label);
        this.label(skip);
      }
      return;
    }
    if (expression.kind === 'binary' && COMPARISONS.has(expression.operator)) {
      const left = this.stableValue(expression.left, hasCall(expression.right));
      const right = this.value(expression.right);
      const condition = (jumpWhen ? DIRECT : NEGATED)[expression.operator] as Condition;
      this.branch(condition, left, right, label);
      return;
    }
    const value = this.value(expression);
    if (jumpWhen) {
      const skip = this.fresh(LABEL.skip);
      this.branch('eq', value, literal(FALSE_TEXT), skip);
      this.branch('eq', value, literal(EMPTY_TEXT), skip);
      this.jump(label);
      this.label(skip);
    } else {
      this.branch('eq', value, literal(FALSE_TEXT), label);
      this.branch('eq', value, literal(EMPTY_TEXT), label);
    }
  }

  private checkArity(expression: Extract<Expression, { kind: 'call' }>, expected: number): void {
    if (expression.args.length !== expected) fail(expression.location, TEXT.argumentCount(expression.callee, expected, expression.args.length));
  }

  private argument(expression: Extract<Expression, { kind: 'call' }>, index: number): Expression {
    return expression.args[index] as Expression;
  }

  private builtinInto(expression: Extract<Expression, { kind: 'call' }>, destination: string): void {
    const name = expression.callee;
    this.checkArity(expression, BUILTIN_ARITY[name] ?? 0);
    const first = (): Expression => this.argument(expression, 0);
    switch (name) {
      case BUILTIN.len: {
        const target = first();
        const entry = target.kind === 'name' ? this.lookup(target.name, target.location) : null;
        if (entry?.kind === 'array') {
          this.act(OPCODE.copyVariable, destination, entry.length);
          return;
        }
        const source = this.variableValue(target);
        const text = this.frame.temp();
        this.act(OPCODE.setVariable, text, EMPTY_TEXT);
        this.act(OPCODE.appendString, text, source);
        this.act(OPCODE.length, destination, text);
        return;
      }
      case BUILTIN.contains: {
        const haystack = this.stableValue(first(), hasCall(this.argument(expression, 1)));
        const needle = this.value(this.argument(expression, 1));
        const work = this.frame.temp();
        this.act(OPCODE.setVariable, work, EMPTY_TEXT);
        this.act(OPCODE.appendString, work, this.asVariable(haystack));
        if (needle.kind === 'literal') this.act(OPCODE.containsValue, work, needle.text);
        else this.act(OPCODE.containsVariable, work, needle.name);
        this.act(OPCODE.copyVariable, destination, work);
        return;
      }
      case BUILTIN.random: {
        const limit = this.value(first());
        if (limit.kind === 'literal') {
          this.act(OPCODE.randomInteger, destination, limit.text);
        } else {
          this.act(OPCODE.randomFloatVariable, destination, limit.name);
          this.act(OPCODE.floor, destination);
        }
        return;
      }
      case BUILTIN.floor:
      case BUILTIN.round:
        this.into(first(), destination);
        this.act(name === BUILTIN.floor ? OPCODE.floor : OPCODE.round, destination);
        return;
      case BUILTIN.number:
        this.into(first(), destination);
        this.act(OPCODE.addValue, destination, FALSE_TEXT);
        return;
      case BUILTIN.text: {
        const source = this.variableValue(first());
        const work = this.workTarget(destination, source === destination);
        this.act(OPCODE.setVariable, work, EMPTY_TEXT);
        this.act(OPCODE.appendString, work, source);
        if (work !== destination) this.act(OPCODE.copyVariable, destination, work);
        return;
      }
      case BUILTIN.charAt: {
        const source = this.stableValue(first(), hasCall(this.argument(expression, 1)));
        const index = this.value(this.argument(expression, 1));
        const work = this.frame.temp();
        this.act(OPCODE.setVariable, work, EMPTY_TEXT);
        this.act(OPCODE.appendString, work, this.asVariable(source));
        this.act(OPCODE.splitByValue, work, SPLIT_EVERY_CHARACTER);
        this.act(OPCODE.arrayGetIndex, work, index.kind === 'literal' ? index.text : index.name);
        this.act(OPCODE.copyVariable, destination, work);
        return;
      }
      case BUILTIN.drop: {
        const count = this.argument(expression, 1);
        if (count.kind !== 'number' || !WHOLE_NUMBER.test(count.text)) return fail(count.location, TEXT.dropCount);
        const source = this.variableValue(first());
        const work = this.frame.temp();
        this.act(OPCODE.setVariable, work, EMPTY_TEXT);
        this.act(OPCODE.appendString, work, source);
        this.act(OPCODE.removeStart, count.text, work);
        this.act(OPCODE.copyVariable, destination, work);
        return;
      }
      case BUILTIN.slot:
        this.act(OPCODE.currentPlayerSlot, destination);
        return;
      case BUILTIN.initiator:
        this.act(OPCODE.initiatorSlot, destination);
        return;
      case BUILTIN.time:
        this.act(OPCODE.timeSinceStart, destination);
        return;
      case BUILTIN.name: {
        const slot = this.value(first());
        if (slot.kind === 'literal') this.act(OPCODE.playerNameBySlot, destination, slot.text);
        else this.act(OPCODE.playerNameBySlotVariable, destination, slot.name);
        return;
      }
      default:
        return;
    }
  }

  private call(expression: Extract<Expression, { kind: 'call' }>, wantsValue: boolean): string | null {
    const name = expression.callee;
    this.at(expression.location);
    if (VALUE_BUILTINS.has(name)) {
      const temp = this.frame.temp();
      this.builtinInto(expression, temp);
      return temp;
    }
    if (VOID_BUILTINS.has(name)) {
      if (wantsValue) fail(expression.location, TEXT.valueOfVoid(name));
      this.voidBuiltin(expression);
      return null;
    }
    const info = this.functions.get(name) ?? fail(expression.location, TEXT.unknownFunction(name));
    this.checkArity(expression, info.params.length);
    const values = expression.args.map((argument, index) => {
      const laterHasCall = expression.args.slice(index + 1).some(hasCall);
      const value = this.stableValue(argument, laterHasCall);
      const clashes = value.kind === 'variable' && info.paramVariables.includes(value.name) && info.paramVariables[index] !== value.name;
      if (!clashes) return value;
      const temp = this.frame.temp();
      this.act(OPCODE.copyVariable, temp, value.name);
      return variable(temp);
    });
    const saved = this.needsSave(name) ? [...this.frame.frameVariables, ...this.frame.liveTemps()] : [];
    for (const name of saved) this.push(name);
    values.forEach((value, index) => this.move(value, info.paramVariables[index] ?? EMPTY_TEXT));
    this.emit({ kind: 'call', label: info.name, location: this.location });
    for (const name of [...saved].reverse()) this.pop(name);
    if (!wantsValue) return null;
    const result = this.frame.temp();
    this.act(OPCODE.copyVariable, result, info.returnVariable);
    return result;
  }

  private needsSave(callee: string): boolean {
    if (!this.frame.isFunction) return false;
    return callee === this.frame.key || (this.reach.get(callee)?.has(this.frame.key) ?? false);
  }

  private push(name: string): void {
    const pointer = this.names.internalVariable(STACK_POINTER);
    const address = this.names.internalVariable(ADDRESS_NAME);
    this.act(OPCODE.replaceInValue, address, stackElementName(this.names, pointer));
    this.act(OPCODE.storeIndirect, address, name);
    this.act(OPCODE.addValue, pointer, TRUE_TEXT);
  }

  private pop(name: string): void {
    const pointer = this.names.internalVariable(STACK_POINTER);
    const address = this.names.internalVariable(ADDRESS_NAME);
    this.act(OPCODE.addValue, pointer, negateLiteral(TRUE_TEXT));
    this.act(OPCODE.replaceInValue, address, stackElementName(this.names, pointer));
    this.act(OPCODE.loadIndirect, name, address);
  }

  private voidBuiltin(expression: Extract<Expression, { kind: 'call' }>): void {
    switch (expression.callee) {
      case BUILTIN.say:
        this.say(expression);
        return;
      case BUILTIN.push: {
        this.checkArity(expression, BUILTIN_ARITY.push ?? 0);
        const target = this.argument(expression, 0);
        if (target.kind !== 'name') return fail(expression.location, TEXT.notArray(EMPTY_TEXT));
        const array = this.arrayOf(target.name, target.location);
        const source = this.variableValue(this.argument(expression, 1));
        const address = this.frame.temp();
        this.act(OPCODE.replaceInValue, address, elementName(this.names, array.base, array.length));
        this.act(OPCODE.storeIndirect, address, source);
        this.act(OPCODE.addValue, array.length, TRUE_TEXT);
        return;
      }
      case BUILTIN.action:
        this.rawAction(expression);
        return;
      default:
        return;
    }
  }

  private say(expression: Extract<Expression, { kind: 'call' }>): void {
    const count = expression.args.length;
    if (count < SAY_ARGUMENTS.min || count > SAY_ARGUMENTS.max) {
      fail(expression.location, TEXT.argumentRange(expression.callee, SAY_ARGUMENTS.min, SAY_ARGUMENTS.max, count));
    }
    const colorExpression = expression.args[1];
    if (colorExpression && !isLiteralExpression(colorExpression)) fail(colorExpression.location, TEXT.sayColor);
    const color = colorExpression ? literalText(colorExpression) : DEFAULT_SAY_COLOR;
    const message = this.argument(expression, 0);
    const inline = this.inlineTemplate(message);
    this.act(OPCODE.showText, inline ?? this.variableValue(message), color);
  }

  private inlineTemplate(expression: Expression): string | null {
    if (expression.kind !== 'string') return null;
    let text = EMPTY_TEXT;
    for (const part of expression.parts) {
      if (part.kind === 'text') {
        text += part.text;
        continue;
      }
      const inner = part.expression;
      if (inner.kind !== 'name') return null;
      const entry = this.lookup(inner.name, inner.location);
      if (entry.kind === 'array') return null;
      text += entry.kind === 'constant' ? entry.text : entry.name;
    }
    return text;
  }

  private rawOperand(expression: Expression | undefined): Operand {
    if (!expression) return textOperand(FALSE_TEXT);
    if (expression.kind === 'reference') {
      if (!this.functions.has(expression.name)) fail(expression.location, TEXT.unknownFunction(expression.name));
      return labelOperand(expression.name);
    }
    if (isLiteralExpression(expression)) return textOperand(literalText(expression));
    if (expression.kind === 'name') {
      const entry = this.lookup(expression.name, expression.location);
      if (entry.kind === 'constant') return textOperand(entry.text);
      if (entry.kind === 'array') return textOperand(entry.length);
      return textOperand(entry.name);
    }
    const inline = this.inlineTemplate(expression);
    return inline === null ? fail(expression.location, TEXT.literalOnly(BUILTIN.action)) : textOperand(inline);
  }

  private rawAction(expression: Extract<Expression, { kind: 'call' }>): void {
    const count = expression.args.length;
    if (count < ACTION_ARGUMENTS.min || count > ACTION_ARGUMENTS.max) {
      fail(expression.location, TEXT.argumentRange(expression.callee, ACTION_ARGUMENTS.min, ACTION_ARGUMENTS.max, count));
    }
    const which = this.argument(expression, 0);
    const opcode = which.kind === 'number'
      ? opcodeByNumber(Number(which.text))
      : which.kind === 'name' ? opcodeByName(which.name) : isLiteralExpression(which) ? opcodeByName(literalText(which)) : null;
    if (!opcode) return fail(which.location, TEXT.unknownAction(which.kind === 'name' ? which.name : literalText(which)));
    this.act(opcode.number, this.rawOperand(expression.args[1]), this.rawOperand(expression.args[2]));
  }
}

export function generate(file: SourceFile, names: Names): Module {
  try {
    return new Generator(names, file).generate(file);
  } catch (error) {
    if (error instanceof SourceError) throw new CompileError(TEXT.where(error.line, error.message));
    throw error;
  }
}
