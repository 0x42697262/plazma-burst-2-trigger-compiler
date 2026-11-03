import { compileSource } from '../lang/compile.ts';
import { compileAssembly } from '../compiler/assemble.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { emitXml, stagingPosition } from '../emit/xml-emitter.ts';
import { emitText, joinTextBlocks } from '../emit/trigger-text-emitter.ts';
import { appendToMap, removeOwned } from '../emit/merge.ts';
import { VAR_SYNC_IN_MAP } from '../emit/attributes.ts';
import { checkObjects } from '../objects/objects.ts';
import { missingHostObject } from '../objects/missing.ts';
import { placeObjects, regionsOf, withMapTriggers } from '../emit/place.ts';
import { checkHostNames, checkHostUses } from '../compiler/host.ts';
import { createNames, seededPrefix } from '../compiler/names.ts';
import { isRandomSeed, resolveSeed } from '../obfuscate/random.ts';
import { Simulation } from '../sim/simulator.ts';
import { stringOf } from '../sim/values.ts';
import { diagnose, diagnoseAssembly } from '../service/service.ts';
import type { ServiceDiagnostic } from '../service/service.ts';
import { ASSEMBLY_EXTENSION, DEFAULT_PREFIX, ENVIRONMENT_ASSIGN, ENVIRONMENT_COMMENT, EXTENSION, LEADING_DIGITS, LINE_BREAK, PREFIX_CLEANUP } from './keys.ts';
import { PATH_SEPARATOR } from '../lang/keys.ts';
import { TEXT } from './text.ts';
import type { Workspace } from './workspace.ts';
import type { Target } from '../pcode/keys.ts';
import type { TamperMode } from '../tamper/keys.ts';
import { TAMPER_MODE } from '../tamper/keys.ts';
import type { TamperCheck } from '../tamper/tamper.ts';
import { tamperCheckOf } from '../tamper/options.ts';

export type Options = {
  prefix: string; guard: number; frames: number; numberText: boolean; directIndex: boolean; target: Target; replace: boolean; nameSeed: string; obfuscate: boolean; obfuscateSeed: string;
  tamper: TamperMode; tamperSeed: string; tamperAnnounce: boolean;
};
export type BuildRecord = { uids: readonly string[]; walls: readonly string[] };
export const EMPTY_RECORD: BuildRecord = Object.freeze({ uids: [], walls: [] });
export type Problem = ServiceDiagnostic & { file: string };
export type Build = {
  result: CompileResult | null;
  problems: Problem[];
  xml: string;
  text: string;
  map: string;
  notes: string[];
  uids: string[];
  walls: string[];
};

export const prefixFor = (file: string): string => {
  const base = file.split(PATH_SEPARATOR).pop()?.replace(EXTENSION, '') ?? '';
  const cleaned = base.replace(PREFIX_CLEANUP, '').replace(LEADING_DIGITS, '');
  return cleaned === '' ? DEFAULT_PREFIX : cleaned;
};

export type Environment = Readonly<Record<string, string>>;

export const checkOptions = (numberText: boolean, directIndex: boolean, target: Target, environment: Environment = {}, tamper: TamperCheck | null = null): Partial<CompileOptions> =>
  ({ protectNumberText: numberText, directIndex, target, environment, tamper });

export const tamperOf = (mode: TamperMode, seed: string, fallbackSeed: string, announce = false): TamperCheck | null =>
  tamperCheckOf({ mode, seed: seed.trim() === '' ? null : seed, layers: null, fallbackSeed: () => fallbackSeed, announce: announce && mode === TAMPER_MODE.enforce });

export function parseEnvironment(text: string): Environment {
  const environment: Record<string, string> = {};
  for (const line of text.split(LINE_BREAK)) {
    const position = line.indexOf(ENVIRONMENT_ASSIGN);
    const name = line.slice(0, position).trim();
    if (position <= 0 || name === '' || name.startsWith(ENVIRONMENT_COMMENT)) continue;
    environment[name] = line.slice(position + ENVIRONMENT_ASSIGN.length);
  }
  return environment;
}

export function problemsOf(workspace: Workspace, file: string, options: Partial<CompileOptions> = {}): Problem[] {
  const source = workspace.get(file) ?? '';
  const found = file.endsWith(ASSEMBLY_EXTENSION) ? diagnoseAssembly(source, options) : diagnose(source, file, (name) => workspace.get(name), options);
  return found.map((entry) => ({ ...entry, file }));
}

export function build(workspace: Workspace, file: string, options: Options, hostMap: string | null, environment: Environment = {}, recorded: BuildRecord = EMPTY_RECORD): Build {
  const plainTamper = tamperOf(options.tamper, '', prefixFor(file));
  const problems = problemsOf(workspace, file, checkOptions(options.numberText, options.directIndex, options.target, environment, plainTamper));
  const empty: Build = { result: null, problems, xml: '', text: '', map: '', notes: [], uids: [], walls: [] };
  if (problems.some((entry) => entry.severity === 'error')) return empty;
  const source = workspace.get(file) ?? '';
  const nameSeed = options.nameSeed.trim();
  const plainPrefix = options.prefix === '' ? prefixFor(file) : options.prefix;
  const givenSeed = options.obfuscateSeed.trim();
  const seed = options.obfuscate ? resolveSeed(givenSeed) || nameSeed || plainPrefix : null;
  const prefix = nameSeed !== '' ? seededPrefix(nameSeed) : options.prefix !== '' || seed === null ? plainPrefix : seededPrefix(seed);
  const compileOptions: Partial<CompileOptions> = {
    loopGuard: options.guard > 0 ? options.guard : null,
    varSync: hostMap !== null && VAR_SYNC_IN_MAP.test(hostMap) ? 'present' : 'add',
    ...checkOptions(options.numberText, options.directIndex, options.target, environment, tamperOf(options.tamper, options.tamperSeed, seed ?? (nameSeed || plainPrefix), options.tamperAnnounce)),
    obfuscate: seed === null ? null : { seed },
  };
  let result: CompileResult;
  try {
    result = file.endsWith(ASSEMBLY_EXTENSION)
      ? compileAssembly(source, prefix, compileOptions)
      : compileSource(source, prefix, compileOptions, { file, read: (name) => workspace.get(name) ?? '' });
  } catch (error) {
    return { ...empty, problems: [{ file, line: 0, severity: 'error', message: error instanceof Error ? error.message : String(error) }] };
  }
  const notes: string[] = [];
  const check = hostMap === null ? null : checkObjects(result.objects, hostMap);
  const objectProblems = [...(check?.problems ?? []), ...(check?.missing ?? []).map(missingHostObject)];
  const names = createNames(prefix);
  const recordedUids = new Set(recorded.uids);
  const host = hostMap === null ? null : options.replace ? removeOwned(hostMap, (uid) => recordedUids.has(uid) || names.ownsUid(uid)) : hostMap;
  const placement = placeObjects(result.mapObjects, {
    host, staging: (index) => stagingPosition(index, result.program), previousWalls: options.replace ? recorded.walls : [], replacing: options.replace,
  });
  notes.push(...placement.notes);
  const blocking = [...objectProblems, ...placement.problems];
  const program = placement.declaresVarSync ? { ...result.program, varSyncMark: false } : result.program;
  const xml = placement.xml + emitXml(program);
  let text = '';
  try {
    const textProgram = withMapTriggers(result.program, result.mapObjects);
    text = joinTextBlocks(emitText(textProgram));
    if (result.obfuscation !== null) notes.push(TEXT.textNeedsOrder);
    if (seed !== null && isRandomSeed(givenSeed)) notes.push(TEXT.randomSeed(seed));
    if (textProgram.timers.length > 0) {
      notes.push(TEXT.textNeedsTimers(textProgram.timers.map((timer) => TEXT.timerTarget(timer.uid, timer.target)).join(TEXT.listSeparator)));
    }
  } catch (error) {
    notes.push(error instanceof Error ? error.message : String(error));
  }
  let map = '';
  const uids = [...result.program.triggers.map((trigger) => trigger.uid), ...result.program.timers.map((timer) => timer.uid)];
  notes.push(...blocking);
  if (placement.host !== null) {
    const mapUids = new Set(result.mapObjects.flatMap((object) => (object.uid === null ? [] : [object.uid])));
    const hostOnly = removeOwned(placement.host, (uid) => mapUids.has(uid));
    notes.push(...checkHostNames(result.program, hostOnly), ...checkHostUses(hostOnly, names.ownsVariable, result.exports));
    try {
      if (blocking.length === 0) map = appendToMap(placement.host, xml);
    } catch (error) {
      notes.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { result, problems, xml, text, map, notes, uids, walls: placement.walls };
}

export type Preview = { objects: CompileResult['mapObjects']; staging: (index: number) => { x: number; y: number } };

export function preview(workspace: Workspace, file: string, options: Options, environment: Environment = {}): Preview | null {
  if (file.endsWith(ASSEMBLY_EXTENSION)) return { objects: [], staging: () => ({ x: 0, y: 0 }) };
  const prefix = options.prefix === '' ? prefixFor(file) : options.prefix;
  try {
    const result = compileSource(workspace.get(file) ?? '', prefix, checkOptions(options.numberText, options.directIndex, options.target, environment, tamperOf(options.tamper, '', prefix)), { file, read: (name) => workspace.get(name) ?? '' });
    return { objects: result.mapObjects, staging: (index) => stagingPosition(index, result.program) };
  } catch {
    return null;
  }
}

export function simulate(result: CompileResult, frames: number): string[] {
  const simulation = new Simulation(withMapTriggers(result.program, result.mapObjects), { regions: regionsOf(result.mapObjects) });
  simulation.tick(frames);
  const show = (value: unknown): string => (typeof value === 'string' || Array.isArray(value) ? JSON.stringify(value) : stringOf(value));
  return [
    ...simulation.chat.map(TEXT.chat),
    ...Object.entries(simulation.variables).map(([name, value]) => TEXT.variable(name, show(value))),
    ...simulation.errors.map(TEXT.simulationError),
    ...[...simulation.unsimulated].map(TEXT.unsimulated),
  ];
}
