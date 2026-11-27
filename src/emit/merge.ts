import { ELEMENT_NAME, MAP_ELEMENT, TIMER_TAG, TRAILING_LINE_END, TRIGGER_TAG, UID_ATTRIBUTE, UID_ATTRIBUTE_ONE, XML_LINE_END } from './keys.ts';
import { TEXT } from './text.ts';
import { withConvertedUids } from '../convert/uids.ts';
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

const CLEANED_ELEMENTS: ReadonlySet<string> = new Set([TRIGGER_TAG, TIMER_TAG]);

export type Cleaned = { xml: string; triggers: number; timers: number };

export function removeUnlisted(mapXml: string, keep: ReadonlySet<string>): Cleaned {
  let triggers = 0;
  let timers = 0;
  const xml = mapXml.replace(MAP_ELEMENT, (element) => {
    const name = ELEMENT_NAME.exec(element)?.[1];
    const uid = UID_ATTRIBUTE_ONE.exec(element)?.[1];
    if (name === undefined || !CLEANED_ELEMENTS.has(name) || uid === undefined || keep.has(uid)) return element;
    if (name === TRIGGER_TAG) triggers += 1;
    else timers += 1;
    return '';
  });
  return { xml, triggers, timers };
}

export type HostOptions = { replace: boolean; clean: boolean; owns: (uid: string) => boolean; keep: ReadonlySet<string> };

export function prepareHost(hostMap: string, options: HostOptions): { host: string; notes: string[] } {
  const replaced = options.replace ? removeOwned(hostMap, options.owns) : hostMap;
  if (!options.clean) return { host: replaced, notes: [] };
  const renamed = withConvertedUids(replaced);
  const cleaned = removeUnlisted(renamed.xml, options.keep);
  const renamedNote = renamed.changed > 0 ? [TEXT.cleanedUids(renamed.changed)] : [];
  return { host: cleaned.xml, notes: [...renamedNote, TEXT.cleaned(cleaned.triggers, cleaned.timers)] };
}

export function replaceInMap(mapXml: string, compiledXml: string, owns: (uid: string) => boolean): string {
  return appendToMap(removeOwned(mapXml, owns), compiledXml);
}
