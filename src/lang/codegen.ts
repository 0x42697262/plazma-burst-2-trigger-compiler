import { OPCODE } from '../opcodes/constants.ts';
import { opcodeByName, opcodeByNumber } from '../opcodes/table.ts';
import { labelOperand, literal, textOperand, variable } from '../compiler/ir.ts';
import type { Condition, ExportedVariable, Instruction, Module, ObjectDeclaration, Operand, SourceLocation, TimerSpec, Value } from '../compiler/ir.ts';
import type { Opcode } from '../opcodes/table.ts';
import { takesVariableName } from '../opcodes/table.ts';
import { LOOSE_VALUE_KINDS } from '../opcodes/keys.ts';
import { objectKind } from '../objects/objects.ts';
import { OBJECT_PARAM_KINDS } from '../objects/keys.ts';
import type { Names } from '../compiler/names.ts';
import { CompileError } from '../compiler/names.ts';
import type { Declaration, Expression, Location, ObjectTree, SourceFile, Statement, TemplatePart } from './ast.ts';
import { SourceError } from './lexer.ts';
import { editorTurnsIntoNumber } from '../program/editor-text.ts';
import {
  ADDRESS_NAME, ARITHMETIC, ELEMENT_OPEN, BUILTIN, COMPARISONS, EMPTY_TEXT, EVENT, FALSE_TEXT, HIDDEN, LABEL, SPLIT_EVERY_CHARACTER, STACK_POINTER, TRUE_TEXT, NUMBER_TEXT_MARK, TEXT_CONSTANT,
  WHOLE_NUMBER, DEFAULT_SYNC_MODE, SIDE, TRIGGER_KIND, ARRAY_INDEX_PLACEHOLDER, COLOR_KIND, KEY_SEPARATOR,
} from './keys.ts';
import type { BinaryOperator } from './keys.ts';
import { ACTION_ARGUMENTS, DEFAULT_SAY_COLOR, SAY_ARGUMENTS, SYNC_ARGUMENTS, UNLIMITED_TIMER_CALLS } from './constants.ts';
import {
  ELEMENT_END, Frame, arrayLengthName, elementName, elementOpening, functionReturnName, parameterName, stackOpening,
} from './symbols.ts';
import type { FunctionInfo, SymbolEntry } from './symbols.ts';
import { TEXT } from './text.ts';
import { callGraph, reachable, usedFunctions, writtenNames } from './calls.ts';

export type GenerateOptions = { protectNumberText: boolean; directIndex: boolean; compileTimeFunctions?: ReadonlySet<string> };

const DEFAULT_GENERATE: GenerateOptions = Object.freeze({ protectNumberText: true, directIndex: false });

type ObjectSelection = { keys: string[]; choices: { parts: string[]; operand: Operand }[] };

const NEGATED: Readonly<Record<string, Condition>> = { '==': 'ne', '!=': 'eq', '<': 'ge', '<=': 'gt', '>': 'le', '>=': 'lt' };
const DIRECT: Readonly<Record<string, Condition>> = { '==': 'eq', '!=': 'ne', '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge' };
const VALUE_BUILTINS: ReadonlySet<string> = new Set([
  BUILTIN.len, BUILTIN.contains, BUILTIN.random, BUILTIN.floor, BUILTIN.round, BUILTIN.slot, BUILTIN.initiator, BUILTIN.name, BUILTIN.time,
  BUILTIN.number, BUILTIN.text, BUILTIN.charAt, BUILTIN.drop, BUILTIN.chatText, BUILTIN.talker, BUILTIN.talkerName, BUILTIN.team, BUILTIN.pop,
]);
const SYNC_MODES: Readonly<Record<string, number>> = {
  replace: OPCODE.syncReplace, default: OPCODE.syncDefault, max: OPCODE.syncMax, min: OPCODE.syncMin, longest: OPCODE.syncLongest,
};
const VOID_BUILTINS: ReadonlySet<string> = new Set([BUILTIN.say, BUILTIN.push, BUILTIN.action, BUILTIN.sync, BUILTIN.clear]);
const BUILTIN_ARITY: Readonly<Record<string, number>> = {
  len: 1, contains: 2, random: 1, floor: 1, round: 1, slot: 0, initiator: 0, name: 1, time: 0, number: 1, text: 1, push: 2, charAt: 2, drop: 2, chatText: 0, talker: 0, talkerName: 0, team: 1, clear: 1, pop: 1,
};

const fail = (location: Location, message: string): never => {
  throw new SourceError(location.line, message, location.file);
};

const isLiteralExpression = (expression: Expression): boolean =>
  expression.kind === 'number' || expression.kind === 'boolean' || expression.kind === 'named'
  || (expression.kind === 'string' && expression.parts.every((part) => part.kind === 'text'));

const literalText = (expression: Expression): string => {
  switch (expression.kind) {
    case 'number':
    case 'named':
      return expression.text;
    case 'boolean':
      return expression.value ? TRUE_TEXT : FALSE_TEXT;
    case 'string':
      return expression.parts.map((part) => (part.kind === 'text' ? part.text : EMPTY_TEXT)).join(EMPTY_TEXT);
    default:
      return EMPTY_TEXT;
  }
};

const negateLiteral = (text: string): string => String(-parseFloat(text));

function hasCall(expression: Expression): boolean {
  switch (expression.kind) {
    case 'call':
      return !VALUE_BUILTINS.has(expression.callee) || expression.callee === BUILTIN.pop || expression.args.some(hasCall);
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

const NUMERIC_BUILTINS: ReadonlySet<string> = new Set([
  BUILTIN.len, BUILTIN.contains, BUILTIN.random, BUILTIN.floor, BUILTIN.round, BUILTIN.slot, BUILTIN.initiator, BUILTIN.time, BUILTIN.number,
  BUILTIN.talker, BUILTIN.team,
]);

function isNumeric(expression: Expression): boolean {
  switch (expression.kind) {
    case 'number':
    case 'boolean':
      return true;
    case 'unary':
      return true;
    case 'binary':
      return ARITHMETIC.has(expression.operator) || COMPARISONS.has(expression.operator) || expression.operator === '&&' || expression.operator === '||';
    case 'call':
      return NUMERIC_BUILTINS.has(expression.callee);
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

function depthOf(tree: readonly ObjectTree[]): number {
  const first = tree[0];
  return Array.isArray(first) ? 1 + depthOf(first) : 1;
}

function leavesOf(tree: readonly ObjectTree[], path: string[]): (readonly [string[], string])[] {
  return tree.flatMap((item, index) => (Array.isArray(item) ? leavesOf(item, [...path, String(index)]) : [[[...path, String(index)], item] as const]));
}

function hasBreak(statements: readonly Statement[]): boolean {
  return statements.some((statement) => {
    switch (statement.kind) {
      case 'break':
        return true;
      case 'if':
        return hasBreak(statement.then) || hasBreak(statement.otherwise ?? []);
      case 'block':
        return hasBreak(statement.body);
      case 'match':
        return statement.arms.some((arm) => hasBreak(arm.body));
      default:
        return false;
    }
  });
}

const isAlwaysTrue = (expression: Expression): boolean =>
  (expression.kind === 'boolean' && expression.value) || (expression.kind === 'number' && expression.text !== FALSE_TEXT);

function terminates(statements: readonly Statement[]): boolean {
  const last = statements[statements.length - 1];
  if (!last) return false;
  switch (last.kind) {
    case 'while':
      return isAlwaysTrue(last.condition) && !hasBreak(last.body);
    case 'return':
    case 'break':
    case 'continue':
      return true;
    case 'if':
      return last.otherwise !== null && terminates(last.then) && terminates(last.otherwise);
    case 'block':
      return terminates(last.body);
    case 'match':
      return last.arms.some((arm) => arm.patterns === null) && last.arms.every((arm) => terminates(arm.body));
    default:
      return false;
  }
}

export class Generator {
  private readonly names: Names;
  private readonly protectNumberText: boolean;
  private readonly directIndex: boolean;
  private readonly compileTimeFunctions: ReadonlySet<string>;
  private readonly textConstants = new Map<string, string>();
  private readonly globals = new Map<string, SymbolEntry>();
  private readonly functions = new Map<string, FunctionInfo>();
  private readonly timers: TimerSpec[] = [];
  private readonly objects: ObjectDeclaration[] = [];
  private readonly exports: ExportedVariable[] = [];
  private readonly reach: Map<string, Set<string>>;
  private readonly used: Set<string>;
  private readonly written: Set<string>;
  private readonly fixed = new Map<string, string>();
  private readonly warnings: string[] = [];
  private readonly usesStack: boolean;
  private instructions: Instruction[] = [];
  private frame: Frame;
  private location: SourceLocation = { line: 0 };

  constructor(names: Names, file: SourceFile, options: GenerateOptions) {
    this.names = names;
    this.protectNumberText = options.protectNumberText;
    this.directIndex = options.directIndex;
    this.compileTimeFunctions = options.compileTimeFunctions ?? new Set();
    this.frame = new Frame(names, EMPTY_TEXT, false);
    const graph = callGraph(file);
    this.reach = reachable(graph);
    this.used = usedFunctions(file, graph);
    this.written = writtenNames(file);
    this.usesStack = [...this.reach.entries()].some(([name, targets]) => targets.has(name));
  }

  private emit(instruction: Instruction): void {
    this.instructions.push(instruction);
  }

  private act(opcode: number, targetA: string | Operand, targetB: string | Operand = FALSE_TEXT): void {
    const operand = (value: string | Operand): Operand => (typeof value === 'string' ? textOperand(value) : value);
    if (this.protectNumberText && opcode === OPCODE.setVariable && typeof targetA === 'string' && typeof targetB === 'string' && editorTurnsIntoNumber(targetB)) {
      this.emit({ kind: 'action', opcode, targetA: operand(targetA), targetB: operand(NUMBER_TEXT_MARK + targetB), location: this.location });
      this.emit({ kind: 'action', opcode: OPCODE.removeStart, targetA: operand(String(NUMBER_TEXT_MARK.length)), targetB: operand(targetA), location: this.location });
      return;
    }
    this.emit({ kind: 'action', opcode, targetA: operand(targetA), targetB: operand(targetB), location: this.location });
  }

  private protectedValue(value: Value): Value {
    if (!this.protectNumberText || value.kind !== 'literal' || !editorTurnsIntoNumber(value.text)) return value;
    const temp = this.frame.temp();
    this.act(OPCODE.setVariable, temp, value.text);
    return variable(temp);
  }

  private label(label: string, entry = false): void {
    this.emit({ kind: 'label', label, entry });
  }

  private jump(label: string): void {
    this.emit({ kind: 'jump', label, location: this.location });
  }

  private branch(condition: Condition, left: Value, right: Value, label: string): void {
    this.emit({ kind: 'branch', condition, left: this.protectedValue(left), right: this.protectedValue(right), label, location: this.location });
  }

  private fresh(hint: string): string {
    return this.names.freshLabel(hint);
  }

  private at(location: Location): void {
    this.location = location.file === undefined ? { line: location.line } : { line: location.line, file: location.file };
  }

  generate(file: SourceFile): Module {
    this.collect(file);
    const startBlocks: Statement[][] = [];
    const sections: Instruction[][] = [];
    let hasJoin = false;
    let hasChat = false;
    for (const declaration of file.declarations) {
      if (declaration.kind === 'on' && declaration.event === EVENT.start) startBlocks.push(declaration.body);
      if (declaration.kind === 'on' && declaration.event === EVENT.join) hasJoin = true;
      if (declaration.kind === 'on' && declaration.event === EVENT.chat) hasChat = true;
    }
    sections.push(this.section(LABEL.start, EVENT.start, false, () => {
      for (const declaration of file.declarations) this.initializeGlobal(declaration);
      if (hasJoin) this.act(OPCODE.onPlayerJoin, labelOperand(LABEL.join));
      if (hasChat) this.act(OPCODE.setChatReceiver, labelOperand(LABEL.chat));
      for (const body of startBlocks) {
        const end = this.fresh(LABEL.end);
        this.frame.returnLabel = end;
        this.statements(body);
        this.label(end);
      }
      this.frame.returnLabel = null;
    }));
    for (const declaration of file.declarations) {
      if (declaration.kind === 'on' && declaration.event === EVENT.join) {
        sections.push(this.section(LABEL.join, EVENT.join, false, () => this.statements(declaration.body)));
      } else if (declaration.kind === 'on' && declaration.event === EVENT.chat) {
        sections.push(this.section(LABEL.chat, EVENT.chat, false, () => this.statements(declaration.body)));
      } else if (declaration.kind === 'every') {
        const handler = this.fresh(LABEL.every);
        const timer = this.fresh(LABEL.timer);
        this.timers.push({ label: timer, target: handler, enabled: true, maxCalls: UNLIMITED_TIMER_CALLS, delay: declaration.frames });
        sections.push(this.section(handler, handler, false, () => this.statements(declaration.body)));
      }
    }
    for (const declaration of file.declarations) {
      if (declaration.kind !== 'function') continue;
      const section = this.functionSection(declaration);
      if (this.used.has(declaration.name)) sections.push(section);
      else if (declaration.location.file === undefined && !this.compileTimeFunctions.has(declaration.name)) this.warnings.push(TEXT.where(declaration.location.line, TEXT.unusedFunction(declaration.name)));
    }
    this.setTextConstants(sections);
    return { instructions: sections.flat(), start: LABEL.start, timers: this.timers, warnings: this.warnings, objects: this.objects, exports: this.exports };
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
          if (!declaration.array && !declaration.exported && declaration.value && !this.written.has(declaration.name)) {
            const text = this.fixedInitializer(declaration.value);
            if (text !== null) this.fixed.set(this.names.variable(declaration.name), text);
          }
          if (declaration.exported) {
            const gameName = declaration.array ? elementName(this.names, declaration.name, ARRAY_INDEX_PLACEHOLDER) : this.names.variable(declaration.name);
            this.exports.push({ name: declaration.name, gameName, lengthName: declaration.array ? arrayLengthName(this.names, declaration.name) : null });
          }
          break;
        case 'const':
          define(declaration.name, declaration.location);
          if (!isLiteralExpression(declaration.value)) fail(declaration.location, TEXT.constantNeedsLiteral(declaration.name));
          this.globals.set(declaration.name, { kind: 'constant', text: literalText(declaration.value) });
          break;
        case 'object':
          define(declaration.name, declaration.location);
          if (declaration.tree === null) {
            this.globals.set(declaration.name, { kind: 'object', keyword: declaration.keyword, uid: declaration.uid });
            this.objects.push({ keyword: declaration.keyword, name: declaration.name, uid: declaration.uid, x: declaration.x, y: declaration.y });
          } else {
            this.globals.set(declaration.name, { kind: 'objectArray', keyword: declaration.keyword, tree: declaration.tree, dimensions: depthOf(declaration.tree) });
            for (const [path, uid] of leavesOf(declaration.tree, [])) {
              this.objects.push({ keyword: declaration.keyword, name: TEXT.elementPath(declaration.name, path), uid, x: null, y: null });
            }
          }
          break;
        case 'extern':
          define(declaration.name, declaration.location);
          this.globals.set(declaration.name, { kind: 'variable', name: declaration.hostName, constant: false });
          break;
        case 'function': {
          define(declaration.name, declaration.location);
          if (VALUE_BUILTINS.has(declaration.name) || VOID_BUILTINS.has(declaration.name)) fail(declaration.location, TEXT.reservedName(declaration.name));
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

  private textVariable(hint: string, text: string): string {
    const name = this.names.internalVariable(hint);
    this.textConstants.set(name, text);
    return name;
  }

  private setTextConstants(sections: Instruction[][]): void {
    if (this.textConstants.size === 0) return;
    const byLabel = new Map<string, Instruction[]>();
    for (const section of sections) if (section[0]?.kind === 'label') byLabel.set(section[0].label, section);
    const operandsOf = (instruction: Instruction): Operand[] => (instruction.kind === 'action' ? [instruction.targetA, instruction.targetB] : []);
    const needs = (section: Instruction[], seen: Set<Instruction[]>): boolean => {
      if (seen.has(section)) return false;
      seen.add(section);
      return section.some((instruction) => {
        if (instruction.kind === 'call') return needs(byLabel.get(instruction.label) ?? [], seen);
        return operandsOf(instruction).some((operand) => (operand.kind === 'text' ? this.textConstants.has(operand.text) : needs(byLabel.get(operand.label) ?? [], seen)));
      });
    };
    for (const section of sections) {
      const [head] = section;
      if (head?.kind !== 'label' || !head.entry || !needs(section, new Set())) continue;
      const located = section.find((instruction): instruction is Exclude<Instruction, { kind: 'label' }> => instruction.kind !== 'label');
      const location = located?.location ?? this.location;
      const sets: Instruction[] = [...this.textConstants].map(([name, text]) => ({ kind: 'action', opcode: OPCODE.setVariable, targetA: textOperand(name), targetB: textOperand(text), location }));
      section.splice(1, 0, ...sets);
    }
  }

  private buildName(destination: string, opening: string, indexName: string): void {
    if (!this.directIndex) {
      this.act(OPCODE.replaceInValue, destination, `${opening}${indexName}${ELEMENT_END}`);
      return;
    }
    this.act(OPCODE.setVariable, destination, opening);
    this.act(OPCODE.appendString, destination, indexName);
    this.act(OPCODE.appendString, destination, this.textVariable(TEXT_CONSTANT.elementEnd, ELEMENT_END));
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
      if (!terminates(declaration.body)) this.setReturnValue(null);
    }, declaration.exported);
  }

  private setReturnValue(value: Expression | null): void {
    const info = this.functions.get(this.frame.key) as FunctionInfo;
    if (value) this.into(value, info.returnVariable);
    else this.act(OPCODE.setVariable, info.returnVariable, EMPTY_TEXT);
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
    if (entry.kind === 'object' || entry.kind === 'objectArray') return fail(location, TEXT.objectAsValue(name));
    return entry.name;
  }

  private arrayOf(name: string, location: Location): Extract<SymbolEntry, { kind: 'array' }> {
    const entry = this.lookup(name, location);
    if (entry.kind === 'objectArray') return fail(location, TEXT.objectAsValue(name));
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
          const text = initial && !this.written.has(statement.name) ? this.fixedInitializer(initial) : null;
          if (text !== null) this.fixed.set(name, text);
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
        if (!this.frame.isFunction) {
          if (statement.value) fail(statement.location, TEXT.returnValueInBlock);
          if (this.frame.returnLabel !== null) this.jump(this.frame.returnLabel);
          else this.emit({ kind: 'return', location: this.location });
          break;
        }
        this.setReturnValue(statement.value);
        this.emit({ kind: 'return', location: this.location });
        break;
      case 'wait':
        this.wait(statement);
        break;
      case 'match':
        this.matchStatement(statement);
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

  private matchStatement(statement: Extract<Statement, { kind: 'match' }>): void {
    const subject = this.stableValue(statement.subject, false);
    const end = this.fresh(LABEL.end);
    const seen = new Set<string>();
    const labels = statement.arms.map(() => this.fresh(LABEL.arm));
    let fallback = end;
    statement.arms.forEach((arm, index) => {
      const label = labels[index] ?? end;
      if (arm.patterns === null) {
        if (index !== statement.arms.length - 1) fail(arm.location, TEXT.matchDefaultLast);
        fallback = label;
        return;
      }
      for (const pattern of arm.patterns) {
        const text = this.compileTimeText(pattern) ?? fail(pattern.location, TEXT.matchPattern);
        if (seen.has(text)) fail(pattern.location, TEXT.matchDuplicate(text));
        seen.add(text);
        this.at(pattern.location);
        this.branch('eq', subject, literal(text), label);
      }
    });
    this.at(statement.location);
    this.jump(fallback);
    statement.arms.forEach((arm, index) => {
      this.label(labels[index] ?? end);
      this.statements(arm.body);
      if (!terminates(arm.body)) this.jump(end);
    });
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
    if (!Number.isInteger(delay) || delay <= 0) fail(statement.location, TEXT.waitDelay);
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
    const fixedIndex = this.staticIndex(target.index);
    if (fixedIndex !== null) {
      const element = elementName(this.names, array.base, fixedIndex);
      const elementExpression: Expression = { kind: 'index', array: target.array, index: target.index, location };
      const value: Expression = statement.operator
        ? { kind: 'binary', operator: statement.operator, left: elementExpression, right: statement.value, location }
        : statement.value;
      const work = this.workTarget(element, this.readsArrayByVariable(value, target.array) || hasCall(value));
      this.into(value, work);
      if (work !== element) this.act(OPCODE.copyVariable, element, work);
      return;
    }
    const indexName = this.plainIndex(this.stableVariable(target.index, hasCall(statement.value)));
    const address = this.frame.temp();
    this.buildName(address, elementOpening(this.names, array.base), indexName);
    if (!statement.operator) {
      this.act(OPCODE.storeIndirect, address, this.variableValue(statement.value));
      return;
    }
    const current = this.frame.temp();
    this.act(OPCODE.loadIndirect, current, address);
    if (statement.operator === '..') {
      this.act(OPCODE.appendString, current, this.variableValue(statement.value));
    } else {
      if (statement.operator === '*' || statement.operator === '/') this.act(OPCODE.addValue, current, FALSE_TEXT);
      this.applyArithmetic(statement.operator, current, this.value(statement.value));
    }
    this.act(OPCODE.storeIndirect, address, current);
  }

  private stableVariable(expression: Expression, laterHasCall: boolean): string {
    const value = this.stableValue(expression, laterHasCall);
    return this.asVariable(value);
  }

  private staticIndex(index: Expression): string | null {
    return this.compileTimeText(index);
  }

  private readsArrayByVariable(expression: Expression, array: string): boolean {
    switch (expression.kind) {
      case 'index':
        return (expression.array === array && this.staticIndex(expression.index) === null) || this.readsArrayByVariable(expression.index, array);
      case 'call':
        return expression.args.some((argument) => this.readsArrayByVariable(argument, array));
      case 'unary':
        return this.readsArrayByVariable(expression.operand, array);
      case 'binary':
        return this.readsArrayByVariable(expression.left, array) || this.readsArrayByVariable(expression.right, array);
      case 'string':
        return expression.parts.some((part) => part.kind === 'expression' && this.readsArrayByVariable(part.expression, array));
      default:
        return false;
    }
  }

  private plainIndex(name: string): string {
    if (this.directIndex || !name.includes(ELEMENT_OPEN)) return name;
    const temp = this.frame.temp();
    this.act(OPCODE.copyVariable, temp, name);
    return temp;
  }

  private addressOf(base: string, index: Expression): string {
    const indexName = this.plainIndex(this.variableValue(index));
    const address = this.frame.temp();
    this.buildName(address, elementOpening(this.names, base), indexName);
    return address;
  }

  private value(expression: Expression): Value {
    return this.protectedValue(this.plainValue(expression));
  }

  private plainValue(expression: Expression): Value {
    this.at(expression.location);
    if (isLiteralExpression(expression)) return literal(literalText(expression));
    switch (expression.kind) {
      case 'name': {
        const entry = this.lookup(expression.name, expression.location);
        if (entry.kind === 'constant') return literal(entry.text);
        if (entry.kind === 'array') return fail(expression.location, TEXT.arrayAsValue(expression.name));
        if (entry.kind === 'object' || entry.kind === 'objectArray') return fail(expression.location, TEXT.objectAsValue(expression.name));
        return variable(entry.name);
      }
      case 'index': {
        if (expression.more) fail(expression.location, TEXT.oneIndex(expression.array));
        const array = this.arrayOf(expression.array, expression.location);
        const fixedIndex = this.staticIndex(expression.index);
        if (fixedIndex !== null) return variable(elementName(this.names, array.base, fixedIndex));
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
      case 'index': {
        const fixedIndex = this.staticIndex(expression.index);
        if (fixedIndex !== null) {
          const entry = this.frame.lookup(expression.array) ?? this.globals.get(expression.array);
          if (entry?.kind === 'array' && elementName(this.names, entry.base, fixedIndex) === name) return true;
        }
        return this.mentions(expression.index, name);
      }
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
        if (expression.more) fail(expression.location, TEXT.oneIndex(expression.array));
        const array = this.arrayOf(expression.array, expression.location);
        if (this.staticIndex(expression.index) !== null) {
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
          if (!isNumeric(expression.operand)) this.act(OPCODE.addValue, destination, FALSE_TEXT);
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
    if ((operator === '*' || operator === '/') && !isNumeric(left)) this.act(OPCODE.addValue, work, FALSE_TEXT);
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
          this.act(OPCODE.addValue, negated, FALSE_TEXT);
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
    const risky = merged.some(hasCall) || rest.some((part) => this.mentions(part, destination)) || (!startsWithDestination && this.mentions(first, destination));
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

  private constantTruth(expression: Expression): boolean | null {
    if (isLiteralExpression(expression)) {
      const text = literalText(expression);
      return text !== FALSE_TEXT && text !== EMPTY_TEXT;
    }
    if (expression.kind === 'unary' && expression.operator === '!') {
      const inner = this.constantTruth(expression.operand);
      return inner === null ? null : !inner;
    }
    if (expression.kind === 'binary' && (expression.operator === '&&' || expression.operator === '||')) {
      const left = this.constantTruth(expression.left);
      const right = this.constantTruth(expression.right);
      if (left === null || right === null) return null;
      return expression.operator === '&&' ? left && right : left || right;
    }
    return null;
  }

  private booleanInto(expression: Expression, destination: string): void {
    const known = this.constantTruth(expression);
    if (known !== null) {
      this.act(OPCODE.setVariable, destination, known ? TRUE_TEXT : FALSE_TEXT);
      return;
    }
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
        const objectCount = this.objectArrayLength(target);
        if (objectCount !== null) {
          this.act(OPCODE.setVariable, destination, String(objectCount));
          return;
        }
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
        if (!isNumeric(first())) this.act(OPCODE.addValue, destination, FALSE_TEXT);
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
        const countExpression = this.argument(expression, 1);
        const countText = this.compileTimeText(countExpression);
        if (countText === null || !WHOLE_NUMBER.test(countText)) return fail(countExpression.location, TEXT.dropCount);
        const count = { text: countText };
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
      case BUILTIN.pop: {
        const target = first();
        if (target.kind !== 'name') return fail(expression.location, TEXT.notArray(EMPTY_TEXT));
        const array = this.arrayOf(target.name, target.location);
        const address = this.frame.temp();
        this.act(OPCODE.addValue, array.length, negateLiteral(TRUE_TEXT));
        this.buildName(address, elementOpening(this.names, array.base), array.length);
        this.act(OPCODE.loadIndirect, destination, address);
        return;
      }
      case BUILTIN.chatText:
        this.act(OPCODE.chatInput, destination);
        return;
      case BUILTIN.talker:
        this.act(OPCODE.talkerSlot, destination);
        return;
      case BUILTIN.talkerName:
        this.act(OPCODE.talkerName, destination);
        return;
      case BUILTIN.team: {
        const slot = this.value(first());
        if (slot.kind === 'literal') this.act(OPCODE.teamBySlot, destination, slot.text);
        else this.act(OPCODE.teamBySlotVariable, destination, slot.name);
        return;
      }
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
    this.buildName(address, stackOpening(this.names), pointer);
    this.act(OPCODE.storeIndirect, address, name);
    this.act(OPCODE.addValue, pointer, TRUE_TEXT);
  }

  private pop(name: string): void {
    const pointer = this.names.internalVariable(STACK_POINTER);
    const address = this.names.internalVariable(ADDRESS_NAME);
    this.act(OPCODE.addValue, pointer, negateLiteral(TRUE_TEXT));
    this.buildName(address, stackOpening(this.names), pointer);
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
        this.buildName(address, elementOpening(this.names, array.base), array.length);
        this.act(OPCODE.storeIndirect, address, source);
        this.act(OPCODE.addValue, array.length, TRUE_TEXT);
        return;
      }
      case BUILTIN.action:
        this.rawAction(expression);
        return;
      case BUILTIN.sync:
        this.sync(expression);
        return;
      case BUILTIN.clear: {
        this.checkArity(expression, BUILTIN_ARITY.clear ?? 0);
        const target = this.argument(expression, 0);
        if (target.kind !== 'name') return fail(expression.location, TEXT.notArray(EMPTY_TEXT));
        this.act(OPCODE.setVariable, this.arrayOf(target.name, target.location).length, FALSE_TEXT);
        return;
      }
      default:
        return;
    }
  }

  private sync(expression: Extract<Expression, { kind: 'call' }>): void {
    const count = expression.args.length;
    if (count < SYNC_ARGUMENTS.min || count > SYNC_ARGUMENTS.max) {
      fail(expression.location, TEXT.argumentRange(expression.callee, SYNC_ARGUMENTS.min, SYNC_ARGUMENTS.max, count));
    }
    const target = this.argument(expression, 0);
    const modeExpression = expression.args[1];
    const mode = modeExpression ? this.compileTimeText(modeExpression) : DEFAULT_SYNC_MODE;
    const opcode = mode !== null && Object.hasOwn(SYNC_MODES, mode) ? SYNC_MODES[mode] : undefined;
    if (opcode === undefined) return fail(modeExpression?.location ?? expression.location, TEXT.syncMode(Object.keys(SYNC_MODES)));
    let name: string | null = null;
    if (target.kind === 'name') {
      const entry = this.lookup(target.name, target.location);
      name = entry.kind === 'variable' ? entry.name : null;
    } else if (target.kind === 'index') {
      const fixedIndex = this.staticIndex(target.index);
      name = fixedIndex === null ? null : elementName(this.names, this.arrayOf(target.array, target.location).base, fixedIndex);
    }
    if (name === null) return fail(target.location, TEXT.syncTarget);
    this.act(opcode, name);
  }

  private say(expression: Extract<Expression, { kind: 'call' }>): void {
    const count = expression.args.length;
    if (count < SAY_ARGUMENTS.min || count > SAY_ARGUMENTS.max) {
      fail(expression.location, TEXT.argumentRange(expression.callee, SAY_ARGUMENTS.min, SAY_ARGUMENTS.max, count));
    }
    const colorExpression = expression.args[1];
    if (colorExpression?.kind === 'named' && colorExpression.paramKind !== COLOR_KIND) {
      fail(colorExpression.location, TEXT.wrongValueGroup(OPCODE.showText, SIDE.b, COLOR_KIND, colorExpression.group));
    }
    const color = colorExpression ? this.compileTimeText(colorExpression) ?? fail(colorExpression.location, TEXT.sayColor) : DEFAULT_SAY_COLOR;
    const message = this.argument(expression, 0);
    const inline = this.inlineTemplate(message);
    this.act(OPCODE.showText, inline ?? this.variableValue(message), color);
  }

  private compileTimeText(expression: Expression): string | null {
    if (isLiteralExpression(expression)) return literalText(expression);
    if (expression.kind !== 'name') return null;
    const entry = this.lookup(expression.name, expression.location);
    if (entry.kind === 'constant') return entry.text;
    return entry.kind === 'variable' ? this.fixed.get(entry.name) ?? null : null;
  }

  private fixedInitializer(expression: Expression): string | null {
    if (isLiteralExpression(expression)) return literalText(expression);
    if (expression.kind !== 'name') return null;
    const entry = this.frame.lookup(expression.name) ?? this.globals.get(expression.name);
    if (entry?.kind === 'constant') return entry.text;
    return entry?.kind === 'variable' ? this.fixed.get(entry.name) ?? null : null;
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
      if (entry.kind === 'array' || entry.kind === 'object' || entry.kind === 'objectArray') return null;
      text += entry.kind === 'constant' ? entry.text : entry.name;
    }
    return text;
  }

  private rawOperand(expression: Expression | undefined, opcode: Opcode, side: string): Operand {
    if (!expression) return textOperand(FALSE_TEXT);
    const kind = side === SIDE.a ? opcode.paramA : opcode.paramB;
    const expectsObject = OBJECT_PARAM_KINDS.has(kind);
    if (expression.kind === 'reference') {
      if (!this.functions.has(expression.name)) fail(expression.location, TEXT.unknownFunction(expression.name));
      if (kind !== TRIGGER_KIND) fail(expression.location, TEXT.referenceNotTrigger(opcode.number, side, kind));
      return labelOperand(expression.name);
    }
    if (expression.kind === 'named' && expression.paramKind !== kind && (expectsObject || !LOOSE_VALUE_KINDS.has(kind))) {
      fail(expression.location, TEXT.wrongValueGroup(opcode.number, side, kind, expression.group));
    }
    if (isLiteralExpression(expression)) return textOperand(literalText(expression));
    if (expression.kind === 'name') {
      const entry = this.lookup(expression.name, expression.location);
      if (entry.kind === 'object') {
        const declared = objectKind(entry.keyword)?.paramKind;
        if (declared !== kind) fail(expression.location, TEXT.wrongObject(opcode.number, side, kind, expression.name, entry.keyword));
        return textOperand(entry.uid);
      }
      if (entry.kind === 'constant') return textOperand(entry.text);
      if (entry.kind === 'objectArray') return fail(expression.location, TEXT.objectIndexCount(expression.name, entry.dimensions, 0));
      if (expectsObject) return fail(expression.location, TEXT.needsObject(opcode.number, side, kind));
      if (entry.kind === 'array') return textOperand(entry.length);
      if (takesVariableName(opcode, side)) return textOperand(entry.name);
      const fixedText = this.fixed.get(entry.name);
      if (fixedText !== undefined) return textOperand(fixedText);
      if (!LOOSE_VALUE_KINDS.has(kind)) return fail(expression.location, TEXT.needsFixedValue(opcode.number, side, kind, expression.name));
      this.warnings.push(TEXT.where(expression.location.line, TEXT.passesName(opcode.number, side, expression.name), expression.location.file));
      return textOperand(entry.name);
    }
    if (expectsObject) return fail(expression.location, TEXT.needsObject(opcode.number, side, kind));
    const inline = this.inlineTemplate(expression);
    if (inline !== null) return textOperand(inline);
    if (takesVariableName(opcode, side)) return textOperand(this.variableValue(expression));
    return fail(expression.location, TEXT.literalOnly(BUILTIN.action));
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
    const sides = [SIDE.a, SIDE.b];
    const selections = sides.map((side, position) => this.objectSelection(expression.args[position + 1], opcode, side));
    if (selections.every((selection) => selection === null)) {
      this.act(opcode.number, this.rawOperand(expression.args[1], opcode, SIDE.a), this.rawOperand(expression.args[2], opcode, SIDE.b));
      return;
    }
    const choices = sides.map((side, position) => {
      const selection = selections[position];
      if (selection) return selection.choices;
      return [{ parts: [] as string[], operand: this.rawOperand(expression.args[position + 1], opcode, side) }];
    });
    const keys = selections.flatMap((selection) => selection?.keys ?? []);
    let key: string | null = keys[0] ?? null;
    if (keys.length > 1) {
      key = this.frame.temp();
      if (this.directIndex) {
        const separator = this.textVariable(TEXT_CONSTANT.keySeparator, KEY_SEPARATOR);
        this.act(OPCODE.copyVariable, key, keys[0] ?? EMPTY_TEXT);
        for (const part of keys.slice(1)) {
          this.act(OPCODE.appendString, key, separator);
          this.act(OPCODE.appendString, key, part);
        }
      } else {
        this.act(OPCODE.replaceInValue, key, keys.join(KEY_SEPARATOR));
      }
    }
    for (const first of choices[0] ?? []) {
      for (const second of choices[1] ?? []) {
        if (key !== null) this.act(OPCODE.skipIfNotEqualValue, key, [...first.parts, ...second.parts].join(KEY_SEPARATOR));
        this.act(opcode.number, first.operand, second.operand);
      }
    }
  }

  private objectArrayLength(target: Expression): number | null {
    const name = target.kind === 'name' || target.kind === 'index' ? (target.kind === 'name' ? target.name : target.array) : null;
    const entry = name === null ? null : this.frame.lookup(name) ?? this.globals.get(name);
    if (entry?.kind !== 'objectArray') return null;
    let tree: ObjectTree = entry.tree;
    const indexes = target.kind === 'index' ? [target.index, ...(target.more ?? [])] : [];
    for (const index of indexes) {
      const text = this.compileTimeText(index) ?? fail(index.location, TEXT.objectLengthIndex(name ?? EMPTY_TEXT));
      const next: ObjectTree | undefined = Array.isArray(tree) ? tree[Number(text)] : undefined;
      if (next === undefined || !Array.isArray(next) || String(Number(text)) !== text) return fail(index.location, TEXT.objectIndexRange(name ?? EMPTY_TEXT, text));
      tree = next;
    }
    return Array.isArray(tree) ? tree.length : 0;
  }

  private objectSelection(argument: Expression | undefined, opcode: Opcode, side: string): ObjectSelection | null {
    if (argument?.kind !== 'index') return null;
    const entry = this.lookup(argument.array, argument.location);
    if (entry.kind !== 'objectArray') return null;
    const kind = side === SIDE.a ? opcode.paramA : opcode.paramB;
    if (objectKind(entry.keyword)?.paramKind !== kind) fail(argument.location, TEXT.wrongObject(opcode.number, side, kind, argument.array, entry.keyword));
    const indexes = [argument.index, ...(argument.more ?? [])];
    if (indexes.length !== entry.dimensions) fail(argument.location, TEXT.objectIndexCount(argument.array, entry.dimensions, indexes.length));
    const keys: string[] = [];
    const fixed = indexes.map((index) => {
      const text = this.compileTimeText(index);
      if (text === null) keys.push(this.variableValue(index));
      return text;
    });
    const choices: { parts: string[]; operand: Operand }[] = [];
    const walk = (tree: readonly ObjectTree[], depth: number, parts: string[]): void => {
      const wanted = fixed[depth];
      tree.forEach((item, index) => {
        const text = String(index);
        if (wanted !== null && wanted !== undefined && wanted !== text) return;
        const nextParts = wanted === null ? [...parts, text] : parts;
        if (Array.isArray(item)) walk(item, depth + 1, nextParts);
        else choices.push({ parts: nextParts, operand: textOperand(item) });
      });
    };
    walk(entry.tree, 0, []);
    if (choices.length === 0) fail(argument.location, TEXT.objectIndexRange(argument.array, TEXT.indexList(fixed)));
    return { keys, choices };
  }
}

export function generate(file: SourceFile, names: Names, options: GenerateOptions = DEFAULT_GENERATE): Module {
  try {
    return new Generator(names, file, options).generate(file);
  } catch (error) {
    if (error instanceof SourceError) throw new CompileError(TEXT.where(error.line, error.message, error.file));
    throw error;
  }
}
