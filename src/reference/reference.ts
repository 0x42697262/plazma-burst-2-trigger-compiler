import snapshot from '../opcodes/snapshot.json' with { type: 'json' };
import { OPCODES, opcodeByName } from '../opcodes/table.ts';
import type { Opcode } from '../opcodes/table.ts';
import { SKIPS_NEXT, SYNC_ACTIONS } from '../opcodes/constants.ts';
import { SIMULATED_ACTIONS } from '../sim/actions.ts';
import { VALUE_GROUP_LIST, groupForKind, valueGroup, valueList } from '../opcodes/values.ts';
import { CONSTRUCTORS, MARK_VALUE, NO_VALUE_KIND, OBJECT_KINDS } from '../objects/keys.ts';
import { constructorOf, markValueKind, propertiesOf } from '../objects/properties.ts';
import { REFERENCE_KINDS } from '../objects/constants.ts';
import { describeKind } from '../objects/value-check.ts';
import { BUILTIN, COMPILE_TIME_BUILTIN, CONTEXTUAL, KEYWORDS } from '../lang/keys.ts';
import {
  CATEGORY_SEPARATOR, ENGINE_MARK_CONSTRUCTOR, ENTRY_KIND, ID, ID_PREFIX, MARK_KIND, NOTE_SEPARATOR, OP_PREFIX, ROOT_ORDER, SIDE_NAMES, UNCATEGORIZED,
} from './keys.ts';
import { RANK, SEARCH_LIMIT } from './constants.ts';
import { REFERENCE_TEXT as TEXT } from './text.ts';

export type EntryKind = (typeof ENTRY_KIND)[keyof typeof ENTRY_KIND];
export type ReferenceField = { name: string; detail: string; summary: string; link: string | null; insert: string | null; color: string | null };
export type ReferenceSection = { title: string; fields: ReferenceField[] };
export type ReferenceEntry = {
  id: string; kind: EntryKind; title: string; summary: string; signature: string | null; color: string | null; insert: string | null; parent: string | null;
  sections: ReferenceSection[];
};

const CATEGORY_COLORS: ReadonlyMap<string, string> = new Map(snapshot.categories.map((category) => [category.name, category.color]));
const MARKS: Readonly<Record<string, string>> = snapshot.values.engine_mark;

export const actionName = (opcode: Opcode): string => opcode.alias ?? OP_PREFIX + String(opcode.number);

export const categoryOf = (opcode: Opcode): string => {
  const at = opcode.description.indexOf(CATEGORY_SEPARATOR);
  return at < 0 ? UNCATEGORIZED : opcode.description.slice(0, at);
};

export const descriptionOf = (opcode: Opcode): string => {
  const at = opcode.description.indexOf(CATEGORY_SEPARATOR);
  return at < 0 ? opcode.description : opcode.description.slice(at + CATEGORY_SEPARATOR.length);
};

export const actionNotes = (opcode: Opcode): string[] => [
  SIMULATED_ACTIONS.has(opcode.number) ? TEXT.notes.simulated : null,
  SKIPS_NEXT.has(opcode.number) ? TEXT.notes.skips : null,
  opcode.templateReplacedA ? TEXT.notes.replacesA : null,
  opcode.templateReplacedB ? TEXT.notes.replacesB : null,
  opcode.avoided ? TEXT.notes.avoided : null,
  SYNC_ACTIONS.has(opcode.number) ? TEXT.notes.sync : null,
].filter((note) => note !== null);

export const kindMeaning = (kind: string): string => TEXT.kinds[kind] ?? describeKind(kind);

const field = (name: string, detail: string, summary: string, link: string | null, insert: string | null = null, color: string | null = null): ReferenceField =>
  ({ name, detail, summary, link, insert, color });

const entry = (id: string, kind: EntryKind, title: string, summary: string, parent: string | null, sections: ReferenceSection[], extra: Partial<ReferenceEntry> = {}): ReferenceEntry =>
  ({ id, kind, title, summary, signature: null, color: null, insert: null, parent, sections, ...extra });

const ALL_OPCODES: readonly Opcode[] = [...OPCODES.values()].sort((first, second) => first.number - second.number);

const objectsForKind = (kind: string): string[] => Object.entries(CONSTRUCTORS)
  .filter(([, info]) => info.keyword !== null && OBJECT_KINDS[info.keyword]?.paramKind === kind)
  .map(([name]) => name);

export function linkForKind(kind: string): string | null {
  if (Object.hasOwn(REFERENCE_KINDS, kind)) {
    const name = Object.entries(CONSTRUCTORS).find(([, info]) => info.tag === REFERENCE_KINDS[kind])?.[0];
    return name === undefined ? null : ID_PREFIX.object + name;
  }
  if (kind === MARK_KIND) return ID.marks;
  const group = groupForKind(kind);
  return group === null ? null : ID_PREFIX.values + group.name;
}

export const actionsTaking = (kind: string): Opcode[] => ALL_OPCODES.filter((opcode) => opcode.paramA === kind || opcode.paramB === kind);

const actionField = (opcode: Opcode): ReferenceField =>
  field(actionName(opcode), TEXT.actionSignature(actionName(opcode), opcode.paramA, opcode.paramB), descriptionOf(opcode), ID_PREFIX.action + opcode.number, TEXT.actionInsert(actionName(opcode)), CATEGORY_COLORS.get(categoryOf(opcode)) ?? null);

function buildEntries(): Map<string, ReferenceEntry> {
  const entries = new Map<string, ReferenceEntry>();
  const add = (value: ReferenceEntry): void => {
    entries.set(value.id, value);
  };
  const root = (id: string): readonly [string, string] => TEXT.roots[id] ?? [id, ''];
  const categories = new Map<string, Opcode[]>();
  for (const opcode of ALL_OPCODES) categories.set(categoryOf(opcode), [...(categories.get(categoryOf(opcode)) ?? []), opcode]);
  const kinds = [...new Set(ALL_OPCODES.flatMap((opcode) => [opcode.paramA, opcode.paramB]))].sort();

  add(entry(ID.root, ENTRY_KIND.root, ...root(ID.root), null, [{ title: '', fields: ROOT_ORDER.map((id) => field(root(id)[0], '', root(id)[1], id)) }]));
  add(entry(ID.actions, ENTRY_KIND.root, ...root(ID.actions), ID.root, [{
    title: '', fields: [...categories].map(([name, opcodes]) => field(name, TEXT.categorySummary(opcodes.length), '', ID_PREFIX.category + name, null, CATEGORY_COLORS.get(name) ?? null)),
  }]));
  for (const [name, opcodes] of categories) {
    add(entry(ID_PREFIX.category + name, ENTRY_KIND.category, name, TEXT.categorySummary(opcodes.length), ID.actions, [{ title: '', fields: opcodes.map(actionField) }], { color: CATEGORY_COLORS.get(name) ?? null }));
  }
  for (const opcode of ALL_OPCODES) {
    const category = categoryOf(opcode);
    const sides = [[SIDE_NAMES.a, opcode.paramA], [SIDE_NAMES.b, opcode.paramB]] as const;
    const notes = actionNotes(opcode);
    add(entry(ID_PREFIX.action + opcode.number, ENTRY_KIND.action, actionName(opcode), descriptionOf(opcode), ID_PREFIX.category + category, [
      { title: '', fields: sides.map(([side, kind]) => field(TEXT.side(side), TEXT.sideDetail(kind), kindMeaning(kind), ID_PREFIX.kind + kind)) },
      ...(notes.length === 0 ? [] : [{ title: TEXT.notesField, fields: [field(notes.join(NOTE_SEPARATOR), '', '', null)] }]),
    ], {
      signature: TEXT.actionSignature(actionName(opcode), opcode.paramA, opcode.paramB), insert: TEXT.actionInsert(actionName(opcode)),
      color: CATEGORY_COLORS.get(category) ?? null,
    }));
  }

  add(entry(ID.kinds, ENTRY_KIND.root, ...root(ID.kinds), ID.root, [{ title: '', fields: kinds.map((kind) => field(kind, TEXT.kindDetail(actionsTaking(kind).length), kindMeaning(kind), ID_PREFIX.kind + kind)) }]));
  for (const kind of kinds) {
    const objects = objectsForKind(kind).map((name) => field(TEXT.objectFor(name), '', '', ID_PREFIX.object + name));
    const group = groupForKind(kind);
    const values = group === null ? [] : [field(group.name, TEXT.valuesSummary(group.entries.length, group.kinds), '', ID_PREFIX.values + group.name)];
    add(entry(ID_PREFIX.kind + kind, ENTRY_KIND.kind, kind, TEXT.kindSummary(kind, kindMeaning(kind)), ID.kinds, [
      ...([...objects, ...values].length === 0 ? [] : [{ title: '', fields: [...objects, ...values] }]),
      { title: TEXT.takenBy, fields: actionsTaking(kind).map(actionField) },
    ]));
  }

  add(entry(ID.objects, ENTRY_KIND.root, ...root(ID.objects), ID.root, [{
    title: '', fields: Object.entries(CONSTRUCTORS).map(([name, info]) => field(name, TEXT.tagName(info.tag), '', ID_PREFIX.object + name)),
  }]));
  for (const [name, info] of Object.entries(CONSTRUCTORS)) {
    const actions = info.keyword === null ? [] : actionsTaking(OBJECT_KINDS[info.keyword]?.paramKind ?? '');
    const properties = propertiesOf(info.tag).map((property) =>
      field(property.name, TEXT.propertyDetail(describeKind(property.kind), property.fallback), TEXT.propertySummary(property.title, property.desc), linkForKind(property.kind), TEXT.propertyInsert(property.name)));
    if (name === ENGINE_MARK_CONSTRUCTOR) properties.push(field(MARK_VALUE, '', TEXT.roots[ID.marks]?.[1] ?? '', ID.marks, TEXT.propertyInsert(MARK_VALUE)));
    add(entry(ID_PREFIX.object + name, ENTRY_KIND.object, name, TEXT.objectSummary(info.tag, info.keyword), ID.objects, [
      { title: '', fields: properties },
      ...(actions.length === 0 ? [] : [{ title: TEXT.takenBy, fields: actions.map(actionField) }]),
    ], { signature: TEXT.objectSignature(name, info.positional, info.actions === true), insert: TEXT.objectInsert(name, info.positional, info.actions === true) }));
  }

  add(entry(ID.values, ENTRY_KIND.root, ...root(ID.values), ID.root, [{
    title: '', fields: VALUE_GROUP_LIST.map((group) => field(group.name, TEXT.valuesSummary(group.entries.length, group.kinds), '', ID_PREFIX.values + group.name)),
  }]));
  for (const group of VALUE_GROUP_LIST) {
    const taking = group.kinds.flatMap((kind) => actionsTaking(kind));
    add(entry(ID_PREFIX.values + group.name, ENTRY_KIND.values, group.name, TEXT.valuesSummary(group.entries.length, group.kinds), ID.values, [
      { title: '', fields: group.entries.map((value) => field(value.names[0] ?? value.value, TEXT.valueDetail(value.value), value.label, null, TEXT.valueSignature(group.name, value.names[0] ?? value.value))) },
      ...(taking.length === 0 ? [] : [{ title: TEXT.takenBy, fields: taking.map(actionField) }]),
    ]));
  }

  add(entry(ID.marks, ENTRY_KIND.root, ...root(ID.marks), ID.root, [{
    title: '', fields: Object.entries(MARKS).map(([mark, label]) => {
      const kind = markValueKind(mark);
      return field(mark, TEXT.markDetail(kind === NO_VALUE_KIND ? TEXT.noValue : describeKind(kind)), label, ID_PREFIX.mark + mark, TEXT.markInsert(mark, kind !== NO_VALUE_KIND));
    }),
  }]));
  for (const [mark, label] of Object.entries(MARKS)) {
    const kind = markValueKind(mark);
    const takesValue = kind !== NO_VALUE_KIND;
    add(entry(ID_PREFIX.mark + mark, ENTRY_KIND.mark, mark, TEXT.markSummary(label), ID.marks, [
      { title: '', fields: [field(MARK_VALUE, takesValue ? describeKind(kind) : TEXT.noValue, '', takesValue ? linkForKind(kind) : null)] },
    ], { insert: TEXT.markInsert(mark, takesValue), signature: TEXT.markInsert(mark, takesValue) }));
  }

  const builtinNames = [...Object.values(BUILTIN), ...Object.values(COMPILE_TIME_BUILTIN)];
  add(entry(ID.builtins, ENTRY_KIND.root, ...root(ID.builtins), ID.root, [{
    title: '', fields: builtinNames.map((name) => field(name, TEXT.builtins[name]?.[0] ?? name, TEXT.builtins[name]?.[1] ?? '', ID_PREFIX.builtin + name, TEXT.builtinInsert(name))),
  }]));
  for (const name of builtinNames) {
    const [signature, summary] = TEXT.builtins[name] ?? [name, ''];
    add(entry(ID_PREFIX.builtin + name, ENTRY_KIND.builtin, name, summary, ID.builtins, [], { signature, insert: TEXT.builtinInsert(name) }));
  }
  const keywordNames = [...KEYWORDS, ...Object.values(CONTEXTUAL)].filter((name) => TEXT.keywords[name] !== undefined);
  add(entry(ID.language, ENTRY_KIND.root, ...root(ID.language), ID.root, [{
    title: '', fields: keywordNames.map((name) => field(name, '', TEXT.keywords[name] ?? '', ID_PREFIX.keyword + name, TEXT.keywordInsert(name))),
  }]));
  for (const name of keywordNames) add(entry(ID_PREFIX.keyword + name, ENTRY_KIND.keyword, name, TEXT.keywords[name] ?? '', ID.language, [], { insert: TEXT.keywordInsert(name) }));
  return entries;
}

let cache: Map<string, ReferenceEntry> | null = null;

const all = (): Map<string, ReferenceEntry> => {
  cache ??= buildEntries();
  return cache;
};

export const referenceEntry = (id: string): ReferenceEntry | null => all().get(id) ?? null;

export const referenceEntries = (): readonly ReferenceEntry[] => [...all().values()];

export function breadcrumbs(id: string): ReferenceEntry[] {
  const trail: ReferenceEntry[] = [];
  for (let current = referenceEntry(id); current !== null; current = current.parent === null ? null : referenceEntry(current.parent)) trail.unshift(current);
  return trail;
}

export function searchReference(query: string): ReferenceEntry[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return [];
  const ranked: { value: ReferenceEntry; rank: number }[] = [];
  for (const value of all().values()) {
    if (value.kind === ENTRY_KIND.root) continue;
    const title = value.title.toLowerCase();
    const number = value.kind === ENTRY_KIND.action ? value.id.slice(ID_PREFIX.action.length) : null;
    const rank = title === wanted || number === wanted ? RANK.exact : title.startsWith(wanted) ? RANK.prefix : title.includes(wanted) ? RANK.title
      : value.summary.toLowerCase().includes(wanted) ? RANK.summary : null;
    if (rank !== null) ranked.push({ value, rank });
  }
  return ranked.sort((first, second) => first.rank - second.rank || first.value.title.localeCompare(second.value.title)).slice(0, SEARCH_LIMIT).map((item) => item.value);
}

export function referenceIdFor(word: string, group: string | null = null): string | null {
  if (group !== null && valueGroup(group) !== null) return ID_PREFIX.values + (valueGroup(group)?.name ?? group);
  const opcode = opcodeByName(word);
  if (opcode) return ID_PREFIX.action + opcode.number;
  if (constructorOf(word) !== null) return ID_PREFIX.object + word;
  if (valueGroup(word) !== null) return ID_PREFIX.values + (valueGroup(word)?.name ?? word);
  if (TEXT.builtins[word] !== undefined) return ID_PREFIX.builtin + word;
  if (TEXT.keywords[word] !== undefined) return ID_PREFIX.keyword + word;
  if (Object.hasOwn(MARKS, word)) return ID_PREFIX.mark + word;
  return valueList(MARK_KIND).members.has(word) ? ID_PREFIX.mark + (valueList(MARK_KIND).members.get(word) ?? word) : null;
}
