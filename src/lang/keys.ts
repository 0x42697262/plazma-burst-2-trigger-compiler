export const KEYWORDS: ReadonlySet<string> = new Set([
  'var', 'const', 'let', 'extern', 'function', 'export', 'on', 'every', 'if', 'else', 'while', 'for', 'player',
  'break', 'continue', 'return', 'true', 'false', 'wait', 'import',
]);
export const KEYWORD = Object.freeze({
  var: 'var', const: 'const', let: 'let', extern: 'extern', function: 'function', export: 'export', on: 'on', every: 'every',
  if: 'if', else: 'else', while: 'while', for: 'for', player: 'player', break: 'break', continue: 'continue', return: 'return',
  true: 'true', false: 'false', wait: 'wait', import: 'import',
} as const);
export const EVENT = Object.freeze({ start: 'start', join: 'join', chat: 'chat' } as const);
export const PUNCTUATORS: readonly string[] = Object.freeze([
  '..=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '..',
  '(', ')', '{', '}', '[', ']', ';', ',', '=', '<', '>', '+', '-', '*', '/', '%', '!', '@',
]);
export const PUNCTUATOR = Object.freeze({
  openParen: '(', closeParen: ')', openBrace: '{', closeBrace: '}', openBracket: '[', closeBracket: ']',
  semicolon: ';', comma: ',', assign: '=', at: '@', minus: '-', not: '!',
} as const);
export const COMPOUND_ASSIGNMENTS: Readonly<Record<string, BinaryOperator>> = Object.freeze({
  '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '..=': '..',
});
export type BinaryOperator = '+' | '-' | '*' | '/' | '%' | '..' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||';
export const PRECEDENCE: readonly (readonly BinaryOperator[])[] = Object.freeze([
  ['||'], ['&&'], ['==', '!=', '<', '<=', '>', '>='], ['..'], ['+', '-'], ['*', '/', '%'],
]);
export const COMPARISONS: ReadonlySet<string> = new Set(['==', '!=', '<', '<=', '>', '>=']);
export const ARITHMETIC: ReadonlySet<string> = new Set(['+', '-', '*', '/', '%']);
export const LINE_COMMENT = '//';
export const BLOCK_COMMENT_START = '/*';
export const BLOCK_COMMENT_END = '*/';
export const QUOTE = '"';
export const ESCAPE = '\\';
export const INTERPOLATION_START = '{';
export const INTERPOLATION_END = '}';
export const ESCAPED: Readonly<Record<string, string>> = Object.freeze({ n: '\n', '"': '"', '\\': '\\', '{': '{', '}': '}' });
export const NEWLINE = '\n';
export const IDENTIFIER_START = /[A-Za-z_]/;
export const IDENTIFIER_PART = /[A-Za-z0-9_]/;
export const DIGIT = /[0-9]/;
export const NUMBER = /^[0-9]+(\.[0-9]+)?/;
export const WHITESPACE = /\s/;
export const TRUE_TEXT = '1';
export const FALSE_TEXT = '0';
export const EMPTY_TEXT = '';
export const LOCAL_SEPARATOR = '.';
export const SHADOW_SEPARATOR = '#';
export const RETURN_NAME = 'return';
export const TEMP_NAME = 't';
export const STACK_POINTER = 'sp';
export const STACK_NAME = 'stack';
export const ARRAY_LENGTH = 'length';
export const ELEMENT_OPEN = '[';
export const ELEMENT_CLOSE = ']';
export const ADDRESS_NAME = 'address';
export const LABEL = Object.freeze({
  start: ':start', join: ':join', chat: ':chat', every: 'every', wait: 'wait', timer: 'timer', else: 'else', end: 'end', head: 'loop',
  next: 'next', skip: 'skip',
});
export const BUILTIN = Object.freeze({
  say: 'say', push: 'push', action: 'action', len: 'len', contains: 'contains', random: 'random', floor: 'floor', round: 'round',
  slot: 'slot', initiator: 'initiator', name: 'name', time: 'time', number: 'number', text: 'text', charAt: 'charAt', drop: 'drop', sync: 'sync',
  chatText: 'chatText', talker: 'talker', talkerName: 'talkerName', team: 'team', clear: 'clear', pop: 'pop',
} as const);
export const SPLIT_EVERY_CHARACTER = '';
export const HIDDEN = Object.freeze({ players: 'players', count: 'count', index: 'index' });
export const WHOLE_NUMBER = /^-?[0-9]+$/;
export const DEFAULT_SYNC_MODE = 'replace';
export const OBJECT_AT = 'at';
export const ARRAY_INDEX_PLACEHOLDER = 'i';
export const SIDE = Object.freeze({ a: 'A', b: 'B' });
export const TRIGGER_KIND = 'trigger';
export const UID_MARK = '#';
