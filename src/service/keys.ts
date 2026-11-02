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
} as const);
export const SYMBOL_KIND = Object.freeze({
  function: 'function', variable: 'variable', constant: 'constant', object: 'object', event: 'event', array: 'array',
} as const);
export const OPEN_BRACKET = '[';
export const DOT = '.';
export const DIGITS = /^[0-9]+$/;
