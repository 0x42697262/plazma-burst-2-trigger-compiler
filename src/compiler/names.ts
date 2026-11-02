import { CONTINUATION_SEPARATOR, INTERNAL_MARK, PREFIX_PATTERN, TRIGGER_MARK, USER_SEPARATOR, VARIABLE_MARK } from './keys.ts';
import { TEXT } from './text.ts';

export class CompileError extends Error {}

export type Names = {
  prefix: string;
  variable: (name: string) => string;
  internalVariable: (name: string) => string;
  triggerUid: (label: string) => string;
  freshLabel: (hint: string) => string;
  continuationLabel: (label: string, part: number) => string;
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
  };
}
