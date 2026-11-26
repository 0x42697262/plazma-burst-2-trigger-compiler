import type { Instruction, Module, Operand, SourceLocation, TimerSpec } from '../compiler/ir.ts';
import { literal, textOperand, variable } from '../compiler/ir.ts';
import type { LayoutControl, PlacedAction } from '../compiler/layout.ts';
import { layout } from '../compiler/layout.ts';
import { lower } from '../compiler/lower.ts';
import type { Names } from '../compiler/names.ts';
import { INTERNAL_VARIABLE, VARIABLE_MARK } from '../compiler/keys.ts';
import { TEXT } from './text.ts';
import { OPCODE, SKIPS_NEXT } from '../opcodes/constants.ts';
import type { Action, Timer, Trigger } from '../program/types.ts';
import { UNLIMITED_CALLS } from '../program/constants.ts';
import { createRandom } from '../obfuscate/random.ts';
import type { Random } from '../obfuscate/random.ts';
import { FINDING, FIRM_FINDINGS, ONE, SAY_COLOR, SEED_PURPOSE, STATE, TAMPER_LABEL, TAMPER_LAYER, TAMPER_MODE, TAMPER_VARIABLE, ZERO } from './keys.ts';
import type { ActiveMode, FindingKind, TamperLayer } from './keys.ts';
import {
  LATE_MILLISECONDS, PARTNER_SHARE, PULSE_SLACK, REACTION_DELAY, SOFT_PROOF, SOFT_WINDOW, TOKEN_RANGE, UNSET_BEAT, WATCHDOG_DELAY, WINDOW_UNSET,
} from './constants.ts';

export type TamperCheck = { mode: ActiveMode; seed: string; layers: readonly TamperLayer[]; announce?: boolean };

export type CheckValue = { variable: string; value: number };

export type TamperSetup = { module: Module; entries: ReadonlySet<string>; startTimerUid: string | null };

export type FinishInput = { triggers: readonly Trigger[]; timers: readonly Timer[]; entryUids: readonly string[]; tamperUid: string | null; kept: (name: string) => boolean };

export type Finished = { triggers: Trigger[]; timers: Timer[]; machineUids: Set<string> };

export type TamperVariables = { findings: string; last: string; state: string; timeDependent: readonly string[] };

export type Tamper = {
  prepare: (instructions: readonly Instruction[]) => Instruction[];
  control: (inner: LayoutControl, check: CheckValue | null) => LayoutControl;
  finish: (input: FinishInput) => Finished;
  variables: TamperVariables;
};

type ActionInstruction = Extract<Instruction, { kind: 'action' }>;

const text = (value: string): Operand => textOperand(value);

const actionOf = (opcode: number, targetA: string, targetB: string = ZERO, location: SourceLocation | null = null): ActionInstruction =>
  ({ kind: 'action', opcode, targetA: text(targetA), targetB: text(targetB), location });

const placed = (opcode: number, targetA: string, targetB: string = ZERO, location: SourceLocation | null = null): PlacedAction =>
  ({ opcode, targetA: text(targetA), targetB: text(targetB), location });

const isSkipInstruction = (instruction: Instruction | undefined): boolean => instruction?.kind === 'action' && SKIPS_NEXT.has(instruction.opcode);

const transferTargets = (instructions: readonly Instruction[]): Set<string> => {
  const targets = new Set<string>();
  for (const instruction of instructions) {
    if (instruction.kind === 'jump' || instruction.kind === 'branch' || instruction.kind === 'call') targets.add(instruction.label);
    const transfers = instruction.kind === 'action' && (instruction.opcode === OPCODE.switchToTrigger || instruction.opcode === OPCODE.executeTrigger);
    if (transfers && instruction.targetA.kind === 'label') targets.add(instruction.targetA.label);
  }
  return targets;
};

const uniqueNumbers = (random: Random, count: number, taken: Set<number>): number[] => Array.from({ length: count }, () => {
  let value = random.between(TOKEN_RANGE.low, TOKEN_RANGE.high);
  while (taken.has(value)) value = random.between(TOKEN_RANGE.low, TOKEN_RANGE.high);
  taken.add(value);
  return value;
});

const isWholeVariable = (name: string): boolean => name.startsWith(VARIABLE_MARK) && name.indexOf(VARIABLE_MARK, 1) === name.length - 1;

export const foundUid = (names: Names, kind: FindingKind): string => names.triggerUid(TAMPER_LABEL.found(kind));

export function createTamper(names: Names, options: TamperCheck, setup: TamperSetup): Tamper {
  const layers = new Set(options.layers);
  const has = (layer: TamperLayer): boolean => layers.has(layer);
  const enforce = options.mode === TAMPER_MODE.enforce;
  const announce = enforce && options.announce === true;
  const internal = (stem: string): string => names.internalVariable(stem);
  const vars = {
    token: internal(TAMPER_VARIABLE.token), expect: internal(TAMPER_VARIABLE.expect), work: internal(TAMPER_VARIABLE.work), now: internal(TAMPER_VARIABLE.now),
    findings: internal(TAMPER_VARIABLE.findings), last: internal(TAMPER_VARIABLE.last), reported: internal(TAMPER_VARIABLE.reported), state: internal(TAMPER_VARIABLE.state),
    due: internal(TAMPER_VARIABLE.due), softCount: internal(TAMPER_VARIABLE.softCount), softStart: internal(TAMPER_VARIABLE.softStart),
    started: internal(TAMPER_VARIABLE.started), pulse: internal(TAMPER_VARIABLE.pulse), beat: internal(TAMPER_VARIABLE.beat),
    alert: internal(TAMPER_VARIABLE.alert), alertSeen: internal(TAMPER_VARIABLE.alertSeen), firmProof: internal(TAMPER_VARIABLE.firmProof),
  };
  const stop = internal(INTERNAL_VARIABLE.stop);
  const found = (kind: FindingKind): string => foundUid(names, kind);
  const watchdogTimerUid = names.triggerUid(TAMPER_LABEL.watchdogTimer);
  const { module, entries, startTimerUid } = setup;
  const timerUid = (spec: TimerSpec): string => names.triggerUid(spec.label);
  const waitFlags = new Map<string, string>();
  module.timers.forEach((spec, index) => {
    if (!spec.enabled) waitFlags.set(timerUid(spec), internal(TAMPER_VARIABLE.wait(index)));
  });
  let partner: TimerSpec | null = null;
  const choosePartner = (targets: ReadonlySet<string>): TimerSpec | null => (has(TAMPER_LAYER.watchdog) ? [...module.timers]
    .filter((spec) => spec.enabled && spec.maxCalls === UNLIMITED_CALLS && spec.delay * PARTNER_SHARE <= WATCHDOG_DELAY && !targets.has(spec.target) && entries.has(spec.target))
    .sort((first, second) => first.delay - second.delay)[0] ?? null : null);
  const pulseLimit = (spec: TimerSpec): number => Math.floor(WATCHDOG_DELAY / spec.delay) + PULSE_SLACK;
  const timeDependent = [vars.now, vars.due, vars.softStart, vars.beat, vars.work, vars.pulse, vars.expect, vars.token];

  const timerCheck = (uid: string): ActionInstruction[] => [
    actionOf(OPCODE.timerElapsed, vars.work, uid),
    actionOf(OPCODE.setVariable, vars.expect, ZERO),
    actionOf(OPCODE.skipIfEqual, vars.work, vars.expect),
    actionOf(OPCODE.executeTrigger, found('timer')),
  ];

  const prologue = (label: string, targets: ReadonlySet<string>, enabledSites: ReadonlySet<string>): ActionInstruction[] => {
    const checks: ActionInstruction[] = [];
    if (enforce) checks.push(actionOf(OPCODE.skipIfNotEqualValue, vars.state, STATE.done), actionOf(OPCODE.continueIfGreater, stop, stop));
    const spec = module.timers.find((timer) => timer.target === label) ?? null;
    const isStart = label === module.start;
    const alone = !targets.has(label);
    if (has(TAMPER_LAYER.entry) && alone) {
      if (isStart) {
        checks.push(
          actionOf(OPCODE.skipIfNotEqualValue, vars.started, ONE), actionOf(OPCODE.executeTrigger, found('start')), actionOf(OPCODE.setVariable, vars.started, ONE),
          ...(startTimerUid === null ? [] : timerCheck(startTimerUid)),
        );
      } else if (spec !== null) {
        const uid = timerUid(spec);
        const flag = waitFlags.get(uid);
        if (flag !== undefined && enabledSites.has(uid)) {
          checks.push(actionOf(OPCODE.setVariable, vars.expect, ONE), actionOf(OPCODE.skipIfEqual, flag, vars.expect), actionOf(OPCODE.executeTrigger, found('wait')), actionOf(OPCODE.setVariable, flag, ZERO));
        }
        checks.push(...timerCheck(uid));
      }
    }
    if (has(TAMPER_LAYER.watchdog)) {
      if (partner !== null && label === partner.target) {
        checks.push(
          actionOf(OPCODE.setIfUndefined, vars.pulse, ZERO), actionOf(OPCODE.addValue, vars.pulse, ONE), actionOf(OPCODE.setVariable, vars.expect, String(pulseLimit(partner))),
          actionOf(OPCODE.skipIfLess, vars.pulse, vars.expect), actionOf(OPCODE.executeTrigger, found('stalled')),
        );
      } else if (!isStart && spec === null) {
        checks.push(
          actionOf(OPCODE.setIfUndefined, vars.beat, UNSET_BEAT), actionOf(OPCODE.timeSinceStart, vars.work), actionOf(OPCODE.addVariable, vars.work, vars.beat),
          actionOf(OPCODE.setVariable, vars.expect, String(LATE_MILLISECONDS)), actionOf(OPCODE.skipIfLess, vars.work, vars.expect), actionOf(OPCODE.executeTrigger, found('late')),
        );
      }
    }
    return checks;
  };

  const prepare = (instructions: readonly Instruction[]): Instruction[] => {
    const targets = transferTargets(instructions);
    partner = choosePartner(targets);
    const enableSites = new Set(instructions.flatMap((instruction) =>
      (instruction.kind === 'action' && instruction.opcode === OPCODE.enableTimer && instruction.targetA.kind === 'text' && waitFlags.has(instruction.targetA.text) ? [instruction.targetA.text] : [])));
    const output: Instruction[] = [];
    for (const instruction of instructions) {
      const flag = instruction.kind === 'action' && instruction.opcode === OPCODE.enableTimer && instruction.targetA.kind === 'text' && has(TAMPER_LAYER.entry)
        ? waitFlags.get(instruction.targetA.text) : undefined;
      if (flag !== undefined && instruction.kind === 'action') {
        let position = output.length;
        while (position > 0 && isSkipInstruction(output[position - 1])) position -= 1;
        output.splice(position, 0, actionOf(OPCODE.setVariable, flag, ONE, instruction.location));
      }
      output.push(instruction);
      if (instruction.kind === 'label' && entries.has(instruction.label) && instruction.label !== module.tamper) output.push(...prologue(instruction.label, targets, enableSites));
    }
    return output;
  };

  const tokens = createRandom(options.seed, SEED_PURPOSE.tokens);
  const taken = new Set<number>();
  const spent = uniqueNumbers(tokens, 1, taken)[0] ?? 0;
  const ids = new Map<string, number>();
  const idOf = (label: string): number => {
    const known = ids.get(label);
    if (known !== undefined) return known;
    const fresh = uniqueNumbers(tokens, 1, taken)[0] ?? 0;
    ids.set(label, fresh);
    return fresh;
  };

  const control = (inner: LayoutControl, check: CheckValue | null): LayoutControl => {
    if (!has(TAMPER_LAYER.flow)) return inner;
    const isInternal = (label: string): boolean => !entries.has(label);
    const setToken = (label: string, location: SourceLocation | null): PlacedAction => placed(OPCODE.setVariable, vars.token, String(idOf(label)), location);
    const isTokenSet = (action: PlacedAction): boolean => action.opcode === OPCODE.setVariable && action.targetA.kind === 'text' && action.targetA.text === vars.token;
    const expected = (label: string): PlacedAction[] => (check === null
      ? [placed(OPCODE.setVariable, vars.expect, String(idOf(label)))]
      : [placed(OPCODE.copyVariable, vars.expect, check.variable), placed(OPCODE.addValue, vars.expect, String(idOf(label) - check.value))]);
    const plainCall = (label: string, location: SourceLocation | null): PlacedAction[] => [{ opcode: OPCODE.executeTrigger, targetA: { kind: 'label', label }, targetB: text(ZERO), location }];
    return {
      jump: (label, location) => (isInternal(label) ? [setToken(label, location), ...inner.jump(label, location)] : inner.jump(label, location)),
      call: (label, location) => {
        const call = inner.call?.(label, location) ?? plainCall(label, location);
        return isInternal(label) ? [setToken(label, location), ...call] : call;
      },
      enter: (label, entry) => {
        const own = entry || !isInternal(label) ? [] : [
          ...expected(label),
          placed(OPCODE.skipIfEqual, vars.token, vars.expect),
          placed(OPCODE.executeTrigger, found('flow')),
          placed(OPCODE.setVariable, vars.token, String(spent)),
        ];
        return [...own, ...(inner.enter?.(label, entry) ?? [])];
      },
      bindsNext: (action, next) => isTokenSet(action) || inner.bindsNext(action, next),
    };
  };

  const finish = (input: FinishInput): Finished => {
    const reaction = createRandom(options.seed, SEED_PURPOSE.reaction);
    const delay = reaction.between(REACTION_DELAY.low, REACTION_DELAY.high);
    const instructions: Instruction[] = [];
    const act = (opcode: number, targetA: string, targetB: string = ZERO): void => {
      instructions.push(actionOf(opcode, targetA, targetB));
    };
    const mark = (label: string, entry = false): void => {
      instructions.push({ kind: 'label', label, entry });
    };
    const finishRoutine = (): void => {
      instructions.push({ kind: 'return', location: null });
    };
    const watchdogUid = names.triggerUid(TAMPER_LABEL.watchdog);
    const calledFound = new Set(input.triggers.flatMap((trigger) => trigger.actions.flatMap((action) => (action.opcode === OPCODE.executeTrigger ? [action.targetA] : []))));
    const usedKinds = (Object.keys(FINDING) as FindingKind[]).filter((kind) => calledFound.has(found(kind))
      || (kind === 'timer' && has(TAMPER_LAYER.entry)) || (kind === 'idle' && partner !== null && has(TAMPER_LAYER.watchdog)));
    const anyFirm = usedKinds.some((kind) => FIRM_FINDINGS.has(kind));
    const anySoft = usedKinds.some((kind) => !FIRM_FINDINGS.has(kind));

    mark(TAMPER_LABEL.watchdog, true);
    if (has(TAMPER_LAYER.entry)) instructions.push(...timerCheck(watchdogTimerUid));
    if (has(TAMPER_LAYER.watchdog)) {
      if (partner !== null) {
        act(OPCODE.setVariable, vars.expect, ZERO);
        act(OPCODE.skipIfGreater, vars.pulse, vars.expect);
        act(OPCODE.executeTrigger, found('idle'));
        act(OPCODE.setVariable, vars.pulse, ZERO);
      }
      act(OPCODE.timeSinceStart, vars.beat);
      act(OPCODE.negate, vars.beat);
    }
    if (announce) {
      act(OPCODE.setIfUndefined, vars.alert, ZERO);
      act(OPCODE.setIfUndefined, vars.alertSeen, ZERO);
      instructions.push({ kind: 'branch', condition: 'le', left: variable(vars.alert), right: variable(vars.alertSeen), label: TAMPER_LABEL.announced, location: null });
      act(OPCODE.showText, TEXT.announcement, SAY_COLOR);
      act(OPCODE.copyVariable, vars.alertSeen, vars.alert);
      mark(TAMPER_LABEL.announced);
    }
    if (enforce) {
      instructions.push({ kind: 'branch', condition: 'ne', left: variable(vars.state), right: literal(STATE.marked), label: TAMPER_LABEL.watchdogEnd, location: null });
      act(OPCODE.timeSinceStart, vars.now);
      instructions.push({ kind: 'branch', condition: 'lt', left: variable(vars.now), right: variable(vars.due), label: TAMPER_LABEL.watchdogEnd, location: null });
      act(OPCODE.executeTrigger, names.triggerUid(TAMPER_LABEL.reaction));
    } else {
      instructions.push({ kind: 'branch', condition: 'eq', left: variable(vars.findings), right: variable(vars.reported), label: TAMPER_LABEL.watchdogEnd, location: null });
      act(OPCODE.copyVariable, vars.reported, vars.findings);
      if (input.tamperUid !== null) act(OPCODE.executeTrigger, input.tamperUid);
    }
    mark(TAMPER_LABEL.watchdogEnd);
    finishRoutine();

    for (const kind of usedKinds) {
      mark(TAMPER_LABEL.found(kind), true);
      act(OPCODE.setVariable, vars.last, String(FINDING[kind]));
      if (kind === 'late') {
        act(OPCODE.timeSinceStart, vars.beat);
        act(OPCODE.negate, vars.beat);
      }
      instructions.push({ kind: 'jump', label: FIRM_FINDINGS.has(kind) ? TAMPER_LABEL.firm : TAMPER_LABEL.soft, location: null });
    }
    const count = (): void => {
      act(OPCODE.setIfUndefined, vars.findings, ZERO);
      act(OPCODE.addValue, vars.findings, ONE);
      act(OPCODE.enableTimer, watchdogTimerUid);
      act(OPCODE.setTimerCalls, watchdogTimerUid, String(UNLIMITED_CALLS));
    };
    if (anyFirm) {
      mark(TAMPER_LABEL.firm, true);
      count();
      if (announce) act(OPCODE.setVariable, vars.firmProof, ONE);
      if (enforce) act(OPCODE.executeTrigger, names.triggerUid(TAMPER_LABEL.proof));
      finishRoutine();
    }
    if (anySoft) {
      mark(TAMPER_LABEL.soft, true);
      count();
      if (enforce) {
        act(OPCODE.setIfUndefined, vars.softStart, WINDOW_UNSET);
        act(OPCODE.timeSinceStart, vars.now);
        act(OPCODE.copyVariable, vars.work, vars.now);
        act(OPCODE.addVariable, vars.work, vars.softStart);
        instructions.push({ kind: 'branch', condition: 'gt', left: variable(vars.work), right: literal(String(SOFT_WINDOW)), label: TAMPER_LABEL.softReset, location: null });
        mark(TAMPER_LABEL.softCounted);
        act(OPCODE.setIfUndefined, vars.softCount, ZERO);
        act(OPCODE.addValue, vars.softCount, ONE);
        instructions.push({ kind: 'branch', condition: 'lt', left: variable(vars.softCount), right: literal(String(SOFT_PROOF)), label: TAMPER_LABEL.proofEnd, location: null });
        act(OPCODE.executeTrigger, names.triggerUid(TAMPER_LABEL.proof));
        finishRoutine();
        mark(TAMPER_LABEL.softReset);
        act(OPCODE.setVariable, vars.softCount, ZERO);
        act(OPCODE.copyVariable, vars.softStart, vars.now);
        act(OPCODE.negate, vars.softStart);
        instructions.push({ kind: 'jump', label: TAMPER_LABEL.softCounted, location: null });
      } else {
        finishRoutine();
      }
    }
    if (enforce) {
      mark(TAMPER_LABEL.proof, true);
      instructions.push({ kind: 'branch', condition: 'eq', left: variable(vars.state), right: literal(STATE.marked), label: TAMPER_LABEL.proofEnd, location: null });
      instructions.push({ kind: 'branch', condition: 'eq', left: variable(vars.state), right: literal(STATE.done), label: TAMPER_LABEL.proofEnd, location: null });
      act(OPCODE.setVariable, vars.state, STATE.marked);
      act(OPCODE.timeSinceStart, vars.due);
      act(OPCODE.addValue, vars.due, String(delay));
      mark(TAMPER_LABEL.proofEnd);
      finishRoutine();

      const ownNames = (triggers: readonly Trigger[]): string[] => triggers.flatMap((trigger) => trigger.actions.flatMap((action: Action) => [action.targetA, action.targetB]));
      const reset = new Set([...ownNames(input.triggers), ...Object.values(vars), names.internalVariable(INTERNAL_VARIABLE.right)]
        .filter((name) => isWholeVariable(name) && names.ownsVariable(name) && ![vars.state, vars.alert, vars.alertSeen].includes(name) && !input.kept(name)));
      mark(TAMPER_LABEL.reaction, true);
      act(OPCODE.setVariable, vars.state, STATE.done);
      if (input.tamperUid !== null) act(OPCODE.executeTrigger, input.tamperUid);
      if (announce) {
        instructions.push({ kind: 'branch', condition: 'ne', left: variable(vars.firmProof), right: literal(ONE), label: TAMPER_LABEL.quietReaction, location: null });
        act(OPCODE.setIfUndefined, vars.alert, ZERO);
        act(OPCODE.addValue, vars.alert, ONE);
        act(OPCODE.syncReplace, vars.alert);
        mark(TAMPER_LABEL.quietReaction);
      }
      for (const name of [...reset].sort()) act(OPCODE.setVariable, name, ZERO);
      for (const uid of input.entryUids) act(OPCODE.disableTrigger, uid);
      for (const timer of [...input.timers, { uid: watchdogTimerUid }]) act(OPCODE.disableTimer, timer.uid);
      finishRoutine();
    }
    const laid = layout(lower(instructions, names), names);
    const timer: Timer = { uid: watchdogTimerUid, target: watchdogUid, enabled: true, maxCalls: UNLIMITED_CALLS, delay: WATCHDOG_DELAY };
    return { triggers: laid.triggers, timers: [timer], machineUids: new Set(laid.triggers.map((trigger) => trigger.uid)) };
  };

  return { prepare, control, finish, variables: { findings: vars.findings, last: vars.last, state: vars.state, timeDependent } };
}
