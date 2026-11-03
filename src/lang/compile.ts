import { compileModule, DEFAULT_OPTIONS } from '../compiler/compile.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { createNames, CompileError } from '../compiler/names.ts';
import type { Declaration, SourceFile } from './ast.ts';
import { parseSource } from './parser.ts';
import { generate } from './codegen.ts';
import { keepExported } from './symbols.ts';
import { checkSecrets, foldConstants } from './comptime.ts';
import { buildMaps } from './mapblock.ts';
import type { AttributeValue, BuiltObject, MapBuild } from './mapblock.ts';
import type { MapObject } from '../objects/types.ts';
import { checkTriggers } from '../compiler/check.ts';
import { mapTriggers } from '../emit/place.ts';
import type { Folded } from './comptime.ts';
import { SourceError } from './lexer.ts';
import { MAP_TEXT, TEXT } from './text.ts';
import { createProtection } from '../tamper/protect.ts';
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

function mapObjectsOf(objects: readonly BuiltObject[], entries: ReadonlyMap<string, string>): MapObject[] {
  const textOf = (value: AttributeValue, location: BuiltObject['location']): string => {
    if (value.kind === 'text') return value.text;
    const uid = entries.get(value.name);
    if (uid === undefined) throw new CompileError(TEXT.where(location.line, TEXT.unknownFunction(value.name), location.file));
    return uid;
  };
  return objects.map((object) => ({
    constructorName: object.constructorName, tag: object.tag, uid: object.uid, mark: object.mark,
    set: object.set.map(([name, value]) => [name, textOf(value, object.location)] as const),
    initial: object.initial.map(([name, value]) => [name, textOf(value, object.location)] as const),
    actions: object.actions?.map((action) => ({ opcode: action.opcode, targetA: textOf(action.targetA, object.location), targetB: textOf(action.targetB, object.location) })) ?? null,
    line: object.location.line, ...(object.location.file === undefined ? {} : { file: object.location.file }),
  }));
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
  let maps: MapBuild;
  try {
    maps = buildMaps(folded.file, names);
  } catch (error) {
    if (error instanceof SourceError) throw new CompileError(TEXT.where(error.line, error.message, error.file));
    throw error;
  }
  const generateOptions = {
    protectNumberText: merged.protectNumberText && merged.target !== 'pcode', directIndex: merged.directIndex || merged.target === 'pcode',
    compileTimeFunctions: new Set([...folded.compileTimeFunctions, ...maps.functions]), referencedFunctions: maps.references, writtenElsewhere: maps.variables,
    tamperCheck: merged.tamper !== null, protection: createProtection(names, merged.tamper),
  };
  const mapUids = maps.objects.flatMap((object) => (object.uid === null ? [] : [object.uid]));
  const compiled = compileModule(generate(maps.file, names, generateOptions), names, { ...merged, externalUids: [...merged.externalUids, ...mapUids] });
  const mapObjects = mapObjectsOf(maps.objects, compiled.entries);
  const ownUids = new Set([...compiled.program.triggers.map((trigger) => trigger.uid), ...compiled.program.timers.map((timer) => timer.uid)]);
  const clash = mapObjects.find((object) => object.uid !== null && ownUids.has(object.uid));
  if (clash) throw new CompileError(TEXT.where(clash.line, MAP_TEXT.uidOfProgram(clash.uid ?? ''), clash.file));
  const known = [...merged.externalUids, ...ownUids, ...compiled.objects.map((object) => object.uid), ...mapUids];
  const mapWarnings = checkTriggers(mapTriggers(mapObjects), known);
  const result: CompileResult = { ...compiled, warnings: [...maps.warnings, ...compiled.warnings, ...mapWarnings], mapObjects };
  const lineOf = (uid: string, position: number): number | null => result.sourceMap.find((entry) => entry.uid === uid)?.lines[position] ?? null;
  const machineUids = result.obfuscation?.machineUids ?? new Set<string>();
  checkSecrets(folded.secrets, [
    ...result.program.triggers.filter((trigger) => !machineUids.has(trigger.uid)).flatMap((trigger) => trigger.actions.flatMap((action, position) => [action.targetA, action.targetB].map((text) => ({
      text, where: TEXT.leakPlace(trigger.uid, position + 1, lineOf(trigger.uid, position)),
    })))),
    ...result.program.timers.map((timer) => ({ text: timer.uid, where: TEXT.leakTimer(timer.uid) })),
    ...(result.obfuscation?.texts ?? []).map((entry) => ({ text: entry.value, where: TEXT.leakEncoded(entry.variable) })),
    ...result.mapObjects.flatMap((object) => [...object.set, ...object.initial].map(([name, text]) => ({
      text, where: TEXT.leakObject(object.uid ?? object.mark ?? object.constructorName, name, object.line),
    }))),
    ...result.mapObjects.flatMap((object) => (object.actions ?? []).flatMap((action, position) => [action.targetA, action.targetB].map((text) => ({
      text, where: TEXT.leakPlace(object.uid ?? object.constructorName, position + 1, object.line),
    })))),
  ]);
  return result;
}
