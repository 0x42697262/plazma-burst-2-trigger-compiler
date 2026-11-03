import vm from 'node:vm';
import { OPCODES_GLOBAL, RECTANGLE_SHAPE } from './keys.ts';

export type SnapshotAction = { alias?: string; a: string; b: string; desc: string };
export type ValueTables = Record<string, Record<string, string>>;
export type ParamRow = { cls: string; name: string; kind: string; title: string; desc: string };
export type GameOnlyParam = { kind: string; title: string; desc: string; value: string };
export type Category = { name: string; color: string };
export type TagRules = { uid: boolean; place: boolean; rect: boolean; defaults: Record<string, string>; gameOnly: Record<string, GameOnlyParam> };
export type Snapshot = {
  source: string; fetched: string; actions: Record<string, SnapshotAction>; values: ValueTables;
  params?: ParamRow[]; markPairs?: Record<string, string>; categories?: Category[]; tags?: Record<string, TagRules>;
};

type RawAction = { desc: string; a: string; b: string; alias?: string };
type RawTable = {
  source: string; fetched: string; actions: Record<string, RawAction>; values?: ValueTables; params?: ParamRow[]; markPairs?: Record<string, string>; categories?: Category[];
};

export type EditorRules = {
  tags: readonly string[];
  shapeOf: (tag: string) => string | null;
  defaults: Readonly<Record<string, Readonly<Record<string, string>>>>;
  gameOnly: Readonly<Record<string, Readonly<Record<string, GameOnlyParam>>>>;
  noUid: ReadonlySet<string>;
  noPlace: ReadonlySet<string>;
};

export function readOpcodeTable(code: string): RawTable | null {
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  const table = sandbox[OPCODES_GLOBAL] as RawTable | undefined;
  return table?.actions ? table : null;
}

const byNumber = (first: string, second: string): number => Number(first) - Number(second);

const paramRow = (row: ParamRow): ParamRow => ({ cls: row.cls, name: row.name, kind: row.kind, title: row.title, desc: row.desc });

const gameOnlyParam = (param: GameOnlyParam): GameOnlyParam => ({ kind: param.kind, title: param.title, desc: param.desc, value: param.value });

export function tagRules(editor: EditorRules): Record<string, TagRules> {
  const tags: Record<string, TagRules> = {};
  for (const tag of editor.tags) {
    const gameOnly = Object.fromEntries(Object.entries(editor.gameOnly[tag] ?? {}).map(([name, param]) => [name, gameOnlyParam(param)]));
    tags[tag] = {
      uid: !editor.noUid.has(tag), place: !editor.noPlace.has(tag), rect: editor.shapeOf(tag) === RECTANGLE_SHAPE,
      defaults: { ...editor.defaults[tag] }, gameOnly,
    };
  }
  return tags;
}

export function toSnapshot(table: RawTable, editor: EditorRules | null = null): Snapshot {
  const actions: Record<string, SnapshotAction> = {};
  for (const key of Object.keys(table.actions).sort(byNumber)) {
    const raw = table.actions[key];
    if (!raw) continue;
    actions[key] = raw.alias ? { alias: raw.alias, a: raw.a, b: raw.b, desc: raw.desc } : { a: raw.a, b: raw.b, desc: raw.desc };
  }
  const snapshot: Snapshot = { source: table.source, fetched: table.fetched, actions, values: table.values ?? {} };
  if (table.params) snapshot.params = [...table.params].map(paramRow);
  if (table.markPairs) snapshot.markPairs = { ...table.markPairs };
  if (table.categories) snapshot.categories = [...table.categories].map((category) => ({ name: category.name, color: category.color }));
  if (editor) snapshot.tags = tagRules(editor);
  return snapshot;
}
