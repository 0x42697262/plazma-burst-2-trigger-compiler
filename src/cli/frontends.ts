import { compileAssembly } from '../compiler/assemble.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { readPrefixDirective } from '../asm/parse.ts';
import { compileSource } from '../lang/compile.ts';
import { ASSEMBLY_EXTENSION } from './keys.ts';
import { readSourceFile } from './sources.ts';

export type FrontEnd = {
  compile: (source: string, prefix: string, options: Partial<CompileOptions>, file: string) => CompileResult;
  prefixOf: (source: string) => string | null;
};


const ASSEMBLY: FrontEnd = { compile: (source, prefix, options) => compileAssembly(source, prefix, options), prefixOf: readPrefixDirective };
const LANGUAGE: FrontEnd = {
  compile: (source, prefix, options, file) => compileSource(source, prefix, options, { file, read: readSourceFile }),
  prefixOf: () => null,
};

export const frontEndFor = (file: string): FrontEnd => (file.endsWith(ASSEMBLY_EXTENSION) ? ASSEMBLY : LANGUAGE);
