import fs from 'node:fs';
import { DEFAULT_SOURCE, SNAPSHOT_FILE } from './paths.ts';
import { FILE_ENCODING, HELP_FLAG, SOURCE_FLAG } from './keys.ts';
import { FIRST_USER_ARGUMENT, FLAG_VALUE_OFFSET, JSON_INDENT } from './constants.ts';
import { TEXT } from './text.ts';
import { readOpcodeTable, toSnapshot } from './snapshot.ts';

const argumentsList = process.argv.slice(FIRST_USER_ARGUMENT);
if (argumentsList.includes(HELP_FLAG)) {
  process.stdout.write(TEXT.usage + TEXT.lineEnd);
  process.exit(0);
}
const flagIndex = argumentsList.indexOf(SOURCE_FLAG);
const sourceFile = flagIndex < 0 ? DEFAULT_SOURCE : argumentsList[flagIndex + FLAG_VALUE_OFFSET] ?? DEFAULT_SOURCE;
const table = readOpcodeTable(fs.readFileSync(sourceFile, FILE_ENCODING));
if (!table) {
  process.stderr.write(TEXT.missingTable(sourceFile) + TEXT.lineEnd);
  process.exit(1);
}
const snapshot = toSnapshot(table);
fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, JSON_INDENT) + TEXT.lineEnd);
process.stdout.write(TEXT.wrote(Object.keys(snapshot.actions).length, SNAPSHOT_FILE) + TEXT.lineEnd);
