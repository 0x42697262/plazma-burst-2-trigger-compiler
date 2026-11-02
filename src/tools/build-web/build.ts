import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'esbuild';
import { BUNDLE, ENTRY, EXAMPLES, NO_JEKYLL, SITE, STATIC_FILES, WEB_SOURCE } from './paths.ts';
import {
  BROWSER, EXAMPLE_FILE, EXAMPLES_PREFIX, FILE_ENCODING, JSON_LOADER, MODULE_FORMAT, SEPARATOR, SLASH, TARGET, VIRTUAL_FILTER, VIRTUAL_NAMESPACE,
} from './keys.ts';
import { TEXT } from './text.ts';
import { KILOBYTE } from './constants.ts';

export function collectExamples(folder: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (EXAMPLE_FILE.test(entry.name)) files[EXAMPLES_PREFIX + path.relative(folder, full).replace(SEPARATOR, SLASH)] = fs.readFileSync(full, FILE_ENCODING);
    }
  };
  walk(folder);
  return files;
}

const examplesPlugin = (files: Record<string, string>): Plugin => ({
  name: VIRTUAL_NAMESPACE,
  setup(builder) {
    builder.onResolve({ filter: VIRTUAL_FILTER }, (resolved) => ({ path: resolved.path, namespace: VIRTUAL_NAMESPACE }));
    builder.onLoad({ filter: VIRTUAL_FILTER, namespace: VIRTUAL_NAMESPACE }, () => ({ contents: JSON.stringify(files), loader: JSON_LOADER }));
  },
});

export async function buildSite(): Promise<string> {
  const examples = collectExamples(EXAMPLES);
  fs.rmSync(SITE, { recursive: true, force: true });
  fs.mkdirSync(SITE, { recursive: true });
  await build({
    entryPoints: [ENTRY], bundle: true, format: MODULE_FORMAT, platform: BROWSER, target: TARGET, minify: true, outfile: BUNDLE,
    plugins: [examplesPlugin(examples)], logLevel: 'warning',
  });
  for (const file of STATIC_FILES) fs.copyFileSync(path.join(WEB_SOURCE, file), path.join(SITE, file));
  fs.writeFileSync(NO_JEKYLL, TEXT.empty);
  return TEXT.built(SITE, Object.keys(examples).length, Math.round(fs.statSync(BUNDLE).size / KILOBYTE));
}
