export const TEXT = Object.freeze({
  tooManyActions: (uid: string, count: number, limit: number): string => `Trigger ${uid} has ${count} actions; the game loads at most ${limit}.`,
  unknownOpcode: (uid: string, opcode: number): string => `Trigger ${uid} uses unknown action ${opcode}.`,
  duplicateUid: (uid: string): string => `The uid ${uid} is used twice.`,
  uidInMap: (uid: string): string => `The map already has an object with uid ${uid}.`,
  notWritableAsText: (uid: string, position: number, value: string): string =>
    `Trigger ${uid}, action ${position}: the values ${JSON.stringify(value)} cannot be written as trigger text.`,
  xmlTrigger: (attributes: string): string => `<trigger ${attributes} />`,
  xmlTimer: (attributes: string): string => `<timer ${attributes} />`,
  xmlEngineMark: (attributes: string): string => `<inf ${attributes} />`,
  xmlAttribute: (name: string, value: string): string => `${name}="${value}"`,
  actionAttribute: (position: number, field: string): string => `actions_${position}_${field}`,
  header: (name: string, value: string): string => `${name}: ${value}`,
  actionLine: (name: string, targetA: string, targetB: string): string => `${name}( "${targetA}", "${targetB}" );`,
});
