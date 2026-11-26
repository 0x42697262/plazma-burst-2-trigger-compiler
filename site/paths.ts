import os from 'node:os';
import path from 'node:path';
import { ENVIRONMENT } from './keys.ts';

const CONFIG_FOLDER = '.config';
const APP_FOLDER = 'pb2-trigger-compiler';
const SESSION_FILE = 'site-session.json';

export function sessionFile(environment: NodeJS.ProcessEnv): string {
  const base = environment[ENVIRONMENT.configHome] || environment[ENVIRONMENT.appData] || path.join(os.homedir(), CONFIG_FOLDER);
  return path.join(base, APP_FOLDER, SESSION_FILE);
}
