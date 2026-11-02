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
import { DEFAULT_TARGET } from '../pcode/keys.ts';
import type { Target } from '../pcode/keys.ts';
import type { Trigger } from '../program/types.ts';

export type VarSyncMark = 'add' | 'present' | 'off';

export type CompileOptions = { loopGuard: number | null; startTimer: boolean; externalUids: readonly string[]; varSync: VarSyncMark; protectNumberText: boolean; directIndex: boolean; target: Target };

export const DEFAULT_OPTIONS: CompileOptions = Object.freeze({ loopGuard: DEFAULT_LOOP_GUARD, startTimer: true, externalUids: [], varSync: 'add', protectNumberText: true, directIndex: false, target: DEFAULT_TARGET });

export type CompileResult = {
  program: Program;
  warnings: string[];
  sourceMap: SourceMapEntry[];
  entries: Map<string, string>;
  objects: readonly ObjectDeclaration[];
  exports: readonly ExportedVariable[];
};

export function compileModule(module: Module, names: Names, options: CompileOptions = DEFAULT_OPTIONS): CompileResult {
  const guarded = options.loopGuard === null ? [...module.instructions] : addLoopGuard(module.instructions, names, options.loopGuard);
  const extraEntries = [...(module.start === null ? [] : [module.start]), ...module.timers.map((spec) => spec.target)];
  const pcode = options.target === 'pcode' ? buildPcode(guarded, names, extraEntries) : null;
  const laid = pcode === null ? layout(lower(guarded, names), names) : null;
  const triggers: readonly Trigger[] = pcode?.triggers ?? laid?.triggers ?? [];
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
      ...checkTriggers(program, [...options.externalUids, ...objects.map((object) => object.uid)], pcode?.vmUids ?? new Set()),
    ],
    sourceMap: laid?.sourceMap ?? [],
    entries,
    objects,
    exports: module.exports ?? [],
  };
}
