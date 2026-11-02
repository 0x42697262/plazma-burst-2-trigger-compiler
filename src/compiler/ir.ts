export type Value = { kind: 'variable'; name: string } | { kind: 'literal'; text: string };

export type Operand = { kind: 'text'; text: string } | { kind: 'label'; label: string };

export type Condition = 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge';

export type SourceLocation = { line: number };

export type Instruction =
  | { kind: 'label'; label: string; entry: boolean }
  | { kind: 'action'; opcode: number; targetA: Operand; targetB: Operand; location: SourceLocation | null }
  | { kind: 'jump'; label: string; location: SourceLocation | null }
  | { kind: 'branch'; condition: Condition; left: Value; right: Value; label: string; location: SourceLocation | null }
  | { kind: 'call'; label: string; location: SourceLocation | null }
  | { kind: 'return'; location: SourceLocation | null };

export type TimerSpec = { label: string; target: string; enabled: boolean; maxCalls: number; delay: number };

export type Module = { instructions: readonly Instruction[]; start: string | null; timers: readonly TimerSpec[] };

export const variable = (name: string): Value => ({ kind: 'variable', name });
export const literal = (text: string): Value => ({ kind: 'literal', text });
export const textOperand = (text: string): Operand => ({ kind: 'text', text });
export const labelOperand = (label: string): Operand => ({ kind: 'label', label });
