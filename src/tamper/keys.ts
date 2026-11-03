export const TAMPER_MODE = Object.freeze({ off: 'off', report: 'report', enforce: 'enforce' } as const);
export type TamperMode = (typeof TAMPER_MODE)[keyof typeof TAMPER_MODE];
export type ActiveMode = Exclude<TamperMode, typeof TAMPER_MODE.off>;
export const isTamperMode = (text: string): text is TamperMode => Object.values<string>(TAMPER_MODE).includes(text);

export const TAMPER_LAYER = Object.freeze({ flow: 'flow', entry: 'entry', value: 'value', watchdog: 'watchdog' } as const);
export type TamperLayer = (typeof TAMPER_LAYER)[keyof typeof TAMPER_LAYER];
export const ALL_LAYERS: readonly TamperLayer[] = Object.freeze(Object.values(TAMPER_LAYER));
export const isTamperLayer = (text: string): text is TamperLayer => Object.values<string>(TAMPER_LAYER).includes(text);
export const LAYER_SEPARATOR = ',';

export const TAMPER_VARIABLE = Object.freeze({
  token: 'tc.token',
  expect: 'tc.expect',
  work: 'tc.work',
  now: 'tc.now',
  findings: 'tc.findings',
  last: 'tc.last',
  reported: 'tc.reported',
  state: 'tc.state',
  due: 'tc.due',
  softCount: 'tc.soft',
  softStart: 'tc.window',
  started: 'tc.started',
  pulse: 'tc.pulse',
  beat: 'tc.beat',
  alert: 'tc.alert',
  alertSeen: 'tc.alert-seen',
  firmProof: 'tc.firm',
  wait: (index: number): string => `tc.wait${index}`,
  mirror: (name: string): string => `tc.mirror.${name}`,
  mask: (name: string): string => `tc.mask.${name}`,
});

export const FINDING = Object.freeze({ flow: 1, value: 2, start: 3, timer: 4, wait: 5, stalled: 6, idle: 7, late: 8 } as const);
export type FindingKind = keyof typeof FINDING;
export const FIRM_FINDINGS: ReadonlySet<FindingKind> = new Set(['flow', 'value', 'start', 'timer', 'wait']);

export const TAMPER_LABEL = Object.freeze({
  found: (kind: FindingKind): string => `:tc-found-${kind}`,
  firm: ':tc-firm',
  soft: ':tc-soft',
  proof: ':tc-proof',
  watchdog: ':tc-watchdog',
  watchdogEnd: ':tc-watchdog-end',
  watchdogTimer: ':tc-watchdog-timer',
  reaction: ':tc-reaction',
  softReset: ':tc-soft-reset',
  softCounted: ':tc-soft-counted',
  proofEnd: ':tc-proof-end',
  announced: ':tc-announced',
  quietReaction: ':tc-quiet-reaction',
});

export const STATE = Object.freeze({ marked: '1', done: '2' });
export const SAY_COLOR = '0';
export const ZERO = '0';
export const ONE = '1';
export const SEED_PURPOSE = Object.freeze({ tokens: 'tamper-tokens', masks: 'tamper-masks', reaction: 'tamper-reaction' });
