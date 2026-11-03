import path from 'node:path';

export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const GAME_REPOSITORY = path.resolve(REPOSITORY_ROOT, '..', 'plazma-burst-2');
export const DEFAULT_SOURCE = path.resolve(GAME_REPOSITORY, 'data', 'opcodes.js');
export const DEFAULT_EDITOR = path.resolve(GAME_REPOSITORY, 'src', 'features', 'map_editor', 'domain');
export const SNAPSHOT_FILE = path.resolve(REPOSITORY_ROOT, 'src', 'opcodes', 'snapshot.json');
