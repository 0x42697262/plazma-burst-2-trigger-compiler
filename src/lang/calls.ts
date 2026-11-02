import type { Expression, SourceFile, Statement } from './ast.ts';

function expressionCalls(expression: Expression | null, found: Set<string>): void {
  if (!expression) return;
  switch (expression.kind) {
    case 'call':
      found.add(expression.callee);
      for (const argument of expression.args) expressionCalls(argument, found);
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
