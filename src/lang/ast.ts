import type { BinaryOperator } from './keys.ts';

export type Location = { line: number; file?: string };

export type TemplatePart = { kind: 'text'; text: string } | { kind: 'expression'; expression: Expression };

export type Expression =
  | { kind: 'number'; text: string; location: Location }
  | { kind: 'string'; parts: TemplatePart[]; location: Location }
  | { kind: 'boolean'; value: boolean; location: Location }
  | { kind: 'named'; group: string; member: string; paramKind: string; text: string; location: Location }
  | { kind: 'name'; name: string; location: Location }
  | { kind: 'index'; array: string; index: Expression; more?: Expression[]; location: Location }
  | { kind: 'call'; callee: string; args: Expression[]; location: Location }
  | { kind: 'reference'; name: string; location: Location }
  | { kind: 'unary'; operator: '-' | '!'; operand: Expression; location: Location }
  | { kind: 'binary'; operator: BinaryOperator; left: Expression; right: Expression; location: Location }
  | { kind: 'member'; object: string; property: string; location: Location }
  | { kind: 'construct'; name: string; args: Expression[]; named: NamedArgument[]; body: Statement[] | null; location: Location }
  | { kind: 'array'; elements: Expression[]; location: Location };

export type NamedArgument = { name: string; value: Expression; location: Location };

export type Target = { kind: 'name'; name: string } | { kind: 'index'; array: string; index: Expression };

export type Statement =
  | { kind: 'let'; name: string; value: Expression | null; location: Location }
  | { kind: 'assign'; target: Target; operator: BinaryOperator | null; value: Expression; location: Location }
  | { kind: 'expression'; expression: Expression; location: Location }
  | { kind: 'if'; condition: Expression; then: Statement[]; otherwise: Statement[] | null; location: Location }
  | { kind: 'while'; condition: Expression; body: Statement[]; location: Location }
  | { kind: 'for'; init: Statement | null; condition: Expression | null; step: Statement | null; body: Statement[]; location: Location }
  | { kind: 'forPlayer'; name: string; body: Statement[]; location: Location }
  | { kind: 'break'; location: Location }
  | { kind: 'continue'; location: Location }
  | { kind: 'return'; value: Expression | null; location: Location }
  | { kind: 'wait'; frames: Expression; location: Location }
  | { kind: 'block'; body: Statement[]; location: Location }
  | { kind: 'match'; subject: Expression; arms: MatchArm[]; location: Location }
  | { kind: 'property'; object: string; property: string; value: Expression; initial: boolean; location: Location };

export type MatchArm = { patterns: Expression[] | null; body: Statement[]; location: Location };

export type Declaration =
  | { kind: 'var'; name: string; array: boolean; value: Expression | null; exported: boolean; protected?: boolean; location: Location }
  | { kind: 'const'; name: string; value: Expression; secret: boolean; location: Location }
  | { kind: 'extern'; name: string; hostName: string; location: Location }
  | { kind: 'object'; keyword: string; name: string; uid: string; tree: ObjectTree[] | null; built: boolean; location: Location }
  | { kind: 'map'; body: Statement[]; location: Location }
  | { kind: 'function'; name: string; params: string[]; body: Statement[]; exported: boolean; location: Location }
  | { kind: 'on'; event: 'start' | 'join' | 'chat' | 'tamper'; body: Statement[]; location: Location }
  | { kind: 'every'; frames: number; body: Statement[]; location: Location };

export type ObjectTree = string | ObjectTree[];

export type Import = { path: string; location: Location };

export type SourceFile = { declarations: Declaration[]; imports: Import[] };
