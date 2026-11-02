export const TRIGGER_ATTRIBUTE = Object.freeze({
  uid: 'uid', x: 'x', y: 'y', enabled: 'enabled', maxCalls: 'maxcalls', target: 'target', delay: 'delay',
  type: 'type', targetA: 'targetA', targetB: 'targetB',
} as const);
export const TEXT_HEADER = Object.freeze({ uid: 'uid', enabled: 'enabled', maxCalls: 'maxcalls' } as const);
export const ENGINE_MARK = Object.freeze({ markAttribute: 'mark', teamAttribute: 'forteam', varSync: 'var_sync', anyTeam: '0' });
export const VAR_SYNC_IN_MAP = /<inf\b[^>]*\bmark="var_sync"/;
