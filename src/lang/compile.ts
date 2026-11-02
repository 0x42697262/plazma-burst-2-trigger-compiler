import { compileModule, DEFAULT_OPTIONS } from '../compiler/compile.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { createNames, CompileError } from '../compiler/names.ts';
import type { Declaration, SourceFile } from './ast.ts';
import { parseSource } from './parser.ts';
import { generate } from './codegen.ts';
import { keepExported } from './symbols.ts';
import { checkSecrets, foldConstants } from './comptime.ts';
import type { Folded } from './comptime.ts';
import { SourceError } from './lexer.ts';
import { TEXT } from './text.ts';
import { directoryOf, importTarget, isStandardLibrary, relativePath, resolvePath } from './file-paths.ts';

export type SourceOrigin = { file: string; read: (file: string) => string };

function loadFiles(source: string, origin: SourceOrigin | null): SourceFile {
  const seen = new Set<string>();
  const declarations: Declaration[] = [];
  const visit = (text: string, file: string | null, label: string | undefined): void => {
    const parsed = parseSource(text, label);
    for (const entry of parsed.imports) {
      if (origin === null || file === null) throw new SourceError(entry.location.line, TEXT.importNeedsFile, label);
      const resolved = importTarget(directoryOf(file), entry.path);
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      let imported: string;
      try {
        imported = origin.read(resolved);
      } catch {
        throw new SourceError(entry.location.line, TEXT.cannotImport(entry.path), label);
      }
      visit(imported, resolved, isStandardLibrary(resolved) ? resolved : relativePath(directoryOf(origin.file), resolved));
    }
    declarations.push(...parsed.declarations);
  };
  const main = origin === null ? null : resolvePath('', origin.file);
  if (main !== null) seen.add(main);
  visit(source, main, undefined);
  return { declarations, imports: [] };
}

export function compileSource(source: string, prefix: string, options: Partial<CompileOptions> = {}, origin: SourceOrigin | null = null): CompileResult {
  const merged: CompileOptions = { ...DEFAULT_OPTIONS, ...options };
  const names = createNames(prefix, merged.obfuscate);
  let file;
  try {
    file = loadFiles(source, origin);
  } catch (error) {
    if (error instanceof SourceError) throw new CompileError(TEXT.where(error.line, error.message, error.file));
    throw error;
  }
  keepExported(names, file.declarations);
  let folded: Folded;
  try {
    folded = foldConstants(file, merged.environment);
  } catch (error) {
    if (error instanceof SourceError) throw new CompileError(TEXT.where(error.line, error.message, error.file));
    throw error;
  }
  const generateOptions = {
    protectNumberText: merged.protectNumberText && merged.target !== 'pcode', directIndex: merged.directIndex || merged.target === 'pcode', compileTimeFunctions: folded.compileTimeFunctions,
  };
  const result = compileModule(generate(folded.file, names, generateOptions), names, merged);
  const lineOf = (uid: string, position: number): number | null => result.sourceMap.find((entry) => entry.uid === uid)?.lines[position] ?? null;
  const machineUids = result.obfuscation?.machineUids ?? new Set<string>();
  checkSecrets(folded.secrets, [
    ...result.program.triggers.filter((trigger) => !machineUids.has(trigger.uid)).flatMap((trigger) => trigger.actions.flatMap((action, position) => [action.targetA, action.targetB].map((text) => ({
      text, where: TEXT.leakPlace(trigger.uid, position + 1, lineOf(trigger.uid, position)),
    })))),
    ...result.program.timers.map((timer) => ({ text: timer.uid, where: TEXT.leakTimer(timer.uid) })),
    ...(result.obfuscation?.texts ?? []).map((entry) => ({ text: entry.value, where: TEXT.leakEncoded(entry.variable) })),
  ]);
  return result;
}
