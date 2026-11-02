import os from 'node:os';
import path from 'node:path';

export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const GAME_REPOSITORY = path.resolve(REPOSITORY_ROOT, '..', 'plazma-burst-2');
export const SANDBOX = path.join(os.tmpdir(), 'ptc-pb2-live');
export const SANDBOX_COPIES: readonly string[] = Object.freeze(['src', 'editions', 'hooks', 'test', 'package.json', 'tsconfig.json']);
export const SANDBOX_LINKS: readonly string[] = Object.freeze(['node_modules', 'game']);
export const SANDBOX_DATA_COPIES: readonly string[] = Object.freeze([path.join('data', 'names.js'), path.join('data', 'opcodes.js')]);
export const SANDBOX_MAPS = path.join(SANDBOX, 'data', 'maps');
export const SANDBOX_BUILT_MARK = path.join(SANDBOX, 'dist', 'page', 'console.js');
export const GAME_NAMES_FILE = path.join(GAME_REPOSITORY, 'data', 'names.js');
export const CASES_DIRECTORIES: readonly string[] = Object.freeze([
  path.join(REPOSITORY_ROOT, 'examples', 'live'),
  path.join(REPOSITORY_ROOT, 'examples', 'tutorial'),
]);
export const MAP_NAME = 'ptc-live';
export const MAP_FILE = path.join(SANDBOX_MAPS, `${MAP_NAME}.xml`);
