import type { Declaration, Expression, Location, SourceFile, Statement, TemplatePart } from './ast.ts';
import { SourceError } from './lexer.ts';
import { generate } from './codegen.ts';
import { compileModule, DEFAULT_OPTIONS } from '../compiler/compile.ts';
import { createNames, CompileError } from '../compiler/names.ts';
import { Simulation } from '../sim/simulator.ts';
import { COMPILE_TIME_ACTIONS } from '../opcodes/constants.ts';
import { BUILTIN, COMPILE_TIME_BUILTIN, COMPILE_TIME_PREFIX, COMPILE_TIME_RESULT, EMPTY_TEXT, EVENT } from './keys.ts';
import { COMPILE_TIME_MAX_STEPS, ENV_ARGUMENTS, SECRET_MIN_LENGTH } from './constants.ts';
import { TEXT } from './text.ts';
import { callGraph, reachable } from './calls.ts';

export type Secret = { name: string; text: string; location: Location };
export type Folded = { file: SourceFile; secrets: Secret[]; compileTimeFunctions: ReadonlySet<string> };
type Environment = Readonly<Record<string, string | undefined>>;

const PURE_BUILTINS: ReadonlySet<string> = new Set([
  BUILTIN.len, BUILTIN.contains, BUILTIN.floor, BUILTIN.round, BUILTIN.number, BUILTIN.text, BUILTIN.charAt, BUILTIN.drop,
  BUILTIN.sin, BUILTIN.cos, BUILTIN.asin, BUILTIN.acos, BUILTIN.atan2,
]);

const fail = (location: Location, message: string): never => {
  throw new SourceError(location.line, message, location.file);
};

const isLiteral = (expression: Expression): boolean =>
  expression.kind === 'number' || expression.kind === 'boolean' || expression.kind === 'named'
  || (expression.kind === 'string' && expression.parts.every((part) => part.kind === 'text'));

const literalOf = (value: unknown, location: Location, name: string): Expression => {
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'number', text: String(value), location };
  if (typeof value === 'string') return { kind: 'string', parts: [{ kind: 'text', text: value }], location };
  return fail(location, TEXT.compileTimeNoValue(name));
};

const textOf = (expression: Expression): string => {
  switch (expression.kind) {
    case 'number':
    case 'named':
      return expression.text;
    case 'boolean':
      return String(expression.value);
    case 'string':
      return expression.parts.map((part) => (part.kind === 'text' ? part.text : EMPTY_TEXT)).join(EMPTY_TEXT);
    default:
      return EMPTY_TEXT;
  }
};

const declarationName = (declaration: Declaration): string | null => {
  switch (declaration.kind) {
    case 'on':
    case 'every':
      return null;
    default:
      return declaration.name;
  }
};

const mapParts = (parts: readonly TemplatePart[], map: (expression: Expression) => Expression): TemplatePart[] =>
  parts.map((part) => (part.kind === 'text' ? part : { kind: 'expression', expression: map(part.expression) }));

const mapChildren = (expression: Expression, map: (expression: Expression) => Expression): Expression => {
  switch (expression.kind) {
    case 'string':
      return { ...expression, parts: mapParts(expression.parts, map) };
    case 'index':
      return { ...expression, index: map(expression.index), ...(expression.more ? { more: expression.more.map(map) } : {}) };
    case 'call':
      return { ...expression, args: expression.args.map(map) };
    case 'unary':
      return { ...expression, operand: map(expression.operand) };
    case 'binary':
      return { ...expression, left: map(expression.left), right: map(expression.right) };
    default:
      return expression;
  }
};

const childrenOf = (expression: Expression): Expression[] => {
  switch (expression.kind) {
    case 'string':
      return expression.parts.flatMap((part) => (part.kind === 'expression' ? [part.expression] : []));
    case 'index':
      return [expression.index, ...(expression.more ?? [])];
    case 'call':
      return expression.args;
    case 'unary':
      return [expression.operand];
    case 'binary':
      return [expression.left, expression.right];
    default:
      return [];
  }
};

const mapStatement = (statement: Statement, map: (expression: Expression) => Expression): Statement => {
  const block = (body: Statement[]): Statement[] => body.map((inner) => mapStatement(inner, map));
  switch (statement.kind) {
    case 'let':
      return { ...statement, value: statement.value === null ? null : map(statement.value) };
    case 'assign':
      return { ...statement, value: map(statement.value), target: statement.target.kind === 'index' ? { ...statement.target, index: map(statement.target.index) } : statement.target };
    case 'expression':
      return { ...statement, expression: map(statement.expression) };
    case 'if':
      return { ...statement, condition: map(statement.condition), then: block(statement.then), otherwise: statement.otherwise === null ? null : block(statement.otherwise) };
    case 'while':
      return { ...statement, condition: map(statement.condition), body: block(statement.body) };
    case 'for':
      return {
        ...statement, init: statement.init === null ? null : mapStatement(statement.init, map), condition: statement.condition === null ? null : map(statement.condition),
        step: statement.step === null ? null : mapStatement(statement.step, map), body: block(statement.body),
      };
    case 'forPlayer':
    case 'block':
      return { ...statement, body: block(statement.body) };
    case 'return':
      return { ...statement, value: statement.value === null ? null : map(statement.value) };
    case 'wait':
      return { ...statement, frames: map(statement.frames) };
    case 'match':
      return { ...statement, subject: map(statement.subject), arms: statement.arms.map((arm) => ({ ...arm, patterns: arm.patterns?.map(map) ?? null, body: block(arm.body) })) };
    default:
      return statement;
  }
};

export function foldConstants(file: SourceFile, environment: Environment): Folded {
  const functions = new Set(file.declarations.flatMap((declaration) => (declaration.kind === 'function' ? [declaration.name] : [])));
  const constants = new Map<string, Expression>();
  const tainted = new Set<string>();
  const secrets: Secret[] = [];
  const compileTimeFunctions = new Set<string>();
  const noteCalls = (expression: Expression): void => {
    if (expression.kind === 'call' && functions.has(expression.callee)) compileTimeFunctions.add(expression.callee);
    childrenOf(expression).forEach(noteCalls);
  };

  const mentionsTainted = (expression: Expression): boolean =>
    (expression.kind === 'name' && tainted.has(expression.name)) || childrenOf(expression).some(mentionsTainted);
  const declaredConstants = new Set(file.declarations.flatMap((declaration) => (declaration.kind === 'const' ? [declaration.name] : [])));
  const mentionsPending = (expression: Expression): boolean =>
    (expression.kind === 'name' && declaredConstants.has(expression.name) && !constants.has(expression.name)) || childrenOf(expression).some(mentionsPending);

  const computable = (expression: Expression): boolean => {
    if (isLiteral(expression)) return true;
    switch (expression.kind) {
      case 'name':
        return constants.has(expression.name);
      case 'call':
        return (functions.has(expression.callee) || PURE_BUILTINS.has(expression.callee)) && expression.args.every(computable);
      case 'string':
      case 'unary':
      case 'binary':
        return childrenOf(expression).every(computable);
      default:
        return false;
    }
  };

  const withEnvironment = (expression: Expression): Expression => {
    if (expression.kind === 'call' && expression.callee === COMPILE_TIME_BUILTIN.env) {
      const [argument, fallback] = expression.args;
      const isText = (part: Expression | undefined): part is Expression => part !== undefined && part.kind === 'string' && isLiteral(part);
      if (expression.args.length > ENV_ARGUMENTS || !isText(argument) || (fallback !== undefined && !isText(fallback))) return fail(expression.location, TEXT.envArgument);
      const name = textOf(argument);
      const value = environment[name] ?? (fallback === undefined ? undefined : textOf(fallback));
      if (value === undefined) return fail(expression.location, TEXT.envMissing(name));
      return { kind: 'string', parts: [{ kind: 'text', text: value }], location: expression.location };
    }
    return mapChildren(expression, withEnvironment);
  };

  const graph = callGraph(file);
  const reach = reachable(graph);
  const calledBy = (expression: Expression, found = new Set<string>()): Set<string> => {
    if (expression.kind === 'call' && functions.has(expression.callee)) {
      found.add(expression.callee);
      for (const callee of reach.get(expression.callee) ?? []) found.add(callee);
    }
    for (const child of childrenOf(expression)) calledBy(child, found);
    return found;
  };

  const evaluate = (expression: Expression, name: string): Expression => {
    const location = expression.location;
    noteCalls(expression);
    const starting = file.declarations.flatMap((declaration) => (declaration.kind === 'var' && declaration.value !== null && !mentionsPending(declaration.value) ? [declaration.value] : []));
    const needed = new Set([expression, ...starting].flatMap((part) => [...calledBy(part)]));
    const kept = file.declarations.flatMap((declaration): Declaration[] => {
      if (declaration.kind === 'on' || declaration.kind === 'every') return [];
      if (declaration.kind === 'function' && !needed.has(declaration.name)) return [];
      if (declaration.kind === 'var' && declaration.value !== null && mentionsPending(declaration.value)) return [{ ...declaration, value: null }];
      if (declaration.kind !== 'const') return [declaration];
      const known = constants.get(declaration.name);
      return known === undefined ? [] : [{ ...declaration, value: known }];
    });
    let result = COMPILE_TIME_RESULT;
    while (functions.has(result) || kept.some((declaration) => declarationName(declaration) === result)) result += COMPILE_TIME_RESULT;
    const program: SourceFile = {
      imports: [],
      declarations: [
        ...kept,
        { kind: 'var', name: result, array: false, value: null, exported: false, location },
        { kind: 'on', event: EVENT.start, location, body: [{ kind: 'assign', target: { kind: 'name', name: result }, operator: null, value: expression, location }] },
      ],
    };
    const names = createNames(COMPILE_TIME_PREFIX);
    let simulation: Simulation;
    try {
      const compiled = compileModule(generate(program, names, { protectNumberText: false, directIndex: false }), names, { ...DEFAULT_OPTIONS, loopGuard: null });
      simulation = new Simulation(compiled.program, { allowedActions: COMPILE_TIME_ACTIONS, maxSteps: COMPILE_TIME_MAX_STEPS });
      simulation.tick();
    } catch (error) {
      return fail(location, TEXT.compileTimeFailed(name, error instanceof Error ? error.message : String(error)));
    }
    const [problem] = simulation.errors;
    if (problem !== undefined) return fail(location, TEXT.compileTimeFailed(name, problem));
    return literalOf(simulation.variables[names.variable(result)], location, name);
  };

  const fold = (expression: Expression): Expression => {
    if (expression.kind === 'call' && expression.callee === COMPILE_TIME_BUILTIN.env) return fail(expression.location, TEXT.envOutsideConstant);
    if (!isLiteral(expression) && mentionsTainted(expression) && computable(expression)) {
      if (expression.kind === 'name') return constants.get(expression.name) ?? expression;
      return evaluate(expression, textOf(expression));
    }
    return mapChildren(expression, fold);
  };

  for (const declaration of file.declarations) {
    if (declaration.kind !== 'const') continue;
    const value = withEnvironment(declaration.value);
    let resolved = value;
    if (value.kind === 'name' && constants.has(value.name)) resolved = constants.get(value.name) ?? value;
    else if (!isLiteral(value)) resolved = evaluate(value, declaration.name);
    constants.set(declaration.name, resolved);
    if (declaration.secret || mentionsTainted(value)) tainted.add(declaration.name);
    if (declaration.secret) {
      const text = textOf(resolved);
      if (text.length < SECRET_MIN_LENGTH) fail(declaration.location, TEXT.secretTooShort(declaration.name, SECRET_MIN_LENGTH));
      secrets.push({ name: declaration.name, text, location: declaration.location });
    }
  }

  const declarations = file.declarations.map((declaration): Declaration => {
    switch (declaration.kind) {
      case 'const':
        return { ...declaration, value: constants.get(declaration.name) ?? declaration.value };
      case 'var':
        return { ...declaration, value: declaration.value === null ? null : fold(declaration.value) };
      case 'function':
      case 'on':
      case 'every':
        return { ...declaration, body: declaration.body.map((statement) => mapStatement(statement, fold)) };
      default:
        return declaration;
    }
  });
  for (const name of [...compileTimeFunctions]) for (const callee of reach.get(name) ?? []) compileTimeFunctions.add(callee);
  return { file: { ...file, declarations }, secrets, compileTimeFunctions };
}

export function checkSecrets(secrets: readonly Secret[], values: readonly { text: string; where: string }[]): void {
  for (const secret of secrets) {
    const leak = values.find((value) => value.text.includes(secret.text));
    if (leak) throw new CompileError(TEXT.where(secret.location.line, TEXT.secretLeak(secret.name, leak.where), secret.location.file));
  }
}
