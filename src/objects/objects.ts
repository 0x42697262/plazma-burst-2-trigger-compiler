import { ELEMENT_WITH_UID, OBJECT_KINDS } from './keys.ts';
import type { ObjectKindInfo } from './keys.ts';
import { TEXT } from './text.ts';

export type ObjectSpec = { keyword: string; name: string; uid: string; built: boolean };
export type ObjectCheck = { missing: ObjectSpec[]; problems: string[] };

export const objectKind = (keyword: string): ObjectKindInfo | null => (Object.hasOwn(OBJECT_KINDS, keyword) ? OBJECT_KINDS[keyword] ?? null : null);

export const isObjectKeyword = (word: string): boolean => objectKind(word) !== null;

export function elementsByUid(mapXml: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of mapXml.matchAll(ELEMENT_WITH_UID)) {
    const uid = match[2] ?? '';
    if (!found.has(uid)) found.set(uid, match[1] ?? '');
  }
  return found;
}

export function checkObjects(objects: readonly ObjectSpec[], mapXml: string): ObjectCheck {
  const elements = elementsByUid(mapXml);
  const missing: ObjectSpec[] = [];
  const problems: string[] = [];
  for (const object of objects) {
    if (object.built) continue;
    const tag = elements.get(object.uid);
    const info = objectKind(object.keyword);
    if (tag === undefined) missing.push(object);
    else if (info && !info.tags.includes(tag)) problems.push(TEXT.wrongKindInMap(object.name, object.uid, object.keyword, tag));
  }
  return { missing, problems };
}
