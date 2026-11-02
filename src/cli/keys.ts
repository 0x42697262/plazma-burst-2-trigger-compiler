export const FLAG = Object.freeze({
  prefix: '--prefix',
  out: '--out',
  into: '--into',
  guard: '--guard',
  noGuard: '--no-guard',
  noStart: '--no-start',
  extern: '--extern',
  help: '--help',
  run: '--run',
  frames: '--frames',
});
export const VALUE_FLAGS: ReadonlySet<string> = new Set([FLAG.prefix, FLAG.out, FLAG.into, FLAG.guard, FLAG.extern, FLAG.frames]);
export const ASSEMBLY_EXTENSION = '.pasm';
export const FILE_ENCODING = 'utf8';
export const OUTPUT = Object.freeze({ xml: '.xml', text: '.txt', sourceMap: '.map.json', map: '-map.xml' });
export const PREFIX_CLEANUP = /[^A-Za-z0-9]/g;
export const LEADING_DIGITS = /^[0-9]+/;
export const DEFAULT_PREFIX = 'ptc';
export const DEFAULT_OUT = 'out';
