export const COMMENT_MARKS: readonly string[] = Object.freeze([';', '//']);
export const OPERAND_SEPARATOR = ',';
export const QUOTE = '"';
export const ESCAPE = '\\';
export const VARIABLE_SIGIL = '$';
export const LABEL_SIGIL = '@';
export const HOST_SIGIL = '%';
export const DIRECTIVE_MARK = '.';
export const INTERPOLATION_START = '{';
export const INTERPOLATION_END = '}';
export const ESCAPED: Readonly<Record<string, string>> = Object.freeze({ n: '\n', '"': '"', '\\': '\\', '{': '{', '}': '}' });
export const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const LABEL_DEFINITION = /^([A-Za-z_][A-Za-z0-9_]*):(?:\s+|$)/;
export const WHITESPACE = /\s/;
export const LINE_SPLIT = /\r?\n/;
export const DIRECTIVE = Object.freeze({ start: 'start', entry: 'entry', extern: 'extern', timer: 'timer', prefix: 'prefix' } as const);
export const TIMER_DISABLED = 'disabled';
export const MNEMONIC = Object.freeze({
  jump: 'jmp', call: 'call', ret: 'ret', set: 'set', add: 'add', say: 'say',
} as const);
export const BRANCHES: Readonly<Record<string, 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'>> = Object.freeze({
  jeq: 'eq', jne: 'ne', jlt: 'lt', jle: 'le', jgt: 'gt', jge: 'ge',
});
