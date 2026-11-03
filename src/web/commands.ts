import type { Options } from './pipeline.ts';
import { DEFAULT_GUARD } from './constants.ts';
import { DEFAULT_TARGET } from '../pcode/keys.ts';
import { TEXT } from './text.ts';

export type Command = { title: string; detail: string; shortcut: string; run: () => void };

const subsequence = (text: string, query: string): number | null => {
  let position = 0;
  let gaps = 0;
  for (const character of query) {
    const found = text.indexOf(character, position);
    if (found < 0) return null;
    gaps += found - position;
    position = found + 1;
  }
  return gaps;
};

export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return [...commands];
  const scored: { command: Command; score: number }[] = [];
  for (const command of commands) {
    const title = command.title.toLowerCase();
    const contained = title.indexOf(wanted);
    const gaps = contained >= 0 ? null : subsequence(title, wanted);
    if (contained < 0 && gaps === null) continue;
    scored.push({ command, score: contained >= 0 ? contained : title.length + (gaps ?? 0) });
  }
  return scored.sort((first, second) => first.score - second.score).map((entry) => entry.command);
}

export function optionChips(options: Options, environmentCount: number): string[] {
  return [
    options.target !== DEFAULT_TARGET ? TEXT.chips.target(options.target) : null,
    options.obfuscate ? TEXT.chips.obfuscate : null,
    options.directIndex ? TEXT.chips.directIndex : null,
    options.numberText ? null : TEXT.chips.numberText,
    options.replace ? TEXT.chips.replace : null,
    options.prefix === '' ? null : TEXT.chips.prefix(options.prefix),
    options.nameSeed.trim() === '' ? null : TEXT.chips.nameSeed,
    options.guard === DEFAULT_GUARD ? null : options.guard === 0 ? TEXT.chips.noGuard : TEXT.chips.guard(options.guard),
    environmentCount === 0 ? null : TEXT.chips.environment(environmentCount),
  ].filter((chip) => chip !== null);
}

export const shortcutLabel = (keys: readonly string[], mac: boolean): string => keys.map((key) => (mac ? TEXT.macKeys[key] ?? key : TEXT.otherKeys[key] ?? key)).join(mac ? '' : TEXT.keyJoin);
