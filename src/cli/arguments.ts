import { FLAG, FLAG_MARK, VALUE_FLAGS } from './keys.ts';
import { TEXT } from './text.ts';

export type Arguments = { files: string[]; values: Map<string, string[]>; flags: Set<string> };

export class UsageError extends Error {}

export function parseArguments(list: readonly string[]): Arguments {
  const parsed: Arguments = { files: [], values: new Map(), flags: new Set() };
  for (let position = 0; position < list.length; position++) {
    const argument = list[position] ?? '';
    if (VALUE_FLAGS.has(argument)) {
      const value = list[position + 1];
      if (value === undefined) throw new UsageError(TEXT.missingValue(argument));
      parsed.values.set(argument, [...(parsed.values.get(argument) ?? []), value]);
      position += 1;
    } else if (Object.values<string>(FLAG).includes(argument)) {
      parsed.flags.add(argument);
    } else if (argument.startsWith(FLAG_MARK)) {
      throw new UsageError(TEXT.unknownFlag(argument));
    } else {
      parsed.files.push(argument);
    }
  }
  return parsed;
}

export const lastValue = (parsed: Arguments, flag: string): string | null => parsed.values.get(flag)?.at(-1) ?? null;
