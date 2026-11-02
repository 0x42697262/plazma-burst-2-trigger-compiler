import type { MachineItem } from '../compiler/lower.ts';
import type { LayoutControl, LayoutResult, PlacedAction } from '../compiler/layout.ts';
import type { Operand, SourceLocation } from '../compiler/ir.ts';
import { labelOperand, textOperand } from '../compiler/ir.ts';
import type { Names } from '../compiler/names.ts';
import { CompileError } from '../compiler/names.ts';
import type { Action, Trigger } from '../program/types.ts';
import { UNLIMITED_CALLS } from '../program/constants.ts';
import { OPCODE, SKIPS_NEXT } from '../opcodes/constants.ts';
import type { Random } from './random.ts';
import type { Variables } from './init.ts';
import { OBFUSCATION_LABEL, UID_MARK, ZERO } from './keys.ts';
import {
  DECOY_JUMP_CHANCE, GROUP_CHANCE, GROUP_DECOY_ROWS, GROUP_REAL_ROWS, PREDICATE_CHANCE, PREDICATE_MODULUS, RADIX, RUN_RESET, RUN_STEP, RUN_UPDATE_CHANCE,
  SELECT_MODULUS, STATE_SPREAD,
} from './constants.ts';
import { TEXT } from './text.ts';

type ActionItem = Extract<MachineItem, { kind: 'action' }>;

export type FlowContext = { names: Names; random: Random; vars: Variables; check: number; dispatchUid: string };

const GROUPABLE: ReadonlySet<number> = new Set([
  OPCODE.showText, OPCODE.setVariable, OPCODE.setIfUndefined, OPCODE.addValue, OPCODE.multiplyValue, OPCODE.addVariable, OPCODE.multiplyVariable,
  OPCODE.round, OPCODE.floor, OPCODE.moduloValue, OPCODE.copyVariable, OPCODE.moduloVariable, OPCODE.divideValue, OPCODE.divideVariable,
  OPCODE.powerVariable, OPCODE.powerValue, OPCODE.containsValue, OPCODE.containsVariable, OPCODE.length, OPCODE.appendString, OPCODE.negate,
  OPCODE.loadIndirect, OPCODE.replaceInVariable, OPCODE.replaceInValue, OPCODE.storeIndirect, OPCODE.splitByValue, OPCODE.arrayGetIndex,
  OPCODE.removeStart,
]);

const text = (value: string): Operand => textOperand(value);

const actionItem = (opcode: number, targetA: Operand, targetB: Operand, location: SourceLocation | null): ActionItem =>
  ({ kind: 'action', opcode, targetA, targetB, location });

const isSkip = (item: MachineItem | undefined): boolean => item?.kind === 'action' && SKIPS_NEXT.has(item.opcode);

const isGroupable = (item: MachineItem): item is ActionItem =>
  item.kind === 'action' && GROUPABLE.has(item.opcode) && item.targetA.kind === 'text' && item.targetB.kind === 'text';

const isCall = (item: MachineItem | undefined): boolean => item?.kind === 'action' && item.opcode === OPCODE.executeTrigger;

const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

const jumpTargets = (items: readonly MachineItem[]): string[] => [...new Set(items.flatMap((item) =>
  (item.kind === 'action' && item.opcode === OPCODE.switchToTrigger && item.targetA.kind === 'label' ? [item.targetA.label] : [])))];

export function insertPredicates(items: readonly MachineItem[], context: FlowContext): MachineItem[] {
  const { random, vars, check } = context;
  const targets = jumpTargets(items);
  const decoys = items.filter(isGroupable);
  const output: MachineItem[] = [];
  items.forEach((item, position) => {
    output.push(item);
    const next = items[position + 1];
    const open = item.kind === 'label' || (item.kind === 'action' && !SKIPS_NEXT.has(item.opcode));
    if (!open || next?.kind !== 'action' || isCall(next) || (targets.length === 0 && decoys.length === 0) || !random.chance(PREDICATE_CHANCE)) return;
    const divisor = random.between(PREDICATE_MODULUS.low, PREDICATE_MODULUS.high);
    const never = modulo(check + random.between(1, divisor), divisor);
    const location = next.location;
    output.push(
      actionItem(OPCODE.copyVariable, text(vars.work), text(vars.check), location),
      actionItem(OPCODE.moduloValue, text(vars.work), text(String(divisor)), location),
      actionItem(OPCODE.skipIfNotEqualValue, text(vars.work), text(String(never)), location),
    );
    const jumps = targets.length > 0 && (decoys.length === 0 || random.chance(DECOY_JUMP_CHANCE));
    const decoy = jumps ? actionItem(OPCODE.switchToTrigger, labelOperand(random.pick(targets)), text(ZERO), location) : { ...random.pick(decoys), location };
    output.push(decoy);
  });
  return output;
}

export type Grouped = { items: MachineItem[]; groupLabels: Set<string> };

export function groupIntoSelectors(items: readonly MachineItem[], context: FlowContext): Grouped {
  const { names, random, vars, check } = context;
  const candidates = items.filter(isGroupable);
  const output: MachineItem[] = [];
  const pending: { action: ActionItem; value: number }[] = [];
  const groups: MachineItem[][] = [];
  const groupLabels = new Set<string>();
  let label = names.freshLabel(OBFUSCATION_LABEL.group);
  let used = new Set<number>();
  const freshValue = (): number => {
    let value = random.below(SELECT_MODULUS);
    while (used.has(value)) value = random.below(SELECT_MODULUS);
    used.add(value);
    return value;
  };
  const closeGroup = (): void => {
    if (pending.length === 0) return;
    const decoyCount = random.between(GROUP_DECOY_ROWS.low, GROUP_DECOY_ROWS.high);
    const rows = [
      ...pending.map((entry) => ({ action: entry.action, value: entry.value })),
      ...Array.from({ length: decoyCount }, () => ({ action: random.pick(candidates), value: freshValue() })),
    ];
    groups.push([
      { kind: 'label', label, entry: false },
      actionItem(OPCODE.addVariable, text(vars.select), text(vars.check), null),
      actionItem(OPCODE.moduloValue, text(vars.select), text(String(SELECT_MODULUS)), null),
      ...random.shuffle(rows).flatMap((row) => [actionItem(OPCODE.skipIfNotEqualValue, text(vars.select), text(String(row.value)), row.action.location), row.action]),
      { kind: 'end' },
    ]);
    groupLabels.add(label);
    pending.length = 0;
    label = names.freshLabel(OBFUSCATION_LABEL.group);
    used = new Set<number>();
  };
  items.forEach((item, position) => {
    const previous = items[position - 1];
    if (!isGroupable(item) || isSkip(previous) || !random.chance(GROUP_CHANCE)) {
      output.push(item);
      return;
    }
    const value = freshValue();
    const selector = modulo(value - check, SELECT_MODULUS) + SELECT_MODULUS * random.between(STATE_SPREAD.low, STATE_SPREAD.high);
    output.push(
      actionItem(OPCODE.setVariable, text(vars.select), text(String(selector)), item.location),
      actionItem(OPCODE.executeTrigger, labelOperand(label), text(ZERO), item.location),
    );
    pending.push({ action: item, value });
    if (pending.length >= GROUP_REAL_ROWS) closeGroup();
  });
  closeGroup();
  return { items: [...output, ...groups.flat()], groupLabels };
}

const isRunSet = (action: { opcode: number; targetA: Operand }, vars: Variables): boolean =>
  action.opcode === OPCODE.setVariable && action.targetA.kind === 'text' && action.targetA.text === vars.run;

const isStateSet = (action: { opcode: number; targetA: Operand }, vars: Variables): boolean =>
  action.opcode === OPCODE.setVariable && action.targetA.kind === 'text' && action.targetA.text === vars.state;

export function insertRunChecks(items: readonly MachineItem[], groupLabels: ReadonlySet<string>, context: FlowContext): MachineItem[] {
  const { random, vars } = context;
  const reset = (location: SourceLocation | null): ActionItem =>
    actionItem(OPCODE.setVariable, text(vars.run), text(String(random.between(RUN_RESET.low, RUN_RESET.high))), location);
  const isGroupCall = (item: ActionItem): boolean => item.targetA.kind === 'label' && groupLabels.has(item.targetA.label);
  const output: MachineItem[] = [];
  let inGroup = false;
  items.forEach((item, position) => {
    output.push(item);
    const next = items[position + 1];
    if (item.kind === 'label') inGroup = groupLabels.has(item.label);
    if (inGroup) return;
    if (item.kind === 'label') {
      const callsFirst = next?.kind === 'action' && next.opcode === OPCODE.executeTrigger && !isGroupCall(next);
      if (next?.kind === 'action' && !callsFirst) output.push(reset(next.location));
      return;
    }
    if (item.kind !== 'action') return;
    if (item.opcode === OPCODE.executeTrigger && !isGroupCall(item)) {
      output.push(reset(item.location));
      return;
    }
    if (!SKIPS_NEXT.has(item.opcode) && next?.kind === 'action' && random.chance(RUN_UPDATE_CHANCE)) {
      output.push(actionItem(OPCODE.addValue, text(vars.run), text(String(random.between(RUN_STEP.low, RUN_STEP.high))), item.location));
    }
  });
  return output;
}

export function flowControl(context: FlowContext): LayoutControl {
  const { vars, dispatchUid } = context;
  return {
    jump: (label, location): PlacedAction[] => [
      { opcode: OPCODE.setVariable, targetA: text(vars.state), targetB: labelOperand(label), location },
      { opcode: OPCODE.switchToTrigger, targetA: text(dispatchUid), targetB: text(ZERO), location },
    ],
    bindsNext: (action, next) => SKIPS_NEXT.has(action.opcode) || isStateSet(action, vars)
      || (action.opcode === OPCODE.executeTrigger && next !== undefined && isRunSet(next, vars)),
  };
}

export type Flow = { region: Trigger[]; dispatcher: Trigger };

export function finishFlow(laid: LayoutResult, context: FlowContext): Flow {
  const { random, vars, check, dispatchUid } = context;
  const region = random.shuffle(laid.triggers);
  const size = region.length;
  const offsets = new Map(region.map((trigger, index) => [trigger.uid, index]));
  let run: number | null = null;
  const resolved = new Map<string, Trigger>();
  for (const trigger of laid.triggers) {
    if (!laid.continuations.has(trigger.uid)) run = null;
    const actions = trigger.actions.map((action): Action => {
      if (action.opcode === OPCODE.setVariable && action.targetA === vars.run) {
        run = parseInt(action.targetB, RADIX);
      } else if (action.opcode === OPCODE.addValue && action.targetA === vars.run && run !== null) {
        run += parseInt(action.targetB, RADIX);
      } else if (action.opcode === OPCODE.setVariable && action.targetA === vars.state && action.targetB.startsWith(UID_MARK)) {
        const offset = offsets.get(action.targetB);
        if (offset === undefined) throw new CompileError(TEXT.unknownJump(trigger.uid, action.targetB));
        if (run === null) throw new CompileError(TEXT.noRunValue(trigger.uid));
        const state = modulo(offset - run - check, size) + size * random.between(STATE_SPREAD.low, STATE_SPREAD.high);
        return { ...action, targetB: String(state) };
      }
      return action;
    });
    resolved.set(trigger.uid, { ...trigger, actions });
  }
  const act = (opcode: number, targetA: string, targetB: string = ZERO): Action => ({ opcode, targetA, targetB });
  const dispatcher: Trigger = {
    uid: dispatchUid,
    enabled: true,
    maxCalls: UNLIMITED_CALLS,
    actions: [
      act(OPCODE.addVariable, vars.state, vars.run),
      act(OPCODE.addVariable, vars.state, vars.check),
      act(OPCODE.moduloVariable, vars.state, vars.size),
      act(OPCODE.addVariable, vars.state, vars.base),
      act(OPCODE.switchToTriggerIndex, vars.state),
    ],
  };
  return { region: region.map((trigger) => resolved.get(trigger.uid) ?? trigger), dispatcher };
}
