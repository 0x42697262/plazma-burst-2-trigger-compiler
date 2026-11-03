import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_EDITOR, DEFAULT_SOURCE, SNAPSHOT_FILE } from './paths.ts';
import { EDITOR_FILES, EDITOR_FLAG, FILE_ENCODING, HELP_FLAG, SOURCE_FLAG } from './keys.ts';
import { FIRST_USER_ARGUMENT, FLAG_VALUE_OFFSET, JSON_INDENT } from './constants.ts';
import { TEXT } from './text.ts';
import { readOpcodeTable, toSnapshot } from './snapshot.ts';
import type { EditorRules } from './snapshot.ts';

const argumentsList = process.argv.slice(FIRST_USER_ARGUMENT);
if (argumentsList.includes(HELP_FLAG)) {
  process.stdout.write(TEXT.usage + TEXT.lineEnd);
  process.exit(0);
}
const flagValue = (flag: string, fallback: string): string => {
  const index = argumentsList.indexOf(flag);
  return index < 0 ? fallback : argumentsList[index + FLAG_VALUE_OFFSET] ?? fallback;
};
const sourceFile = flagValue(SOURCE_FLAG, DEFAULT_SOURCE);
const editorFolder = flagValue(EDITOR_FLAG, DEFAULT_EDITOR);
const table = readOpcodeTable(fs.readFileSync(sourceFile, FILE_ENCODING));
if (!table) {
  process.stderr.write(TEXT.missingTable(sourceFile) + TEXT.lineEnd);
  process.exit(1);
}
const editorModule = async (file: string): Promise<Record<string, unknown>> => import(pathToFileURL(path.join(editorFolder, file)).href) as Promise<Record<string, unknown>>;
const keys = await editorModule(EDITOR_FILES.keys);
const kinds = await editorModule(EDITOR_FILES.kinds);
const kindOf = kinds.kindOf as (tag: string) => { shape: string } | null;
const editor: EditorRules = {
  tags: kinds.KIND_TAGS as readonly string[],
  shapeOf: (tag) => kindOf(tag)?.shape ?? null,
  defaults: keys.DEFAULTS as EditorRules['defaults'],
  gameOnly: keys.GAME_ONLY as EditorRules['gameOnly'],
  noUid: keys.NO_UID as ReadonlySet<string>,
  noPlace: keys.NO_PLACE as ReadonlySet<string>,
};
const snapshot = toSnapshot(table, editor);
fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, JSON_INDENT) + TEXT.lineEnd);
process.stdout.write(TEXT.wrote(Object.keys(snapshot.actions).length, Object.keys(snapshot.tags ?? {}).length, SNAPSHOT_FILE) + TEXT.lineEnd);
