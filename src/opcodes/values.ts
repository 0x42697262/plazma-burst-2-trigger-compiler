import snapshot from './snapshot.json' with { type: 'json' };
import { APOSTROPHES, COLLISION_SEPARATOR, IDENTIFIER_VALUE, PLACEHOLDER_KEY, STARTS_WITH_DIGIT, VALUE_GROUPS, WORD_SPLIT } from './keys.ts';

export type ValueEntry = { value: string; label: string; names: readonly string[] };
export type ValueGroup = { name: string; paramKind: string; members: ReadonlyMap<string, string>; entries: readonly ValueEntry[] };

const tables: Record<string, Record<string, string>> = snapshot.values;

export const memberName = (label: string): string => {
  const words = label.replace(APOSTROPHES, '').split(WORD_SPLIT).filter((word) => word !== '');
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
};

const buildGroup = (name: string, kinds: readonly string[]): ValueGroup => {
  const members = new Map<string, string>();
  const entries: ValueEntry[] = [];
  for (const kind of kinds) {
    for (const [value, label] of Object.entries(tables[kind] ?? {})) {
      if (PLACEHOLDER_KEY.test(value)) continue;
      const names: string[] = [];
      const add = (candidate: string): void => {
        if (candidate === '' || STARTS_WITH_DIGIT.test(candidate) || members.has(candidate)) return;
        members.set(candidate, value);
        names.push(candidate);
      };
      if (IDENTIFIER_VALUE.test(value)) add(value);
      const fromLabel = memberName(label);
      if (members.has(fromLabel) && members.get(fromLabel) !== value) add(fromLabel + COLLISION_SEPARATOR + memberName(value));
      else add(fromLabel);
      if (names.length > 0) entries.push({ value, label, names });
    }
  }
  return { name, paramKind: kinds[0] ?? '', members, entries };
};

export const VALUE_GROUP_LIST: readonly ValueGroup[] = VALUE_GROUPS.map(([name, kinds]) => buildGroup(name, kinds));

const BY_NAME: ReadonlyMap<string, ValueGroup> = new Map(VALUE_GROUP_LIST.map((group) => [group.name, group]));

export const valueGroup = (name: string): ValueGroup | null => BY_NAME.get(name) ?? null;

export const groupForKind = (kind: string): ValueGroup | null => VALUE_GROUP_LIST.find((group) => group.paramKind === kind) ?? null;
