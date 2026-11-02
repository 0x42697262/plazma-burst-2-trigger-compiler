import { compileAssembly } from '../compiler/assemble.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { readPrefixDirective } from '../asm/parse.ts';

export type FrontEnd = { compile: (source: string, prefix: string, options: Partial<CompileOptions>) => CompileResult; prefixOf: (source: string) => string | null };

const ASSEMBLY: FrontEnd = { compile: compileAssembly, prefixOf: readPrefixDirective };

export const frontEndFor = (_file: string): FrontEnd => ASSEMBLY;
