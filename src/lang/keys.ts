export const KEYWORDS: ReadonlySet<string> = new Set([
  'var', 'const', 'let', 'extern', 'function', 'export', 'on', 'every', 'if', 'else', 'while', 'for', 'player',
  'break', 'continue', 'return', 'true', 'false', 'wait', 'import', 'match',
]);
export const KEYWORD = Object.freeze({
  var: 'var', const: 'const', let: 'let', extern: 'extern', function: 'function', export: 'export', on: 'on', every: 'every',
  if: 'if', else: 'else', while: 'while', for: 'for', player: 'player', break: 'break', continue: 'continue', return: 'return',
  true: 'true', false: 'false', wait: 'wait', import: 'import', match: 'match',
} as const);
export const CONTEXTUAL = Object.freeze({ secret: 'secret', map: 'map', protected: 'protected' } as const);
export const COMPILE_TIME_BUILTIN = Object.freeze({ env: 'env' } as const);
export const STD_IMPORT = 'std/';
export const STD_SCHEME = 'std:';
export const COMPILE_TIME_PREFIX = 'comptime';
export const COMPILE_TIME_RESULT = 'comptimeResult';
export const EVENT = Object.freeze({ start: 'start', join: 'join', chat: 'chat', tamper: 'tamper' } as const);
export const PUNCTUATORS: readonly string[] = Object.freeze([
  '..=', '?=', '+=', '-=', '*=', '/=', '%=', '=>', '==', '!=', '<=', '>=', '&&', '||', '..',
  '(', ')', '{', '}', '[', ']', ';', ',', '=', '<', '>', '+', '-', '*', '/', '%', '!', '@', '.', ':',
]);
export const PUNCTUATOR = Object.freeze({
  openParen: '(', closeParen: ')', openBrace: '{', closeBrace: '}', openBracket: '[', closeBracket: ']',
  semicolon: ';', comma: ',', assign: '=', at: '@', minus: '-', not: '!', arrow: '=>', wildcard: '_', dot: '.',
  assignIfCreated: '?=', colon: ':',
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
export const TEXT_CONSTANT = Object.freeze({ elementEnd: 'element-end', keySeparator: 'key-separator' });
export const LABEL = Object.freeze({
  start: ':start', join: ':join', chat: ':chat', tamper: ':tamper', every: 'every', wait: 'wait', timer: 'timer', else: 'else', end: 'end', head: 'loop',
  next: 'next', skip: 'skip', arm: 'case',
});
export const BUILTIN = Object.freeze({
  say: 'say', push: 'push', action: 'action', len: 'len', contains: 'contains', random: 'random', floor: 'floor', round: 'round',
  slot: 'slot', initiator: 'initiator', name: 'name', time: 'time', number: 'number', text: 'text', charAt: 'charAt', drop: 'drop', sync: 'sync',
  chatText: 'chatText', talker: 'talker', talkerName: 'talkerName', talkerLogin: 'talkerLogin', login: 'login', killer: 'killer', multiplayer: 'multiplayer', mapId: 'mapId',
  sin: 'sin', cos: 'cos', asin: 'asin', acos: 'acos', atan2: 'atan2', team: 'team', clear: 'clear', pop: 'pop',
  tamperFinding: 'tamperFinding', tamperCount: 'tamperCount',
} as const);
export const SPLIT_EVERY_CHARACTER = '';
export const NUMBER_TEXT_MARK = '_';
export const HIDDEN = Object.freeze({ players: 'players', count: 'count', index: 'index' });
export const WHOLE_NUMBER = /^-?[0-9]+$/;
export const DEFAULT_SYNC_MODE = 'replace';
export const OBJECT_AT = 'at';
export const STARTS_UPPERCASE = /^[A-Z]/;
export const UID_RANGE = /^\s*(-?[0-9]+)\s*\.\.\s*(-?[0-9]+)\s*$/;
export const STATEMENT_KEYWORDS: ReadonlySet<string> = new Set(['if', 'while', 'for', 'let', 'return', 'break', 'continue', 'wait', 'match']);
export const ARRAY_INDEX_PLACEHOLDER = 'i';
export const SIDE = Object.freeze({ a: 'A', b: 'B' });
export const TRIGGER_KIND = 'trigger';
export const COLOR_KIND = 'textmsg';
export const KEY_SEPARATOR = ',';
export const UID_MARK = '#';
export const PATH_SEPARATOR = '/';
export const CURRENT_SEGMENT = '.';
export const PARENT_SEGMENT = '..';
export const ACTION_BUILTIN = 'action';
export const SIDE_B = 'B';

export const BUILD_NAMES = Object.freeze({ log: 'mapLog', count: 'mapCount', function: 'mapStep', parameter: 'mapValue', counter: 'mapIndex', trigger: 'mapTrigger' });
export const BUILD_SUFFIX = '_';
export const BUILD_RECORD = Object.freeze({ object: 'N', property: 'S', bind: 'B', element: 'A', action: 'T' });
export const ACTION_ARITY = 4;
export const NO_TARGET = '0';
export const MAP_MARK = Object.freeze({ start: '\u0002', field: '\u0003', record: '\u001E', unit: '\u001F' });
export const MARK_TYPE = Object.freeze({ object: 'O', host: 'H', name: 'N', named: 'G', function: 'F', raw: 'R' });
export const MARK_KIND = 'engine_mark';
export const TEXT_KIND = 'string';
export const ZERO_TEXT = '0';
export const ONE_TEXT = '1';
export const PROPERTY_ARITY = 2;
export const FORBIDDEN_IN_MAP: ReadonlySet<string> = new Set([
  BUILTIN.say, BUILTIN.action, BUILTIN.sync, BUILTIN.random, BUILTIN.time, BUILTIN.slot, BUILTIN.initiator, BUILTIN.name, BUILTIN.chatText,
  BUILTIN.talker, BUILTIN.talkerName, BUILTIN.talkerLogin, BUILTIN.login, BUILTIN.killer, BUILTIN.multiplayer, BUILTIN.mapId, BUILTIN.team,
  COMPILE_TIME_BUILTIN.env,
]);
export const OPEN_LIST = '\u0002open';
