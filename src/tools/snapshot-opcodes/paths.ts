import path from 'node:path';

export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const DEFAULT_SOURCE = path.resolve(REPOSITORY_ROOT, '..', 'plazma-burst-2', 'data', 'opcodes.js');
export const SNAPSHOT_FILE = path.resolve(REPOSITORY_ROOT, 'src', 'opcodes', 'snapshot.json');
