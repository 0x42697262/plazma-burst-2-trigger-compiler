import { CONTINUATION_SEPARATOR, INTERNAL_MARK, PREFIX_PATTERN, SEED_PREFIX_LETTER, TRIGGER_MARK, USER_SEPARATOR, VARIABLE_MARK } from './keys.ts';
import { BASE36, FNV_OFFSET_BASIS, FNV_PRIME } from './constants.ts';
import { TEXT } from './text.ts';

export class CompileError extends Error {}

export function seededPrefix(seed: string): string {
  let hash = FNV_OFFSET_BASIS >>> 0;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return SEED_PREFIX_LETTER + hash.toString(BASE36);
}

export type Names = {
  prefix: string;
  variable: (name: string) => string;
  internalVariable: (name: string) => string;
  triggerUid: (label: string) => string;
  freshLabel: (hint: string) => string;
  continuationLabel: (label: string, part: number) => string;
  ownsVariable: (name: string) => boolean;
  ownsUid: (uid: string) => boolean;
};

const isInternal = (name: string): boolean => name.startsWith(INTERNAL_MARK);

export function createNames(prefix: string): Names {
  if (!PREFIX_PATTERN.test(prefix)) throw new CompileError(TEXT.badPrefix(prefix));
  let counter = 0;
  const qualify = (name: string): string => (isInternal(name) ? `${prefix}${name}` : `${prefix}${USER_SEPARATOR}${name}`);
  return {
    prefix,
    variable: (name) => `${VARIABLE_MARK}${prefix}${USER_SEPARATOR}${name}${VARIABLE_MARK}`,
    internalVariable: (name) => `${VARIABLE_MARK}${prefix}${INTERNAL_MARK}${name}${VARIABLE_MARK}`,
    triggerUid: (label) => `${TRIGGER_MARK}${qualify(label)}`,
    freshLabel: (hint) => {
      counter += 1;
      return `${INTERNAL_MARK}${hint}${counter}`;
    },
    continuationLabel: (label, part) => `${label}${CONTINUATION_SEPARATOR}${part}`,
    ownsVariable: (name) => [USER_SEPARATOR, INTERNAL_MARK].some((mark) => name.startsWith(`${VARIABLE_MARK}${prefix}${mark}`)),
    ownsUid: (uid) => [USER_SEPARATOR, INTERNAL_MARK].some((mark) => uid.startsWith(`${TRIGGER_MARK}${prefix}${mark}`)),
  };
}
