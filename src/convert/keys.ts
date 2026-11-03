export const ELEMENT = /<([A-Za-z][\w-]*)\b([^>]*?)\s*\/>/g;
export const ATTRIBUTE = /([A-Za-z0-9_]+)="([^"]*)"/g;
export const ACTION_ATTRIBUTE = /^actions_(\d+)_(type|targetA|targetB)$/;
export const ENTITIES: readonly (readonly [string, string])[] = Object.freeze([['&quot;', '"'], ['&lt;', '<'], ['&gt;', '>'], ['&#10;', '\n'], ['&#13;', '\r'], ['&amp;', '&']]);
export const TAG = Object.freeze({ trigger: 'trigger', timer: 'timer', inf: 'inf', decor: 'decor', region: 'region', player: 'player', enemy: 'enemy', song: 'song' });
export const ATTRIBUTE_NAME = Object.freeze({
  uid: 'uid', x: 'x', y: 'y', w: 'w', h: 'h', enabled: 'enabled', maxcalls: 'maxcalls', target: 'target', delay: 'delay', mark: 'mark', forteam: 'forteam',
  model: 'model', front: 'f', execute: 'execute', useTarget: 'use_target', ondeath: 'ondeath', callback: 'callback', usesTimer: 'uses_timer',
});
export const ACTION_FIELD = Object.freeze({ type: 'type', targetA: 'targetA', targetB: 'targetB' });
export const TRUE_TEXT = 'true';
export const FALSE_TEXT = 'false';
export const UNLIMITED = '-1';
export const NONE = '-1';
export const ONCE = '1';
export const UID_MARK = '#';
export const TRIGGER_KIND = 'trigger';
export const TIMER_KIND = 'timer';
export const BOOL_KIND = 'bool';
export const NO_VALUE_KIND = 'nochange';
export const REFERENCE_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  region: ['use_target'], player: ['ondeath'], enemy: ['ondeath'], song: ['callback'], timer: ['target'],
});
export const UNREAD_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = Object.freeze({ decor: ['at', 'addx', 'addy'] });
export const IN_FRONT_MODELS: ReadonlySet<string> = new Set([
  'back_lamp_vertical', 'back_lamp_horizontal', 'back_lamp_vertical_on', 'back_lamp_horizontal_on', 'text', 'text2', 'text3', 'pixel_teleport',
  'ditzy_flag_blue', 'ditzy_flag_red', 'ditzy_flag_dark', 'ditzy_flag_empty', 'darkstar_healing_kit', 'darkstar_holo_on', 'darkstar_holo_on_red',
  'darkstar_holo_off', 'darkstar_holo_earth', 'darkstar_holo_c9', 'doomzerker_locker', 'doomzerker_locker2', 'doomzerker_locker3', 'darkstar_tree1',
  'darkstar_tree2', 'darkstar_pot', 'darkstar_pot_tree1', 'darkstar_pot_tree2',
]);
export const IN_FRONT_VALUE = '1';
export const STOPPING_DESCRIPTION = /continue (execution of this trigger|trigger actions execution) only if/i;
export const WORD_SPLIT = /[^A-Za-z0-9]+/;
export const STARTS_WITH_LETTER = /^[A-Za-z_]/;
export const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const LETTER_PREFIX = 'n';
export const TRIGGER_WORD = 'trigger';
export const DONE_SUFFIX = 'Done';
export const CALLS_SUFFIX = 'Calls';
export const COPY_SUFFIX = '*';
export const RESERVED_EXTRA: readonly string[] = Object.freeze(['map', 'secret', 'env']);
export const STYLE = Object.freeze({ functions: 'functions', raw: 'raw' } as const);
export const FLAG = Object.freeze({ out: '--out', prefix: '--prefix', raw: '--raw', check: '--check', help: '--help' });
export const FLAG_START = '-';
export const VALUE_FLAGS: ReadonlySet<string> = new Set([FLAG.out, FLAG.prefix]);
export const SOURCE_EXTENSION = '.ptc';
export const XML_EXTENSION = /\.(xml|txt)$/i;
export const DEFAULT_OUT = 'out';
export const FILE_ENCODING = 'utf8';
export const ESCAPES: readonly (readonly [string, string])[] = Object.freeze([['\\', '\\\\'], ['"', '\\"'], ['{', '\\{'], ['}', '\\}'], ['\n', '\\n']]);
export const QUOTE = '"';
export const INDENT = '  ';
export const LINE_END = '\n';
export const ARGUMENT_SEPARATOR = ', ';
