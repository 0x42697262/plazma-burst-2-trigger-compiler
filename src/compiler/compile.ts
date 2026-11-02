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
import { START_TIMER_LABEL } from './keys.ts';
import { TEXT } from './text.ts';
import { buildPcode } from '../pcode/pcode.ts';
import { DEFAULT_TARGET, VM_VARIABLE } from '../pcode/keys.ts';
import type { Target } from '../pcode/keys.ts';
import type { Trigger } from '../program/types.ts';
import { createObfuscator } from '../obfuscate/obfuscate.ts';
import type { Obfuscation } from '../obfuscate/obfuscate.ts';
import type { EncodedText } from '../obfuscate/texts.ts';
import type { LegendEntry } from './names.ts';

export type VarSyncMark = 'add' | 'present' | 'off';

export type CompileOptions = { loopGuard: number | null; startTimer: boolean; externalUids: readonly string[]; varSync: VarSyncMark; protectNumberText: boolean; directIndex: boolean; target: Target;
  environment: Readonly<Record<string, string | undefined>>;
  obfuscate: Obfuscation | null;
};

export const DEFAULT_OPTIONS: CompileOptions = Object.freeze({
  loopGuard: DEFAULT_LOOP_GUARD, startTimer: true, externalUids: [], varSync: 'add', protectNumberText: true, directIndex: false, target: DEFAULT_TARGET, environment: {}, obfuscate: null,
});

export type ObfuscationReport = {
  machineUids: ReadonlySet<string>; mapDependent: readonly string[]; texts: readonly EncodedText[]; legend: readonly LegendEntry[]; reveal: (name: string) => string;
};

export type CompileResult = {
  program: Program;
  warnings: string[];
  sourceMap: SourceMapEntry[];
  entries: Map<string, string>;
  objects: readonly ObjectDeclaration[];
  exports: readonly ExportedVariable[];
  obfuscation: ObfuscationReport | null;
};

export function compileModule(module: Module, names: Names, options: CompileOptions = DEFAULT_OPTIONS): CompileResult {
  const guarded = options.loopGuard === null ? [...module.instructions] : addLoopGuard(module.instructions, names, options.loopGuard);
  const extraEntries = [...(module.start === null ? [] : [module.start]), ...module.timers.map((spec) => spec.target)];
  const obfuscator = options.obfuscate === null ? null : createObfuscator(names, options.obfuscate, module.hostNames ?? []);
  const pcodeTarget = options.target === 'pcode';
  const entryLabels = new Set([...extraEntries, ...guarded.flatMap((instruction) => (instruction.kind === 'label' && instruction.entry ? [instruction.label] : []))]);
  const prepared = obfuscator === null ? guarded : obfuscator.prepare(guarded, entryLabels, !pcodeTarget);
  const pcode = pcodeTarget ? buildPcode(prepared, names, extraEntries, obfuscator?.pcode() ?? null) : null;
  const pcodeInit = pcode !== null && obfuscator !== null ? obfuscator.finishPcode(pcode) : [];
  const lowered = pcode === null ? lower(prepared, names) : null;
  const obfuscatedLayout = lowered === null || obfuscator === null ? null : obfuscator.layout(lowered);
  const laid = lowered === null ? null : obfuscatedLayout ?? layout(lowered, names);
  const obfuscationUids = new Set([...pcodeInit.map((trigger) => trigger.uid), ...(obfuscatedLayout?.machineUids ?? [])]);
  const machineUids = new Set([...(pcode?.vmUids ?? []), ...obfuscationUids]);
  const triggers: readonly Trigger[] = pcode === null ? laid?.triggers ?? [] : [...pcode.triggers, ...pcodeInit];
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
      ...checkTriggers(program, [...options.externalUids, ...objects.map((object) => object.uid)], machineUids),
    ],
    sourceMap: laid?.sourceMap ?? [],
    entries,
    objects,
    exports: module.exports ?? [],
    obfuscation: obfuscator === null ? null : {
      machineUids: obfuscationUids,
      mapDependent: [...obfuscator.mapDependent, ...(pcode === null ? [] : [names.internalVariable(VM_VARIABLE.base)])],
      texts: obfuscator.texts(),
      legend: names.legend(),
      reveal: names.reveal,
    },
  };
}
