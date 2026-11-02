import { compileSource } from '../lang/compile.ts';
import { compileAssembly } from '../compiler/assemble.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { emitXml, escapeXml, stagingPosition } from '../emit/xml-emitter.ts';
import { emitText, joinTextBlocks } from '../emit/trigger-text-emitter.ts';
import { appendToMap } from '../emit/merge.ts';
import { XML_LINE_END } from '../emit/keys.ts';
import { VAR_SYNC_IN_MAP } from '../emit/attributes.ts';
import { checkObjects, objectElement } from '../objects/objects.ts';
import { checkHostNames, checkHostUses } from '../compiler/host.ts';
import { createNames } from '../compiler/names.ts';
import { Simulation } from '../sim/simulator.ts';
import { stringOf } from '../sim/values.ts';
import { diagnose, diagnoseAssembly } from '../service/service.ts';
import type { ServiceDiagnostic } from '../service/service.ts';
import { ASSEMBLY_EXTENSION, DEFAULT_PREFIX, EXTENSION, LEADING_DIGITS, PREFIX_CLEANUP } from './keys.ts';
import { PATH_SEPARATOR } from '../lang/keys.ts';
import { TEXT } from './text.ts';
import type { Workspace } from './workspace.ts';

export type Options = { prefix: string; guard: number; frames: number; numberText: boolean; directIndex: boolean };
export type Problem = ServiceDiagnostic & { file: string };
export type Build = {
  result: CompileResult | null;
  problems: Problem[];
  xml: string;
  text: string;
  map: string;
  notes: string[];
};

export const prefixFor = (file: string): string => {
  const base = file.split(PATH_SEPARATOR).pop()?.replace(EXTENSION, '') ?? '';
  const cleaned = base.replace(PREFIX_CLEANUP, '').replace(LEADING_DIGITS, '');
  return cleaned === '' ? DEFAULT_PREFIX : cleaned;
};

export const checkOptions = (numberText: boolean, directIndex: boolean): Partial<CompileOptions> => ({ protectNumberText: numberText, directIndex });

export function problemsOf(workspace: Workspace, file: string, options: Partial<CompileOptions> = {}): Problem[] {
  const source = workspace.get(file) ?? '';
  const found = file.endsWith(ASSEMBLY_EXTENSION) ? diagnoseAssembly(source, options) : diagnose(source, file, (name) => workspace.get(name), options);
  return found.map((entry) => ({ ...entry, file }));
}

export function build(workspace: Workspace, file: string, options: Options, hostMap: string | null): Build {
  const problems = problemsOf(workspace, file, checkOptions(options.numberText, options.directIndex));
  const empty: Build = { result: null, problems, xml: '', text: '', map: '', notes: [] };
  if (problems.some((entry) => entry.severity === 'error')) return empty;
  const source = workspace.get(file) ?? '';
  const prefix = options.prefix === '' ? prefixFor(file) : options.prefix;
  const compileOptions: Partial<CompileOptions> = {
    loopGuard: options.guard > 0 ? options.guard : null,
    varSync: hostMap !== null && VAR_SYNC_IN_MAP.test(hostMap) ? 'present' : 'add',
    ...checkOptions(options.numberText, options.directIndex),
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
    if (result.program.timers.length > 0) {
      notes.push(TEXT.textNeedsTimers(result.program.timers.map((timer) => TEXT.timerTarget(timer.uid, timer.target)).join(TEXT.listSeparator)));
    }
  } catch (error) {
    notes.push(error instanceof Error ? error.message : String(error));
  }
  let map = '';
  if (hostMap !== null) {
    notes.push(...checkHostNames(result.program, hostMap), ...checkHostUses(hostMap, createNames(prefix).ownsVariable, result.exports));
    try {
      map = appendToMap(hostMap, xml);
    } catch (error) {
      notes.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { result, problems, xml, text, map, notes };
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
