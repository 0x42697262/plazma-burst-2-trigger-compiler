import path from 'node:path';

export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const WEB_SOURCE = path.join(REPOSITORY_ROOT, 'src', 'web');
export const ENTRY = path.join(WEB_SOURCE, 'main.ts');
export const STATIC_FILES: readonly string[] = Object.freeze(['index.html', 'style.css']);
export const EXAMPLES = path.join(REPOSITORY_ROOT, 'examples');
export const SITE = path.join(REPOSITORY_ROOT, 'site');
export const BUNDLE = path.join(SITE, 'app.js');
export const NO_JEKYLL = path.join(SITE, '.nojekyll');
