import { MAP_ELEMENT, TRAILING_LINE_END, UID_ATTRIBUTE, UID_ATTRIBUTE_ONE, XML_LINE_END } from './keys.ts';
import { TEXT } from './text.ts';
import { EmitError } from './check.ts';

const uidsIn = (xml: string): Set<string> => new Set([...xml.matchAll(UID_ATTRIBUTE)].map((match) => match[1] ?? ''));

export function appendToMap(mapXml: string, compiledXml: string): string {
  const existing = uidsIn(mapXml);
  const clash = [...uidsIn(compiledXml)].find((uid) => existing.has(uid));
  if (clash !== undefined) throw new EmitError(TEXT.uidInMap(clash));
  return mapXml.replace(TRAILING_LINE_END, '') + XML_LINE_END + compiledXml;
}

export function removeOwned(mapXml: string, owns: (uid: string) => boolean): string {
  return mapXml.replace(MAP_ELEMENT, (element) => {
    const uid = UID_ATTRIBUTE_ONE.exec(element)?.[1];
    return uid !== undefined && owns(uid) ? '' : element;
  });
}

export function replaceInMap(mapXml: string, compiledXml: string, owns: (uid: string) => boolean): string {
  return appendToMap(removeOwned(mapXml, owns), compiledXml);
}
