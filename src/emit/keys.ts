export const XML_ESCAPES: readonly (readonly [string, string])[] = Object.freeze([
  ['&', '&amp;'], ['"', '&quot;'], ['<', '&lt;'], ['>', '&gt;'], ['\n', '&#10;'], ['\r', '&#13;'],
]);
export const XML_LINE_END = '\n';
export const TEXT_FORBIDDEN: readonly string[] = Object.freeze(['", "', '" );', '\n', '\r']);
export const TEXT_LINE_END = '\n';
export const TEXT_BLOCK_SEPARATOR = '\n';
export const OP_PREFIX = 'op';
export const UID_ATTRIBUTE = /\buid="([^"]*)"/g;
export const TRAILING_LINE_END = /\s*$/;
export const ATTRIBUTE_SEPARATOR = ' ';
