import snapshot from './snapshot.json' with { type: 'json' };
import { AVOIDED, OPCODE, TEMPLATE_REPLACED_A, TEMPLATE_REPLACED_B } from './constants.ts';
import { COMPARISON, NAME_SLOT, OP_PREFIX, SIDE_A } from './keys.ts';

export type Comparison = (typeof COMPARISON)[keyof typeof COMPARISON];

export type Opcode = {
  number: number;
  alias: string | null;
  paramA: string;
  paramB: string;
  description: string;
  templateReplacedA: boolean;
  templateReplacedB: boolean;
  comparison: Comparison | null;
  avoided: boolean;
};

type SnapshotAction = { alias?: string; a: string; b: string; desc: string };

const COMPARISONS: ReadonlyMap<number, Comparison> = new Map([
  [OPCODE.skipIfNotEqualValue, COMPARISON.string],
  [OPCODE.skipIfEqual, COMPARISON.string],
  [OPCODE.skipIfGreater, COMPARISON.number],
  [OPCODE.skipIfLess, COMPARISON.number],
]);

const toOpcode = (key: string, action: SnapshotAction): Opcode => {
  const number = Number(key);
  return {
    number,
    alias: action.alias ?? null,
    paramA: action.a,
    paramB: action.b,
    description: action.desc,
    templateReplacedA: TEMPLATE_REPLACED_A.has(number),
    templateReplacedB: TEMPLATE_REPLACED_B.has(number),
    comparison: COMPARISONS.get(number) ?? null,
    avoided: AVOIDED.has(number),
  };
};

const actions: Record<string, SnapshotAction> = snapshot.actions;

export const OPCODES: ReadonlyMap<number, Opcode> = new Map(
  Object.entries(actions).map(([key, action]) => [Number(key), toOpcode(key, action)]),
);

const BY_ALIAS: ReadonlyMap<string, Opcode> = new Map(
  [...OPCODES.values()].filter((opcode) => opcode.alias !== null).map((opcode) => [opcode.alias ?? '', opcode]),
);

export const opcodeByNumber = (number: number): Opcode | null => OPCODES.get(number) ?? null;

export const opcodeByName = (name: string): Opcode | null => {
  const byAlias = BY_ALIAS.get(name);
  if (byAlias) return byAlias;
  if (!name.startsWith(OP_PREFIX)) return null;
  const digits = name.slice(OP_PREFIX.length);
  const isNumber = digits !== '' && String(Number(digits)) === digits;
  return isNumber ? opcodeByNumber(Number(digits)) : null;
};

export const textName = (opcode: Opcode): string => `${OP_PREFIX}${opcode.number}`;


export const takesVariableName = (opcode: Opcode, side: string): boolean =>
  (side === SIDE_A ? opcode.templateReplacedA : opcode.templateReplacedB) || NAME_SLOT(side).test(opcode.description);
