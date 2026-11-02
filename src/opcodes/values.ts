import snapshot from './snapshot.json' with { type: 'json' };
import { APOSTROPHES, COLLISION_SEPARATOR, DIGIT_PREFIX, PLACEHOLDER_KEY, STARTS_WITH_DIGIT, VALUE_GROUPS, WORD_SPLIT } from './keys.ts';

export type ValueGroup = { name: string; paramKind: string; members: ReadonlyMap<string, string>; labels: ReadonlyMap<string, string> };

const tables: Record<string, Record<string, string>> = snapshot.values;

export const memberName = (label: string): string => {
  const words = label.replace(APOSTROPHES, '').split(WORD_SPLIT).filter((word) => word !== '');
  const joined = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  return STARTS_WITH_DIGIT.test(joined) ? DIGIT_PREFIX + joined : joined;
};

const buildGroup = (name: string, kinds: readonly string[]): ValueGroup => {
  const members = new Map<string, string>();
  const labels = new Map<string, string>();
  for (const kind of kinds) {
    for (const [value, label] of Object.entries(tables[kind] ?? {})) {
      if (PLACEHOLDER_KEY.test(value)) continue;
      const base = memberName(label) || memberName(value);
      const member = members.has(base) ? base + COLLISION_SEPARATOR + memberName(value) : base;
      if (member !== '' && !members.has(member)) {
        members.set(member, value);
        labels.set(member, label);
      }
    }
  }
  return { name, paramKind: kinds[0] ?? '', members, labels };
};

export const VALUE_GROUP_LIST: readonly ValueGroup[] = VALUE_GROUPS.map(([name, kinds]) => buildGroup(name, kinds));

const BY_NAME: ReadonlyMap<string, ValueGroup> = new Map(VALUE_GROUP_LIST.map((group) => [group.name, group]));

export const valueGroup = (name: string): ValueGroup | null => BY_NAME.get(name) ?? null;

export const groupForKind = (kind: string): ValueGroup | null => VALUE_GROUP_LIST.find((group) => group.paramKind === kind) ?? null;
