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

export const PLACE_TEXT = Object.freeze({
  element: (tag: string, attributes: readonly string[]): string => `<${tag} ${attributes.join(' ')} />`,
  attribute: (name: string, value: string): string => `${name}="${value}"`,
  markName: (mark: string): string => `engine mark ${mark}`,
  change: (name: string, before: string | null, after: string): string => `${name} ${before ?? '(unset)'} → ${after}`,
  changed: (object: string, changes: readonly string[]): string => `${object}: ${changes.join(', ')}`,
  added: (constructorName: string, name: string): string => `Added ${constructorName} ${name}`,
  writtenWithoutMap: (uids: readonly string[]): string =>
    `Map objects written without a map to check (a map that already has one would get it twice): ${uids.join(', ')}`,
  otherTag: (uid: string, tag: string, constructorName: string, line: number): string =>
    `The map has ${uid} as a <${tag}>, but line ${line} creates a ${constructorName} with that uid.`,
  severalMarks: (mark: string, elements: readonly string[]): string =>
    `The map has the engine mark ${mark} ${elements.length} times, so the compiler cannot tell which one the program means; delete all but one: ${elements.join(' ')}`,
  wallsAgain: (count: number): string =>
    `${count} wall(s) or background(s) were added; building into this map again adds them again unless --replace removes the old ones (it reads the .build.json)`,
});
