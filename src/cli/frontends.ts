import { compileAssembly } from '../compiler/assemble.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { readPrefixDirective } from '../asm/parse.ts';
import { compileSource } from '../lang/compile.ts';
import { ASSEMBLY_EXTENSION } from './keys.ts';

export type FrontEnd = { compile: (source: string, prefix: string, options: Partial<CompileOptions>) => CompileResult; prefixOf: (source: string) => string | null };

const ASSEMBLY: FrontEnd = { compile: compileAssembly, prefixOf: readPrefixDirective };
const LANGUAGE: FrontEnd = { compile: compileSource, prefixOf: () => null };

export const frontEndFor = (file: string): FrontEnd => (file.endsWith(ASSEMBLY_EXTENSION) ? ASSEMBLY : LANGUAGE);
