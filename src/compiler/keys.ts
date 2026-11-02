export const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
export const SEED_PREFIX_LETTER = 'z';
export const VARIABLE_MARK = '~';
export const TRIGGER_MARK = '#';
export const USER_SEPARATOR = '_';
export const INTERNAL_MARK = ':';
export const CONTINUATION_SEPARATOR = '.';
export const START_TIMER_LABEL = ':start-timer';
export const INTERNAL_VARIABLE = Object.freeze({
  left: 'left',
  right: 'right',
  steps: 'steps',
  stop: 'stop',
});
export const ZERO_VALUE = '0';
export const STEP_VALUE = '1';
export const OBJECT_PARAM_KINDS: ReadonlySet<string> = new Set([
  'trigger', 'timer', 'region', 'door', 'vehicle', 'character', 'gun', 'barrel', 'decor', 'pushf', 'lamp', 'water',
]);
export const LABEL_HINT = Object.freeze({ then: 'then', body: 'body' });
export const SHOWN_DECODED: readonly string[] = Object.freeze(['<', '>', '"']);
export const COLOR_PARAM_KIND = 'textmsg';
export const HOST_TRIGGER_ELEMENT = /<trigger\b[^>]*>/g;
export const HOST_ACTION_ATTRIBUTE = /actions_(\d+)_type="(-?\d+)" actions_\1_targetA="([^"]*)"/g;
export const STRING_PARAM_KIND = 'string';
export const ELEMENT_START = '[';
