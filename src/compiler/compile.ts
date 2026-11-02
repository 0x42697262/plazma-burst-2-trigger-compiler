import type { Program, Timer } from '../program/types.ts';
import { START_TIMER } from '../program/constants.ts';
import { checkProgram } from '../emit/check.ts';
import type { Module } from './ir.ts';
import type { Names } from './names.ts';
import { CompileError } from './names.ts';
import { addLoopGuard } from './guard.ts';
import { lower } from './lower.ts';
import { layout } from './layout.ts';
import type { SourceMapEntry } from './layout.ts';
import { checkTriggers } from './check.ts';
import { DEFAULT_LOOP_GUARD } from './constants.ts';
import { START_TIMER_LABEL } from './keys.ts';
import { TEXT } from './text.ts';

export type CompileOptions = { loopGuard: number | null; startTimer: boolean; externalUids: readonly string[] };

export const DEFAULT_OPTIONS: CompileOptions = Object.freeze({ loopGuard: DEFAULT_LOOP_GUARD, startTimer: true, externalUids: [] });

export type CompileResult = { program: Program; warnings: string[]; sourceMap: SourceMapEntry[]; entries: Map<string, string> };

export function compileModule(module: Module, names: Names, options: CompileOptions = DEFAULT_OPTIONS): CompileResult {
  const guarded = options.loopGuard === null ? [...module.instructions] : addLoopGuard(module.instructions, names, options.loopGuard);
  const laid = layout(lower(guarded, names), names);
  const uidOf = (label: string): string => {
    const uid = laid.labels.get(label);
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
  const program: Program = { triggers: laid.triggers, timers };
  checkProgram(program);
  const entries = new Map(module.instructions.flatMap((instruction) =>
    (instruction.kind === 'label' && instruction.entry ? [[instruction.label, uidOf(instruction.label)] as const] : [])));
  const startWarning = !options.startTimer && module.start !== null ? [TEXT.noStart(uidOf(module.start))] : [];
  return {
    program,
    warnings: [...(module.warnings ?? []), ...startWarning, ...laid.warnings, ...checkTriggers(program, options.externalUids)],
    sourceMap: laid.sourceMap,
    entries,
  };
}
