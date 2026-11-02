import path from 'node:path';

export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const ACTIONS_DOC = path.join(REPOSITORY_ROOT, 'docs', 'actions.md');
