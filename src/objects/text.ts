export const TEXT = Object.freeze({
  wrongKindInMap: (name: string, uid: string, keyword: string, tag: string): string =>
    `"${name}" is declared as ${keyword}, but ${uid} in the map is a <${tag}>.`,
  unknownKind: (keyword: string): string => `Unknown object kind "${keyword}".`,
  element: (tag: string, attributes: readonly string[]): string => `<${tag} ${attributes.join(' ')} />`,
  attribute: (name: string, value: string): string => `${name}="${value}"`,
});
