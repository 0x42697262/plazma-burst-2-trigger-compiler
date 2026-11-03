export const REFERENCE_KINDS: Readonly<Record<string, string>> = Object.freeze({
  'door+none': 'door', 'vehicle+none+any': 'vehicle', 'trigger+none': 'trigger', 'song+none': 'song',
});
export const TRIGGER_TAG = 'trigger';
export const UID_MARK = '#';
export const NUMBER_KIND = /^(value|int)/;
export const WHOLE_KINDS: readonly string[] = Object.freeze(['int', 'round1']);
export const NUMBER_LIMIT = Object.freeze({ positive: '>0', notNegative: '>=0' });
export const BOOL_TEXT = Object.freeze({ kind: 'bool', true: 'true', false: 'false', yes: ['true', '1'] as readonly string[], no: ['false', '0'] as readonly string[] });
export const KIND_PART = '+';
