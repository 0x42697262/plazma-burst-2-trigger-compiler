import { parseAssembly } from '../asm/parse.ts';
import { compileModule } from './compile.ts';
import type { CompileOptions, CompileResult } from './compile.ts';
import { DEFAULT_OPTIONS } from './compile.ts';
import { createNames } from './names.ts';

export function compileAssembly(source: string, prefix: string, options: Partial<CompileOptions> = {}): CompileResult {
  const names = createNames(prefix);
  const { module, externals } = parseAssembly(source, names);
  const merged: CompileOptions = { ...DEFAULT_OPTIONS, ...options, externalUids: [...(options.externalUids ?? []), ...externals] };
  return compileModule(module, names, merged);
}
