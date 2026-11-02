import { KIND_HINT } from './keys.ts';

export const TEXT = Object.freeze({
  wrongKindInMap: (name: string, uid: string, keyword: string, tag: string): string =>
    `"${name}" is declared as ${keyword}, but ${uid} in the map is a <${tag}>.${tag === KIND_HINT.playerTag ? ` Declare it as ${KIND_HINT.playerKind}.` : tag === KIND_HINT.enemyTag ? ` Declare it as ${KIND_HINT.enemyKind}.` : ''}`,
  unknownKind: (keyword: string): string => `Unknown object kind "${keyword}".`,
  element: (tag: string, attributes: readonly string[]): string => `<${tag} ${attributes.join(' ')} />`,
  attribute: (name: string, value: string): string => `${name}="${value}"`,
});
