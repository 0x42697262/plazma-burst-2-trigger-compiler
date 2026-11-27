import { CONSTRUCTORS, UID_ARGUMENT } from '../objects/keys.ts';
import { constructorForTag } from '../objects/properties.ts';
import { parseMap, uidOf } from './map-file.ts';
import type { MapElement } from './map-file.ts';
import { escapeXml } from '../emit/xml-emitter.ts';
import { AFTER_TAG, COPY_SUFFIX, ELEMENT, ELEMENT_TAG_START, UID_CHANGE, UID_IN_ELEMENT, UID_MARK, uidAttribute } from './keys.ts';

export type UidChange = (typeof UID_CHANGE)[keyof typeof UID_CHANGE];
export type ConvertedUids = { uids: ReadonlyMap<number, string>; firstByUid: ReadonlyMap<string, MapElement>; changes: ReadonlyMap<number, UidChange> };

export function convertedUids(elements: readonly MapElement[]): ConvertedUids {
  const used = new Set<string>();
  for (const element of elements) {
    for (const [, value] of element.attributes) used.add(value);
    for (const action of element.actions) used.add(action.targetA).add(action.targetB);
  }
  const counters = new Map<string, number>();
  const fresh = (base: string): string => {
    let number = counters.get(base) ?? 1;
    while (used.has(base + COPY_SUFFIX + String(number))) number++;
    counters.set(base, number + 1);
    const uid = base + COPY_SUFFIX + String(number);
    used.add(uid);
    return uid;
  };
  const uids = new Map<number, string>();
  const firstByUid = new Map<string, MapElement>();
  const changes = new Map<number, UidChange>();
  for (const element of elements) {
    const constructorName = constructorForTag(element.tag);
    const needsUid = constructorName !== null && CONSTRUCTORS[constructorName]?.positional.includes(UID_ARGUMENT) === true;
    const uid = uidOf(element);
    if (uid !== undefined && !firstByUid.has(uid)) firstByUid.set(uid, element);
    if (!needsUid) continue;
    if (uid === undefined || uid === '' || !uid.startsWith(UID_MARK)) {
      uids.set(element.index, fresh(UID_MARK + element.tag));
      changes.set(element.index, UID_CHANGE.added);
    } else if (firstByUid.get(uid) !== element) {
      uids.set(element.index, fresh(uid));
      changes.set(element.index, UID_CHANGE.renamed);
    } else {
      uids.set(element.index, uid);
    }
  }
  return { uids, firstByUid, changes };
}

export function withConvertedUids(xml: string): { xml: string; changed: number } {
  const { uids, changes } = convertedUids(parseMap(xml));
  let index = 0;
  const rewritten = xml.replace(ELEMENT, (element: string) => {
    const current = index;
    index += 1;
    const uid = uids.get(current);
    if (uid === undefined || !changes.has(current)) return element;
    const attribute = uidAttribute(escapeXml(uid));
    return UID_IN_ELEMENT.test(element) ? element.replace(UID_IN_ELEMENT, attribute) : element.replace(ELEMENT_TAG_START, AFTER_TAG + attribute);
  });
  return { xml: rewritten, changed: changes.size };
}
