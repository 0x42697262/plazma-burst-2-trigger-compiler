export const XML_ESCAPES: readonly (readonly [string, string])[] = Object.freeze([
  ['&', '&amp;'], ['"', '&quot;'], ['<', '&lt;'], ['>', '&gt;'], ['\n', '&#10;'], ['\r', '&#13;'],
]);
export const XML_LINE_END = '\n';
export const TEXT_FORBIDDEN: readonly string[] = Object.freeze(['", "', '" );', '\n', '\r']);
export const TEXT_TOKEN = Object.freeze({ start: '( "', separator: '", "', end: '" );' });
export const TEXT_LINE_END = '\n';
export const TEXT_BLOCK_SEPARATOR = '\n';
export const OP_PREFIX = 'op';
export const UID_ATTRIBUTE = /\buid="([^"]*)"/g;
export const TRAILING_LINE_END = /\s*$/;
export const ATTRIBUTE_SEPARATOR = ' ';
export const BASE_MAP = [
  '<player x="0" y="-100" tox="0" toy="0" hea="130" hmax="130" team="0" side="1" char="1" incar="-1" botaction="0" ondeath="-1" />',
  '<bg x="-1000" y="-1000" w="2000" h="1200" m="0" />',
  '<box x="-1000" y="0" w="2000" h="200" m="0" />',
  '<box x="-1000" y="-1000" w="100" h="1000" m="0" />',
  '<box x="900" y="-1000" w="100" h="1000" m="0" />',
  '',
].join('\n');
