import { KIND_HINT } from './keys.ts';

export const TEXT = Object.freeze({
  wrongKindInMap: (name: string, uid: string, keyword: string, tag: string): string =>
    `"${name}" is declared as ${keyword}, but ${uid} in the map is a <${tag}>.${tag === KIND_HINT.playerTag ? ` Declare it as ${KIND_HINT.playerKind}.` : tag === KIND_HINT.enemyTag ? ` Declare it as ${KIND_HINT.enemyKind}.` : ''}`,
  element: (tag: string, attributes: readonly string[]): string => `<${tag} ${attributes.join(' ')} />`,
  attribute: (name: string, value: string): string => `${name}="${value}"`,
  missing: (name: string, uid: string): string => `The map has no ${uid} for "${name}"; add it to the map, or remove the declaration.`,
  missingWithHint: (name: string, uid: string, constructorName: string): string =>
    `The map has no ${uid} for "${name}". A declaration outside a map block means the map already has the object; to create it, write it in a map block: map { ${name} = ${constructorName}("${uid}"); }`,
  or: ', ',
  functionOr: (names: string): string => `@function, a trigger uid or ${names}`,
  objectOr: (constructorName: string, names: string): string => `a ${constructorName}, its uid or ${names}`,
  boolKind: 'true or false',
  positive: ' above 0',
  notNegative: ' of 0 or more',
  wholeNumber: (limit: string): string => `a whole number${limit}`,
  number: (limit: string): string => `a number${limit}`,
  listKind: (group: string, open: boolean, numbers: boolean): string =>
    `a ${group} value (see docs/actions.md)${numbers ? ' or a number' : ''}${open ? ', or any custom value' : ''}`,
  textKind: 'text',
  mapObject: 'a map object',
  functionReference: (name: string): string => `@${name}`,
  notNumber: (text: string, kind: string): string => `takes ${kind}, got ${JSON.stringify(text)}`,
  notInList: (text: string, kind: string): string => `takes ${kind}, got ${text.startsWith('@') || text === 'a map object' ? text : JSON.stringify(text)}`,
  wrongObject: (constructorName: string, kind: string): string => `takes ${kind}, got a ${constructorName}`,
  noUid: (kind: string): string => `takes ${kind}, got an object without a uid`,
  wrongGroup: (group: string, kind: string): string => `takes ${kind}, not a ${group} value`,
});
