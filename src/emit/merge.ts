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

const ELEMENT_NAME = /^<([A-Za-z][\w-]*)/;
const CLEANED_ELEMENTS: ReadonlySet<string> = new Set(['trigger', 'timer']);

export type Cleaned = { xml: string; triggers: number; timers: number };

/** Removes the map's triggers and timers whose uid is not in `keep` (the map { } block's uids). Elements without a uid stay. */
export function removeUnlisted(mapXml: string, keep: ReadonlySet<string>): Cleaned {
  let triggers = 0;
  let timers = 0;
  const xml = mapXml.replace(MAP_ELEMENT, (element) => {
    const name = ELEMENT_NAME.exec(element)?.[1];
    const uid = UID_ATTRIBUTE_ONE.exec(element)?.[1];
    if (name === undefined || !CLEANED_ELEMENTS.has(name) || uid === undefined || keep.has(uid)) return element;
    if (name === 'trigger') triggers += 1;
    else timers += 1;
    return '';
  });
  return { xml, triggers, timers };
}

export function replaceInMap(mapXml: string, compiledXml: string, owns: (uid: string) => boolean): string {
  return appendToMap(removeOwned(mapXml, owns), compiledXml);
}
