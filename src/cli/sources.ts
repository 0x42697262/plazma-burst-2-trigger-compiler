import fs from 'node:fs';
import path from 'node:path';
import { isStandardLibrary } from '../lang/file-paths.ts';
import { STD_SCHEME } from '../lang/keys.ts';
import { STD_FOLDER } from './paths.ts';
import { FILE_ENCODING } from './keys.ts';

export const sourcePath = (file: string): string => (isStandardLibrary(file) ? path.join(STD_FOLDER, file.slice(STD_SCHEME.length)) : file);

export const readSourceFile = (file: string): string => fs.readFileSync(sourcePath(file), FILE_ENCODING);
