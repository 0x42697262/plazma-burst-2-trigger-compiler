import fs from 'node:fs';
import { ACTIONS_DOC } from './paths.ts';
import { renderActions } from './render.ts';
import { TEXT } from './text.ts';

fs.writeFileSync(ACTIONS_DOC, renderActions());
process.stdout.write(TEXT.wrote(ACTIONS_DOC));
