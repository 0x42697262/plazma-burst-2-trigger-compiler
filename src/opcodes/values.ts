import snapshot from './snapshot.json' with { type: 'json' };
import {
  APOSTROPHES, BRACKETED, COLLISION_SEPARATOR, GROUP_ALIASES, IDENTIFIER_VALUE, KIND_SEPARATOR, NONE_NAME, NONE_SUFFIX, NONE_VALUE, PLACEHOLDER_KEY, STARTS_WITH_DIGIT,
  VALUE_GROUPS, WORD_GAP, WORD_SPLIT,
} from './keys.ts';

export type ValueEntry = { value: string; label: string; names: readonly string[] };
export type ValueGroup = { name: string; paramKind: string; kinds: readonly string[]; members: ReadonlyMap<string, string>; entries: readonly ValueEntry[] };

const tables: Record<string, Record<string, string>> = snapshot.values;

export const memberName = (label: string): string => {
  const words = label.replace(APOSTROPHES, '').split(WORD_SPLIT).filter((word) => word !== '');
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
};

export const shortName = (label: string): string => memberName(label.replace(BRACKETED, WORD_GAP));

const usable = (candidate: string): boolean => candidate !== '' && !STARTS_WITH_DIGIT.test(candidate);

const buildGroup = (name: string, kinds: readonly string[]): ValueGroup => {
  const members = new Map<string, string>();
  const entries: { value: string; label: string; names: string[] }[] = [];
  const rows = kinds.flatMap((kind) => Object.entries(tables[kind] ?? {})).filter(([value]) => !PLACEHOLDER_KEY.test(value));
  for (const [value, label] of rows) {
    const names: string[] = [];
    const add = (candidate: string): void => {
      if (!usable(candidate) || members.has(candidate)) return;
      members.set(candidate, value);
      names.push(candidate);
    };
    if (IDENTIFIER_VALUE.test(value)) add(value);
    const fromLabel = memberName(label);
    if (members.has(fromLabel) && members.get(fromLabel) !== value) add(fromLabel + COLLISION_SEPARATOR + memberName(value));
    else add(fromLabel);
    entries.push({ value, label, names });
  }
  const shortCounts = new Map<string, number>();
  for (const [, label] of rows) shortCounts.set(shortName(label), (shortCounts.get(shortName(label)) ?? 0) + 1);
  for (const entry of entries) {
    const candidate = shortName(entry.label);
    if (shortCounts.get(candidate) !== 1 || !usable(candidate) || members.has(candidate)) continue;
    members.set(candidate, entry.value);
    entry.names.unshift(candidate);
  }
  return { name, paramKind: kinds[0] ?? '', kinds, members, entries: entries.filter((entry) => entry.names.length > 0) };
};

export const VALUE_GROUP_LIST: readonly ValueGroup[] = VALUE_GROUPS.map(([name, kinds]) => buildGroup(name, kinds));

const BY_NAME: ReadonlyMap<string, ValueGroup> = new Map(VALUE_GROUP_LIST.map((group) => [group.name, group]));

export const valueGroup = (name: string): ValueGroup | null => BY_NAME.get(Object.hasOwn(GROUP_ALIASES, name) ? GROUP_ALIASES[name] ?? name : name) ?? null;

export const groupForKind = (kind: string): ValueGroup | null => VALUE_GROUP_LIST.find((group) => group.paramKind === kind) ?? VALUE_GROUP_LIST.find((group) => group.kinds.includes(kind)) ?? null;

export const valueTable = (kind: string): Readonly<Record<string, string>> => tables[kind] ?? {};

export const mergedKinds = (kind: string): readonly string[] => {
  const base = kind.split(KIND_SEPARATOR)[0] ?? kind;
  return base === kind ? [kind] : [base, kind];
};

const LISTS = new Map<string, ValueGroup>();

export function valueList(kind: string): ValueGroup {
  const known = LISTS.get(kind);
  if (known) return known;
  const built = buildGroup(groupForKind(kind)?.name ?? '', mergedKinds(kind));
  if (kind.includes(NONE_SUFFIX) && !built.members.has(NONE_NAME)) {
    const members = new Map(built.members);
    members.set(NONE_NAME, NONE_VALUE);
    const entries = built.entries.map((entry) => (entry.value === NONE_VALUE ? { ...entry, names: [...entry.names, NONE_NAME] } : entry));
    const withNone: ValueGroup = { ...built, members, entries };
    LISTS.set(kind, withNone);
    return withNone;
  }
  LISTS.set(kind, built);
  return built;
}

export const hasPlaceholder = (kind: string): boolean => mergedKinds(kind).some((part) => Object.keys(tables[part] ?? {}).some((value) => PLACEHOLDER_KEY.test(value)));
