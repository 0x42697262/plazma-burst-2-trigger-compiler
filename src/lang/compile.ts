import { compileModule, DEFAULT_OPTIONS } from '../compiler/compile.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { createNames, CompileError } from '../compiler/names.ts';
import { parseSource } from './parser.ts';
import { generate } from './codegen.ts';
import { SourceError } from './lexer.ts';
import { TEXT } from './text.ts';

export function compileSource(source: string, prefix: string, options: Partial<CompileOptions> = {}): CompileResult {
  const names = createNames(prefix);
  let file;
  try {
    file = parseSource(source);
  } catch (error) {
    if (error instanceof SourceError) throw new CompileError(TEXT.where(error.line, error.message));
    throw error;
  }
  return compileModule(generate(file, names), names, { ...DEFAULT_OPTIONS, ...options });
}
