export const OPCODES_GLOBAL = 'PB2_OPCODES';
export const SOURCE_FLAG = '--from';
export const EDITOR_FLAG = '--editor';
export const HELP_FLAG = '--help';
export const FILE_ENCODING = 'utf8';
export const RECTANGLE_SHAPE = 'rect';
export const EDITOR_FILES = Object.freeze({ keys: 'keys.ts', kinds: 'kinds.ts', constants: 'constants.ts' });
export const VEHICLE_TAG = 'vehicle';
export const GAME_ONLY_ACTIONS: Readonly<Record<string, Readonly<{ a: string; b: string; desc: string }>>> = Object.freeze({
  424: Object.freeze({ a: 'region', b: 'string', desc: 'Region › Move region \'A\' to lower body of Character slot-value variable \'B\'' }),
});
