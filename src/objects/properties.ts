import snapshot from '../opcodes/snapshot.json' with { type: 'json' };
import { ANY_TAG, CONSTRUCTORS, NO_VALUE_KIND, POSITION_ATTRIBUTES, SIZE_ATTRIBUTES, UNLISTED_KINDS } from './keys.ts';
import type { ConstructorInfo } from './keys.ts';

export type Property = { name: string; kind: string; title: string; desc: string; fallback: string | null; gameOnly: boolean };
type ParamRow = { cls: string; name: string; kind: string; title: string; desc: string };
type GameOnlyParam = { kind: string; title: string; desc: string; value: string };
type TagRules = { uid: boolean; place: boolean; rect: boolean; defaults: Record<string, string>; gameOnly: Record<string, GameOnlyParam> };

const PARAMS: readonly ParamRow[] = snapshot.params;
const MARK_PAIRS: Readonly<Record<string, string>> = snapshot.markPairs;
const TAGS: Readonly<Record<string, TagRules>> = snapshot.tags;

export const tagRules = (tag: string): TagRules | null => (Object.hasOwn(TAGS, tag) ? TAGS[tag] ?? null : null);

const rowOf = (tag: string, name: string): ParamRow | null =>
  PARAMS.find((row) => row.name === name && row.cls === tag) ?? PARAMS.find((row) => row.name === name && row.cls === ANY_TAG) ?? null;

function describe(tag: string, name: string, rules: TagRules): Property {
  const gameOnly = rules.gameOnly[name];
  const own = PARAMS.find((row) => row.name === name && row.cls === tag);
  const row = own ?? (gameOnly ? null : rowOf(tag, name));
  const kind = own?.kind ?? gameOnly?.kind ?? row?.kind ?? UNLISTED_KINDS[tag]?.[name] ?? NO_VALUE_KIND;
  const fallback = rules.defaults[name] ?? gameOnly?.value ?? null;
  return { name, kind, title: own?.title ?? gameOnly?.title ?? row?.title ?? name, desc: own?.desc ?? gameOnly?.desc ?? row?.desc ?? '', fallback, gameOnly: gameOnly !== undefined };
}

const TABLES = new Map<string, readonly Property[]>();

export function propertiesOf(tag: string): readonly Property[] {
  const known = TABLES.get(tag);
  if (known) return known;
  const rules = tagRules(tag);
  if (!rules) return [];
  const names = [
    ...(rules.place ? [POSITION_ATTRIBUTES.x, POSITION_ATTRIBUTES.y] : []),
    ...(rules.rect ? [SIZE_ATTRIBUTES.w, SIZE_ATTRIBUTES.h] : []),
    ...Object.keys(rules.defaults), ...Object.keys(rules.gameOnly),
  ];
  const table = [...new Set(names)].map((name) => describe(tag, name, rules));
  TABLES.set(tag, table);
  return table;
}

export const propertyOf = (tag: string, name: string): Property | null => propertiesOf(tag).find((property) => property.name === name) ?? null;

export const markValueKind = (mark: string): string => MARK_PAIRS[mark] ?? NO_VALUE_KIND;

export const markValueKinds = (): readonly string[] => [...new Set(Object.values(MARK_PAIRS))].filter((kind) => kind !== NO_VALUE_KIND);

export const constructorOf = (name: string): ConstructorInfo | null => (Object.hasOwn(CONSTRUCTORS, name) ? CONSTRUCTORS[name] ?? null : null);

export const constructorForTag = (tag: string): string | null => Object.entries(CONSTRUCTORS).find(([, info]) => info.tag === tag)?.[0] ?? null;

export const tagsWithProperty = (name: string): readonly string[] =>
  Object.values(CONSTRUCTORS).map((info) => info.tag).filter((tag) => propertyOf(tag, name) !== null);
