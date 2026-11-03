import { ELEMENT_WITH_UID, OBJECT_KINDS, POSITION_ATTRIBUTES, UID_ATTRIBUTE_NAME } from './keys.ts';
import type { ObjectKindInfo } from './keys.ts';
import { TEXT } from './text.ts';

export type ObjectSpec = { keyword: string; name: string; uid: string; x: number | null; y: number | null; built: boolean };
export type Position = { x: number; y: number };
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
    const tag = elements.get(object.uid);
    const info = objectKind(object.keyword);
    if (tag === undefined) missing.push(object);
    else if (info && !info.tags.includes(tag)) problems.push(TEXT.wrongKindInMap(object.name, object.uid, object.keyword, tag));
  }
  return { missing, problems };
}

export function objectElement(object: ObjectSpec, staging: Position, escape: (value: string) => string): string {
  const info = objectKind(object.keyword);
  if (!info) throw new Error(TEXT.unknownKind(object.keyword));
  const attributes: [string, string][] = [
    [UID_ATTRIBUTE_NAME, object.uid],
    [POSITION_ATTRIBUTES.x, String(object.x ?? staging.x)],
    [POSITION_ATTRIBUTES.y, String(object.y ?? staging.y)],
    ...info.defaults.map(([name, value]): [string, string] => [name, value]),
  ];
  return TEXT.element(info.createTag, attributes.map(([name, value]) => TEXT.attribute(name, escape(value))));
}
