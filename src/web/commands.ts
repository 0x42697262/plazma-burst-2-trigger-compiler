import type { Options } from './pipeline.ts';
import { DEFAULT_GUARD } from './constants.ts';
import { DEFAULT_TARGET } from '../pcode/keys.ts';
import { TAMPER_MODE } from '../tamper/keys.ts';
import { TEXT } from './text.ts';
import { ELEMENT, WORD_GAP } from './keys.ts';

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
  const words = wanted.split(WORD_GAP).filter((word) => word !== '');
  const byWords: { command: Command; score: number }[] = [];
  const byLetters: { command: Command; score: number }[] = [];
  for (const command of commands) {
    const title = command.title.toLowerCase();
    const positions = words.map((word) => title.indexOf(word));
    if (positions.every((position) => position >= 0)) {
      byWords.push({ command, score: positions.reduce((total, position) => total + position, 0) });
      continue;
    }
    const gaps = subsequence(title, wanted);
    if (gaps !== null) byLetters.push({ command, score: title.length + gaps });
  }
  const scored = byWords.length > 0 ? byWords : byLetters;
  return scored.sort((first, second) => first.score - second.score).map((entry) => entry.command);
}

export type Chip = { label: string; setting: string };

export function optionChips(options: Options, environmentCount: number): Chip[] {
  const chip = (shown: boolean, label: string, setting: string): Chip | null => (shown ? { label, setting } : null);
  return [
    chip(options.target !== DEFAULT_TARGET, TEXT.chips.target(options.target), ELEMENT.target),
    chip(options.obfuscate, TEXT.chips.obfuscate, ELEMENT.obfuscate),
    chip(options.tamper !== TAMPER_MODE.off, TEXT.chips.tamper(options.tamper), ELEMENT.tamperCheck),
    chip(options.directIndex, TEXT.chips.directIndex, ELEMENT.directIndex),
    chip(!options.numberText, TEXT.chips.numberText, ELEMENT.numberText),
    chip(options.replace, TEXT.chips.replace, ELEMENT.replace),
    chip(options.prefix !== '', TEXT.chips.prefix(options.prefix), ELEMENT.prefix),
    chip(options.nameSeed.trim() !== '', TEXT.chips.nameSeed, ELEMENT.nameSeed),
    chip(options.guard !== DEFAULT_GUARD, options.guard === 0 ? TEXT.chips.noGuard : TEXT.chips.guard(options.guard), ELEMENT.guard),
    chip(environmentCount !== 0, TEXT.chips.environment(environmentCount), ELEMENT.environment),
  ].filter((entry) => entry !== null);
}

export const shortcutLabel = (keys: readonly string[], mac: boolean): string => keys.map((key) => (mac ? TEXT.macKeys[key] ?? key : TEXT.otherKeys[key] ?? key)).join(mac ? '' : TEXT.keyJoin);
