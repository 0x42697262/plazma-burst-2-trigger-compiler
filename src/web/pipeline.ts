import { compileSource } from '../lang/compile.ts';
import { compileAssembly } from '../compiler/assemble.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { emitXml, escapeXml, stagingPosition } from '../emit/xml-emitter.ts';
import { emitText, joinTextBlocks } from '../emit/trigger-text-emitter.ts';
import { appendToMap, removeOwned } from '../emit/merge.ts';
import { XML_LINE_END } from '../emit/keys.ts';
import { VAR_SYNC_IN_MAP } from '../emit/attributes.ts';
import { checkObjects, objectElement } from '../objects/objects.ts';
import { checkHostNames, checkHostUses } from '../compiler/host.ts';
import { createNames, seededPrefix } from '../compiler/names.ts';
import { Simulation } from '../sim/simulator.ts';
import { stringOf } from '../sim/values.ts';
import { diagnose, diagnoseAssembly } from '../service/service.ts';
import type { ServiceDiagnostic } from '../service/service.ts';
import { ASSEMBLY_EXTENSION, DEFAULT_PREFIX, ENVIRONMENT_ASSIGN, ENVIRONMENT_COMMENT, EXTENSION, LEADING_DIGITS, LINE_BREAK, PREFIX_CLEANUP } from './keys.ts';
import { PATH_SEPARATOR } from '../lang/keys.ts';
import { TEXT } from './text.ts';
import type { Workspace } from './workspace.ts';
import type { Target } from '../pcode/keys.ts';

export type Options = {
  prefix: string; guard: number; frames: number; numberText: boolean; directIndex: boolean; target: Target; replace: boolean; nameSeed: string; obfuscate: boolean; obfuscateSeed: string;
};
export type Problem = ServiceDiagnostic & { file: string };
export type Build = {
  result: CompileResult | null;
  problems: Problem[];
  xml: string;
  text: string;
  map: string;
  notes: string[];
  uids: string[];
};

export const prefixFor = (file: string): string => {
  const base = file.split(PATH_SEPARATOR).pop()?.replace(EXTENSION, '') ?? '';
  const cleaned = base.replace(PREFIX_CLEANUP, '').replace(LEADING_DIGITS, '');
  return cleaned === '' ? DEFAULT_PREFIX : cleaned;
};

export type Environment = Readonly<Record<string, string>>;

export const checkOptions = (numberText: boolean, directIndex: boolean, target: Target, environment: Environment = {}): Partial<CompileOptions> =>
  ({ protectNumberText: numberText, directIndex, target, environment });

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

export function build(workspace: Workspace, file: string, options: Options, hostMap: string | null, environment: Environment = {}, recordedUids: readonly string[] = []): Build {
  const problems = problemsOf(workspace, file, checkOptions(options.numberText, options.directIndex, options.target, environment));
  const empty: Build = { result: null, problems, xml: '', text: '', map: '', notes: [], uids: [] };
  if (problems.some((entry) => entry.severity === 'error')) return empty;
  const source = workspace.get(file) ?? '';
  const nameSeed = options.nameSeed.trim();
  const plainPrefix = options.prefix === '' ? prefixFor(file) : options.prefix;
  const seed = options.obfuscate ? options.obfuscateSeed.trim() || nameSeed || plainPrefix : null;
  const prefix = nameSeed !== '' ? seededPrefix(nameSeed) : options.prefix !== '' || seed === null ? plainPrefix : seededPrefix(seed);
  const compileOptions: Partial<CompileOptions> = {
    loopGuard: options.guard > 0 ? options.guard : null,
    varSync: hostMap !== null && VAR_SYNC_IN_MAP.test(hostMap) ? 'present' : 'add',
    ...checkOptions(options.numberText, options.directIndex, options.target, environment),
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
  const created = (check?.missing ?? []).map((object, index) => {
    const staging = stagingPosition(index, result.program);
    notes.push(TEXT.added(object.keyword, object.uid, object.x ?? staging.x, object.y ?? staging.y));
    return objectElement(object, staging, escapeXml) + XML_LINE_END;
  }).join('');
  notes.push(...(check?.problems ?? []));
  const xml = emitXml(result.program) + created;
  let text = '';
  try {
    text = joinTextBlocks(emitText(result.program));
    if (result.obfuscation !== null) notes.push(TEXT.textNeedsOrder);
    if (result.program.timers.length > 0) {
      notes.push(TEXT.textNeedsTimers(result.program.timers.map((timer) => TEXT.timerTarget(timer.uid, timer.target)).join(TEXT.listSeparator)));
    }
  } catch (error) {
    notes.push(error instanceof Error ? error.message : String(error));
  }
  let map = '';
  const uids = [...result.program.triggers.map((trigger) => trigger.uid), ...result.program.timers.map((timer) => timer.uid)];
  if (hostMap !== null) {
    const names = createNames(prefix);
    const recorded = new Set(recordedUids);
    const host = options.replace ? removeOwned(hostMap, (uid) => recorded.has(uid) || names.ownsUid(uid)) : hostMap;
    notes.push(...checkHostNames(result.program, host), ...checkHostUses(host, names.ownsVariable, result.exports));
    try {
      map = appendToMap(host, xml);
    } catch (error) {
      notes.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { result, problems, xml, text, map, notes, uids };
}

export function simulate(result: CompileResult, frames: number): string[] {
  const simulation = new Simulation(result.program);
  simulation.tick(frames);
  const show = (value: unknown): string => (typeof value === 'string' || Array.isArray(value) ? JSON.stringify(value) : stringOf(value));
  return [
    ...simulation.chat.map(TEXT.chat),
    ...Object.entries(simulation.variables).map(([name, value]) => TEXT.variable(name, show(value))),
    ...simulation.errors.map(TEXT.simulationError),
    ...[...simulation.unsimulated].map(TEXT.unsimulated),
  ];
}
