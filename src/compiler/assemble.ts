import { parseAssembly } from '../asm/parse.ts';
import { compileModule } from './compile.ts';
import type { CompileOptions, CompileResult } from './compile.ts';
import { DEFAULT_OPTIONS } from './compile.ts';
import { createNames } from './names.ts';
import { TOKEN_SPACE } from './keys.ts';

export function compileAssembly(source: string, prefix: string, options: Partial<CompileOptions> = {}): CompileResult {
  const merged: CompileOptions = { ...DEFAULT_OPTIONS, ...options };
  const names = createNames(prefix, merged.obfuscate);
  const { module, externals, exportedLabels } = parseAssembly(source, names);
  for (const label of exportedLabels) names.keep(TOKEN_SPACE.userUid, label);
  merged.externalUids = [...(options.externalUids ?? []), ...externals];
  return compileModule(module, names, merged);
}
