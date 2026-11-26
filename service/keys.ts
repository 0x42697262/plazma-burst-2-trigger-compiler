export const DIAGNOSTIC_LINE = /^(?:(.+?) )?line (\d+): ([\s\S]*)$/;
export const MEMBER_BEFORE_CURSOR = /([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_]*)$/;
export const ACTION_BEFORE_CURSOR = /\baction\(\s*"?([^",)]*)$/;
export const WORD_CHARACTER = /[A-Za-z0-9_]/;
export const NEWLINE = '\n';
export const SERVICE_PREFIX = 'lsp';
export const DECLARING_KEYWORDS: ReadonlySet<string> = new Set(['var', 'let', 'const', 'extern', 'function']);
export const SEVERITY = Object.freeze({ error: 'error', warning: 'warning' } as const);
export const COMPLETION_KIND = Object.freeze({
  keyword: 'keyword', function: 'function', variable: 'variable', constant: 'constant', value: 'value', action: 'action', group: 'group', kind: 'kind',
  property: 'property',
} as const);
export const SYMBOL_KIND = Object.freeze({
  function: 'function', variable: 'variable', constant: 'constant', object: 'object', event: 'event', array: 'array',
} as const);
export const OPEN_BRACKET = '[';
export const DOT = '.';
export const DIGITS = /^[0-9]+$/;
export const CONSTRUCTOR_BEFORE_CURSOR = /\b([A-Z][A-Za-z]*)\(([^()]*)$/;
export const ARGUMENT_NAME_BEFORE_CURSOR = /(?:^|,)\s*([a-z_][a-z0-9_]*)?$/;
export const ARGUMENT_VALUE_BEFORE_CURSOR = /(?:^|,)\s*([a-z_][a-z0-9_]*)\s*:\s*([A-Za-z0-9_]*)$/;
export const PROPERTY_VALUE_BEFORE_CURSOR = /([A-Za-z_][A-Za-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\??=\s*([A-Za-z0-9_]*)$/;
export const ARGUMENT_NAME_AFTER = /^\s*:/;
export const ASSIGNMENT = '=';
export const INTERPOLATION = /\{([^{}]*)\}/g;
export const WORD_PATTERN = /[A-Za-z_][A-Za-z0-9_]*/g;
export const NAMED_ARGUMENT = ': ';
export const constructorAssignment = (name: string): RegExp => new RegExp(`\\b${name}\\s*=\\s*([A-Z][A-Za-z]*)\\s*\\(`);
