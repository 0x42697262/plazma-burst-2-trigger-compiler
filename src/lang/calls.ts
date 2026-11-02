import type { Expression, SourceFile, Statement } from './ast.ts';
import { opcodeByName, opcodeByNumber, takesVariableName } from '../opcodes/table.ts';
import type { Opcode } from '../opcodes/table.ts';
import { SIDE_A } from '../opcodes/keys.ts';
import { ACTION_BUILTIN, SIDE_B } from './keys.ts';

function expressionCalls(expression: Expression | null, found: Set<string>): void {
  if (!expression) return;
  switch (expression.kind) {
    case 'call':
      found.add(expression.callee);
      for (const argument of expression.args) expressionCalls(argument, found);
      return;
    case 'reference':
      found.add(expression.name);
      return;
    case 'index':
      expressionCalls(expression.index, found);
      return;
    case 'unary':
      expressionCalls(expression.operand, found);
      return;
    case 'binary':
      expressionCalls(expression.left, found);
      expressionCalls(expression.right, found);
      return;
    case 'string':
      for (const part of expression.parts) if (part.kind === 'expression') expressionCalls(part.expression, found);
      return;
    default:
      return;
  }
}

function statementCalls(statements: readonly Statement[], found: Set<string>): void {
  for (const statement of statements) {
    switch (statement.kind) {
      case 'let':
      case 'return':
        expressionCalls(statement.value, found);
        break;
      case 'assign':
        expressionCalls(statement.value, found);
        if (statement.target.kind === 'index') expressionCalls(statement.target.index, found);
        break;
      case 'expression':
        expressionCalls(statement.expression, found);
        break;
      case 'if':
        expressionCalls(statement.condition, found);
        statementCalls(statement.then, found);
        statementCalls(statement.otherwise ?? [], found);
        break;
      case 'while':
        expressionCalls(statement.condition, found);
        statementCalls(statement.body, found);
        break;
      case 'for':
        statementCalls(statement.init ? [statement.init] : [], found);
        expressionCalls(statement.condition, found);
        statementCalls(statement.step ? [statement.step] : [], found);
        statementCalls(statement.body, found);
        break;
      case 'forPlayer':
      case 'block':
        statementCalls(statement.body, found);
        break;
      case 'match':
        expressionCalls(statement.subject, found);
        for (const arm of statement.arms) statementCalls(arm.body, found);
        break;
      case 'wait':
        expressionCalls(statement.frames, found);
        break;
      default:
        break;
    }
  }
}

export function callGraph(file: SourceFile): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const declaration of file.declarations) {
    if (declaration.kind !== 'function') continue;
    const found = new Set<string>();
    statementCalls(declaration.body, found);
    graph.set(declaration.name, found);
  }
  for (const callees of graph.values()) for (const callee of [...callees]) if (!graph.has(callee)) callees.delete(callee);
  return graph;
}

export function reachable(graph: ReadonlyMap<string, ReadonlySet<string>>): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const start of graph.keys()) {
    const seen = new Set<string>();
    const pending = [...(graph.get(start) ?? [])];
    while (pending.length > 0) {
      const next = pending.pop() as string;
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(...(graph.get(next) ?? []));
    }
    result.set(start, seen);
  }
  return result;
}

export function usedFunctions(file: SourceFile, graph: ReadonlyMap<string, ReadonlySet<string>>): Set<string> {
  const pending: string[] = [];
  for (const declaration of file.declarations) {
    const found = new Set<string>();
    if (declaration.kind === 'function' && declaration.exported) found.add(declaration.name);
    if (declaration.kind === 'on' || declaration.kind === 'every') statementCalls(declaration.body, found);
    if (declaration.kind === 'var') expressionCalls(declaration.value, found);
    pending.push(...found);
  }
  const used = new Set<string>();
  while (pending.length > 0) {
    const name = pending.pop() as string;
    if (used.has(name) || !graph.has(name)) continue;
    used.add(name);
    pending.push(...(graph.get(name) ?? []));
  }
  return used;
}

const opcodeOf = (expression: Expression | undefined): Opcode | null => {
  if (!expression) return null;
  if (expression.kind === 'number') return opcodeByNumber(Number(expression.text));
  if (expression.kind === 'name') return opcodeByName(expression.name);
  if (expression.kind === 'string' && expression.parts.every((part) => part.kind === 'text')) {
    return opcodeByName(expression.parts.map((part) => (part.kind === 'text' ? part.text : '')).join(''));
  }
  return null;
};

function expressionWrites(expression: Expression | null, found: Set<string>): void {
  if (!expression) return;
  switch (expression.kind) {
    case 'call': {
      if (expression.callee === ACTION_BUILTIN) {
        const opcode = opcodeOf(expression.args[0]);
        expression.args.slice(1).forEach((argument, index) => {
          const side = index === 0 ? SIDE_A : SIDE_B;
          if (argument.kind === 'name' && (opcode === null || takesVariableName(opcode, side))) found.add(argument.name);
        });
      }
      for (const argument of expression.args) expressionWrites(argument, found);
      return;
    }
    case 'index':
      expressionWrites(expression.index, found);
      return;
    case 'unary':
      expressionWrites(expression.operand, found);
      return;
    case 'binary':
      expressionWrites(expression.left, found);
      expressionWrites(expression.right, found);
      return;
    case 'string':
      for (const part of expression.parts) if (part.kind === 'expression') expressionWrites(part.expression, found);
      return;
    default:
      return;
  }
}

function statementWrites(statements: readonly Statement[], found: Set<string>): void {
  for (const statement of statements) {
    switch (statement.kind) {
      case 'assign':
        if (statement.target.kind === 'name') found.add(statement.target.name);
        else expressionWrites(statement.target.index, found);
        expressionWrites(statement.value, found);
        break;
      case 'let':
      case 'return':
        expressionWrites(statement.value, found);
        break;
      case 'expression':
        expressionWrites(statement.expression, found);
        break;
      case 'if':
        expressionWrites(statement.condition, found);
        statementWrites(statement.then, found);
        statementWrites(statement.otherwise ?? [], found);
        break;
      case 'while':
        expressionWrites(statement.condition, found);
        statementWrites(statement.body, found);
        break;
      case 'for':
        statementWrites(statement.init ? [statement.init] : [], found);
        expressionWrites(statement.condition, found);
        statementWrites(statement.step ? [statement.step] : [], found);
        statementWrites(statement.body, found);
        break;
      case 'forPlayer':
        found.add(statement.name);
        statementWrites(statement.body, found);
        break;
      case 'block':
        statementWrites(statement.body, found);
        break;
      case 'match':
        expressionWrites(statement.subject, found);
        for (const arm of statement.arms) statementWrites(arm.body, found);
        break;
      default:
        break;
    }
  }
}

export function writtenNames(file: SourceFile): Set<string> {
  const found = new Set<string>();
  for (const declaration of file.declarations) {
    if (declaration.kind === 'function') {
      for (const parameter of declaration.params) found.add(parameter);
      statementWrites(declaration.body, found);
    }
    if (declaration.kind === 'on' || declaration.kind === 'every') statementWrites(declaration.body, found);
    if (declaration.kind === 'var') expressionWrites(declaration.value, found);
  }
  return found;
}
