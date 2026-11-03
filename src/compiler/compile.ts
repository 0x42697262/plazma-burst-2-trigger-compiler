import type { Program, Timer } from '../program/types.ts';
import { START_TIMER } from '../program/constants.ts';
import { checkProgram } from '../emit/check.ts';
import type { ExportedVariable, Module, ObjectDeclaration } from './ir.ts';
import type { Names } from './names.ts';
import { CompileError } from './names.ts';
import { addLoopGuard } from './guard.ts';
import { lower } from './lower.ts';
import { layout } from './layout.ts';
import type { SourceMapEntry } from './layout.ts';
import { checkTriggers } from './check.ts';
import { SYNC_ACTIONS } from '../opcodes/constants.ts';
import { DEFAULT_LOOP_GUARD } from './constants.ts';
import { ELEMENT_START, START_TIMER_LABEL } from './keys.ts';
import { TEXT } from './text.ts';
import { buildPcode } from '../pcode/pcode.ts';
import { DEFAULT_TARGET, VM_VARIABLE } from '../pcode/keys.ts';
import type { Target } from '../pcode/keys.ts';
import type { Trigger } from '../program/types.ts';
import { createObfuscator } from '../obfuscate/obfuscate.ts';
import type { Obfuscation } from '../obfuscate/obfuscate.ts';
import type { EncodedText } from '../obfuscate/texts.ts';
import type { LegendEntry } from './names.ts';
import type { MapObject } from '../objects/types.ts';
import { PLAIN_CONTROL } from './layout.ts';
import { createTamper } from '../tamper/tamper.ts';
import type { TamperCheck, TamperVariables } from '../tamper/tamper.ts';
import { TEXT as TAMPER_TEXT } from '../tamper/text.ts';

export type VarSyncMark = 'add' | 'present' | 'off';

export type CompileOptions = { loopGuard: number | null; startTimer: boolean; externalUids: readonly string[]; varSync: VarSyncMark; protectNumberText: boolean; directIndex: boolean; target: Target;
  environment: Readonly<Record<string, string | undefined>>;
  obfuscate: Obfuscation | null;
  tamper: TamperCheck | null;
};

export const DEFAULT_OPTIONS: CompileOptions = Object.freeze({
  loopGuard: DEFAULT_LOOP_GUARD, startTimer: true, externalUids: [], varSync: 'add', protectNumberText: true, directIndex: false, target: DEFAULT_TARGET, environment: {}, obfuscate: null, tamper: null,
});

export type ObfuscationReport = {
  machineUids: ReadonlySet<string>; mapDependent: readonly string[]; texts: readonly EncodedText[]; legend: readonly LegendEntry[]; reveal: (name: string) => string;
};

export type TamperReport = { machineUids: ReadonlySet<string>; variables: TamperVariables };

export type CompileResult = {
  program: Program;
  warnings: string[];
  sourceMap: SourceMapEntry[];
  entries: Map<string, string>;
  objects: readonly ObjectDeclaration[];
  mapObjects: readonly MapObject[];
  exports: readonly ExportedVariable[];
  obfuscation: ObfuscationReport | null;
  tamper: TamperReport | null;
};

export function compileModule(module: Module, names: Names, options: CompileOptions = DEFAULT_OPTIONS): CompileResult {
  const guarded = options.loopGuard === null ? [...module.instructions] : addLoopGuard(module.instructions, names, options.loopGuard);
  const extraEntries = [...(module.start === null ? [] : [module.start]), ...module.timers.map((spec) => spec.target)];
  const obfuscator = options.obfuscate === null ? null : createObfuscator(names, options.obfuscate, module.hostNames ?? []);
  const pcodeTarget = options.target === 'pcode';
  if (options.tamper !== null && pcodeTarget) throw new CompileError(TAMPER_TEXT.pcode);
  const entryLabels = new Set([...extraEntries, ...guarded.flatMap((instruction) => (instruction.kind === 'label' && instruction.entry ? [instruction.label] : []))]);
  const startTimerUid = options.startTimer && module.start !== null ? names.triggerUid(START_TIMER_LABEL) : null;
  const tamper = options.tamper === null ? null : createTamper(names, options.tamper, { module, entries: entryLabels, startTimerUid });
  const checked = tamper === null ? guarded : tamper.prepare(guarded);
  const prepared = obfuscator === null ? checked : obfuscator.prepare(checked, entryLabels, !pcodeTarget);
  const pcode = pcodeTarget ? buildPcode(prepared, names, extraEntries, obfuscator?.pcode() ?? null) : null;
  const pcodeInit = pcode !== null && obfuscator !== null ? obfuscator.finishPcode(pcode) : [];
  const lowered = pcode === null ? lower(prepared, names) : null;
  const obfuscatedLayout = lowered === null || obfuscator === null ? null : obfuscator.layout(lowered, tamper === null ? undefined : tamper.control);
  const laid = lowered === null ? null : obfuscatedLayout ?? layout(lowered, names, tamper === null ? null : tamper.control(PLAIN_CONTROL, null));
  const obfuscationUids = new Set([...pcodeInit.map((trigger) => trigger.uid), ...(obfuscatedLayout?.machineUids ?? [])]);
  const machineUids = new Set([...(pcode?.vmUids ?? []), ...obfuscationUids]);
  const programTriggers: readonly Trigger[] = pcode === null ? laid?.triggers ?? [] : [...pcode.triggers, ...pcodeInit];
  const uidOf = (label: string): string => {
    if (pcode !== null) return pcode.uidOf(label);
    const uid = laid?.labels.get(label);
    if (uid === undefined) throw new CompileError(TEXT.unknownLabel(label));
    return uid;
  };
  const timers: Timer[] = [];
  if (options.startTimer && module.start !== null) {
    timers.push({ uid: names.triggerUid(START_TIMER_LABEL), target: uidOf(module.start), enabled: true, maxCalls: START_TIMER.maxCalls, delay: START_TIMER.delay });
  }
  timers.push(...module.timers.map((spec) => ({
    uid: names.triggerUid(spec.label), target: uidOf(spec.target), enabled: spec.enabled, maxCalls: spec.maxCalls, delay: spec.delay,
  })));
  const tamperUid = module.tamper === undefined || module.tamper === null ? null : uidOf(module.tamper);
  const exported = new Set((module.exports ?? []).flatMap((entry) => (entry.lengthName === null ? [entry.gameName] : [entry.lengthName])));
  const exportedOpenings = (module.exports ?? []).flatMap((entry) => (entry.lengthName === null ? [] : [entry.gameName.slice(0, entry.gameName.indexOf(ELEMENT_START) + 1)]));
  const finished = tamper?.finish({
    triggers: programTriggers, timers, entryUids: [...new Set([...entryLabels].map(uidOf))], tamperUid,
    kept: (name) => exported.has(name) || exportedOpenings.some((opening) => name.startsWith(opening)),
  }) ?? null;
  const triggers: readonly Trigger[] = [...programTriggers, ...(finished?.triggers ?? [])];
  timers.push(...(finished?.timers ?? []));
  const tamperUids = finished?.machineUids ?? new Set<string>();
  const usesSync = triggers.some((trigger) => trigger.actions.some((action) => SYNC_ACTIONS.has(action.opcode)));
  const program: Program = { triggers, timers, varSyncMark: usesSync && options.varSync === 'add' };
  checkProgram(program);
  const entries = new Map(module.instructions.flatMap((instruction) =>
    (instruction.kind === 'label' && instruction.entry ? [[instruction.label, uidOf(instruction.label)] as const] : [])));
  const objects = module.objects ?? [];
  const startWarning = !options.startTimer && module.start !== null ? [TEXT.noStart(uidOf(module.start))] : [];
  if (usesSync && options.varSync === 'off') startWarning.push(TEXT.noVarSync);
  return {
    program,
    warnings: [
      ...(module.warnings ?? []), ...startWarning, ...(laid?.warnings ?? []),
      ...checkTriggers(program, [...options.externalUids, ...objects.map((object) => object.uid)], new Set([...machineUids, ...tamperUids])),
    ],
    sourceMap: laid?.sourceMap ?? [],
    entries,
    objects,
    mapObjects: [],
    exports: module.exports ?? [],
    obfuscation: obfuscator === null ? null : {
      machineUids: obfuscationUids,
      mapDependent: [...obfuscator.mapDependent, ...(pcode === null ? [] : [names.internalVariable(VM_VARIABLE.base)])],
      texts: obfuscator.texts(),
      legend: names.legend(),
      reveal: names.reveal,
    },
    tamper: tamper === null ? null : { machineUids: tamperUids, variables: tamper.variables },
  };
}
