import fs from 'node:fs';
import path from 'node:path';
import { emitXml } from '../../emit/xml-emitter.ts';
import { emitText, joinTextBlocks } from '../../emit/trigger-text-emitter.ts';
import { appendToMap } from '../../emit/merge.ts';
import { HELLO } from '../../samples/hello.fixture.ts';
import { GAME_MAPS_DIRECTORY, MAP_FILE, OUTPUT_DIRECTORY, TEXT_FILE, XML_FILE } from './paths.ts';
import { BASE_MAP, FILE_ENCODING, GAME_MAP_FLAG, HELP_FLAG, INTO_FLAG } from './keys.ts';
import { FIRST_USER_ARGUMENT, FLAG_VALUE_OFFSET } from './constants.ts';
import { TEXT } from './text.ts';

const argumentsList = process.argv.slice(FIRST_USER_ARGUMENT);
if (argumentsList.includes(HELP_FLAG)) {
  process.stdout.write(TEXT.usage + TEXT.lineEnd);
  process.exit(0);
}

const write = (file: string, content: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  process.stdout.write(TEXT.wrote(file) + TEXT.lineEnd);
};

const intoIndex = argumentsList.indexOf(INTO_FLAG);
const intoFile = intoIndex < 0 ? null : argumentsList[intoIndex + FLAG_VALUE_OFFSET] ?? null;
const baseMap = intoFile ? fs.readFileSync(intoFile, FILE_ENCODING) : BASE_MAP;

const xml = emitXml(HELLO);
const map = appendToMap(baseMap, xml);
write(path.join(OUTPUT_DIRECTORY, XML_FILE), xml);
write(path.join(OUTPUT_DIRECTORY, TEXT_FILE), joinTextBlocks(emitText(HELLO)));
write(path.join(OUTPUT_DIRECTORY, MAP_FILE), map);
if (argumentsList.includes(GAME_MAP_FLAG)) write(path.join(GAME_MAPS_DIRECTORY, XML_FILE), map);
