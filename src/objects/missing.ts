import { CONSTRUCTORS } from './keys.ts';
import type { ObjectSpec } from './objects.ts';
import { TEXT } from './text.ts';

export function missingHostObject(object: ObjectSpec): string {
  const constructorName = Object.entries(CONSTRUCTORS).find(([, info]) => info.keyword === object.keyword)?.[0] ?? null;
  return constructorName === null ? TEXT.missing(object.name, object.uid) : TEXT.missingWithHint(object.name, object.uid, constructorName);
}
