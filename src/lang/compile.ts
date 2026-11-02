import { compileModule, DEFAULT_OPTIONS } from '../compiler/compile.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { createNames, CompileError } from '../compiler/names.ts';
import type { Declaration, SourceFile } from './ast.ts';
import { parseSource } from './parser.ts';
import { generate } from './codegen.ts';
import { SourceError } from './lexer.ts';
import { TEXT } from './text.ts';
import { directoryOf, relativePath, resolvePath } from './file-paths.ts';

export type SourceOrigin = { file: string; read: (file: string) => string };

function loadFiles(source: string, origin: SourceOrigin | null): SourceFile {
  const seen = new Set<string>();
  const declarations: Declaration[] = [];
  const visit = (text: string, file: string | null, label: string | undefined): void => {
    const parsed = parseSource(text, label);
    for (const entry of parsed.imports) {
      if (origin === null || file === null) throw new SourceError(entry.location.line, TEXT.importNeedsFile, label);
      const resolved = resolvePath(directoryOf(file), entry.path);
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      let imported: string;
      try {
        imported = origin.read(resolved);
      } catch {
        throw new SourceError(entry.location.line, TEXT.cannotImport(entry.path), label);
      }
      visit(imported, resolved, relativePath(directoryOf(origin.file), resolved));
    }
    declarations.push(...parsed.declarations);
  };
  const main = origin === null ? null : resolvePath('', origin.file);
  if (main !== null) seen.add(main);
  visit(source, main, undefined);
  return { declarations, imports: [] };
}

export function compileSource(source: string, prefix: string, options: Partial<CompileOptions> = {}, origin: SourceOrigin | null = null): CompileResult {
  const names = createNames(prefix);
  let file;
  try {
    file = loadFiles(source, origin);
  } catch (error) {
    if (error instanceof SourceError) throw new CompileError(TEXT.where(error.line, error.message, error.file));
    throw error;
  }
  const merged: CompileOptions = { ...DEFAULT_OPTIONS, ...options };
  return compileModule(generate(file, names, { protectNumberText: merged.protectNumberText && merged.target !== 'pcode', directIndex: merged.directIndex || merged.target === 'pcode' }), names, merged);
}
