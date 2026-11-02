export const COMPARISON = Object.freeze({ string: 'string', number: 'number' } as const);
export const OP_PREFIX = 'op';
export const SIDE_A = 'A';
export const LOOSE_VALUE_KINDS: ReadonlySet<string> = new Set(['string', 'nochange']);
export const NAME_SLOT = (side: string): RegExp => new RegExp(`(?:variables?|[Aa]rray|object) '${side}'|variables '[AB]' and '${side}'`);
