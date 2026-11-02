export const OBFUSCATION_VARIABLE = Object.freeze({
  state: 'ob.state',
  run: 'ob.run',
  check: 'ob.check',
  base: 'ob.base',
  last: 'ob.last',
  size: 'ob.size',
  select: 'ob.select',
  work: 'ob.work',
  ready: 'ob.ready',
  failed: 'ob.failed',
  stop: 'ob.stop',
  alphabet: 'ob.alphabet',
  codes: 'ob.codes',
  count: 'ob.count',
  index: 'ob.index',
  out: 'ob.out',
  sum: 'ob.sum',
  code: 'ob.code',
  character: 'ob.char',
  pieces: 'ob.pieces',
  copy: 'ob.copy',
  text: (index: number): string => `ob.text${index}`,
});
export const OBFUSCATION_LABEL = Object.freeze({
  dispatch: 'dispatch', init: 'init', group: 'group', loop: 'decode', decoded: 'decoded', alarm: 'alarm', checked: 'checked',
});
export const DECOY_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const LEADING_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SEPARATOR_CANDIDATES: readonly string[] = Object.freeze(['\u241F', '\u241E', '\u241D', '\u241C', '\u2420']);
export const SPLIT_CHARACTERS = '';
export const EMPTY = '';
export const ZERO = '0';
export const ONE = '1';
export const READY_MARK = '1';
export const UID_MARK = '#';
export const SAY_COLOR = '0';
export const NUMERIC_TEXT = /^-?[0-9]+$/;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const REGEX_ESCAPED = '\\$&';
const escapePattern = (text: string): string => text.replace(REGEX_SPECIAL, REGEX_ESCAPED);
export const ownNamePattern = (opening: string, marks: string, close: string): RegExp =>
  new RegExp(`^${escapePattern(opening)}[${escapePattern(marks)}][^${escapePattern(close)}]*${escapePattern(close)}`);
