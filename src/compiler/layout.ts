import { MAX_ACTIONS_PER_TRIGGER, UNLIMITED_CALLS } from '../program/constants.ts';
import type { Action, Trigger } from '../program/types.ts';
import { OPCODE, SKIPS_NEXT } from '../opcodes/constants.ts';
import type { Operand, SourceLocation } from './ir.ts';
import { labelOperand, textOperand } from './ir.ts';
import type { MachineItem } from './lower.ts';
import type { Names } from './names.ts';
import { CompileError } from './names.ts';
import { BEFORE_LAST, FIRST_CONTINUATION } from './constants.ts';
import { INTERNAL_VARIABLE, ZERO_VALUE } from './keys.ts';
import { TEXT } from './text.ts';

type PlacedAction = { opcode: number; targetA: Operand; targetB: Operand; location: SourceLocation | null };
type Block = { label: string; entry: boolean; actions: PlacedAction[]; fallsThrough: boolean };

export type SourceMapEntry = { uid: string; lines: number[] };
export type LayoutResult = { triggers: Trigger[]; warnings: string[]; sourceMap: SourceMapEntry[]; labels: Map<string, string> };

const referencedLabels = (items: readonly MachineItem[]): Set<string> => {
  const labels = new Set<string>();
  for (const item of items) {
    if (item.kind !== 'action') continue;
    for (const operand of [item.targetA, item.targetB]) if (operand.kind === 'label') labels.add(operand.label);
  }
  return labels;
};

const buildBlocks = (items: readonly MachineItem[], warnings: string[]): Block[] => {
  const referenced = referencedLabels(items);
  const blocks: Block[] = [];
  let current: Block | null = null;
  let reachable = true;
  let dropped = 0;
  const closeDropped = (): void => {
    if (current && dropped > 0) warnings.push(TEXT.unreachable(current.label, dropped));
    dropped = 0;
  };
  for (const item of items) {
    if (item.kind === 'label') {
      const startsTrigger = item.entry || referenced.has(item.label) || current === null;
      if (!startsTrigger) continue;
      closeDropped();
      current = { label: item.label, entry: item.entry, actions: [], fallsThrough: true };
      blocks.push(current);
      reachable = true;
      continue;
    }
    if (!current) throw new CompileError(TEXT.noStartLabel);
    if (item.kind === 'end') {
      if (reachable) current.fallsThrough = false;
      reachable = false;
      continue;
    }
    if (!reachable) {
      dropped += 1;
      continue;
    }
    current.actions.push(item);
  }
  closeDropped();
  return blocks;
};

const groupActions = (actions: readonly PlacedAction[]): PlacedAction[][] => {
  const groups: PlacedAction[][] = [];
  let current: PlacedAction[] = [];
  for (const action of actions) {
    current.push(action);
    if (!SKIPS_NEXT.has(action.opcode)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
};

const jumpAction = (label: string): PlacedAction => ({
  opcode: OPCODE.switchToTrigger, targetA: labelOperand(label), targetB: { kind: 'text', text: ZERO_VALUE }, location: null,
});

type Chunk = { label: string; actions: PlacedAction[] };

const splitBlock = (block: Block, names: Names): Chunk[] => {
  const groups = groupActions(block.actions);
  const chunks: Chunk[] = [];
  let label = block.label;
  let current: PlacedAction[] = [];
  let part = FIRST_CONTINUATION;
  let remaining = block.actions.length;
  for (const group of groups) {
    if (current.length + remaining <= MAX_ACTIONS_PER_TRIGGER) {
      current.push(...group);
      remaining -= group.length;
      continue;
    }
    if (current.length + group.length > MAX_ACTIONS_PER_TRIGGER - 1) {
      const next = names.continuationLabel(block.label, part);
      part += 1;
      current.push(jumpAction(next));
      chunks.push({ label, actions: current });
      label = next;
      current = [];
    }
    current.push(...group);
    remaining -= group.length;
  }
  chunks.push({ label, actions: current });
  return chunks;
};

const resolveOperand = (operand: Operand, labels: ReadonlyMap<string, string>): string => {
  if (operand.kind === 'text') return operand.text;
  const uid = labels.get(operand.label);
  if (uid === undefined) throw new CompileError(TEXT.unknownLabel(operand.label));
  return uid;
};

const checkDuplicates = (items: readonly MachineItem[]): void => {
  const seen = new Set<string>();
  for (const item of items) {
    if (item.kind !== 'label') continue;
    if (seen.has(item.label)) throw new CompileError(TEXT.duplicateLabel(item.label));
    seen.add(item.label);
  }
};

const isPassThrough = (block: Block, next: Block | undefined): next is Block => !block.entry && block.fallsThrough && block.actions.length === 0 && next !== undefined;

const removePassThroughs = (blocks: readonly Block[]): { kept: Block[]; aliases: Map<string, string> } => {
  const aliases = new Map<string, string>();
  const kept: Block[] = [];
  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    if (isPassThrough(block, next)) aliases.set(block.label, next.label);
    else kept.push(block);
  });
  const finalLabel = (label: string): string => {
    let resolved = label;
    for (let next = aliases.get(resolved); next !== undefined; next = aliases.get(resolved)) resolved = next;
    return resolved;
  };
  return { kept, aliases: new Map([...aliases.keys()].map((label) => [label, finalLabel(label)])) };
};

const followAlias = (operand: Operand, aliases: ReadonlyMap<string, string>): Operand =>
  (operand.kind === 'label' && aliases.has(operand.label) ? labelOperand(aliases.get(operand.label) ?? operand.label) : operand);

const stopAction = (names: Names): PlacedAction => {
  const name = textOperand(names.internalVariable(INTERNAL_VARIABLE.stop));
  return { opcode: OPCODE.continueIfGreater, targetA: name, targetB: name, location: null };
};

const isStop = (action: PlacedAction | undefined, stop: PlacedAction): boolean =>
  action !== undefined && action.opcode === stop.opcode && action.targetA.kind === 'text' && stop.targetA.kind === 'text' && action.targetA.text === stop.targetA.text;

const removeExitBlocks = (blocks: Block[], names: Names): Block[] => {
  const exits = new Set(blocks
    .filter((block, index) => !block.entry && block.actions.length === 0 && (!block.fallsThrough || index === blocks.length - 1))
    .map((block) => block.label));
  if (exits.size === 0) return blocks;
  const stop = stopAction(names);
  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    if (block.fallsThrough && next && exits.has(next.label)) block.fallsThrough = false;
    block.actions = block.actions.map((action) =>
      (action.opcode === OPCODE.switchToTrigger && action.targetA.kind === 'label' && exits.has(action.targetA.label) ? stop : action));
    while (isStop(block.actions[block.actions.length - 1], stop) && !SKIPS_NEXT.has(block.actions.at(BEFORE_LAST)?.opcode ?? 0)) {
      block.actions.pop();
    }
  });
  const referenced = new Set(blocks.flatMap((block) => block.actions.flatMap((action) =>
    [action.targetA, action.targetB].flatMap((operand) => (operand.kind === 'label' ? [operand.label] : [])))));
  return blocks.filter((block) => !exits.has(block.label) || referenced.has(block.label));
};

export function layout(items: readonly MachineItem[], names: Names): LayoutResult {
  const warnings: string[] = [];
  checkDuplicates(items);
  const { kept, aliases } = removePassThroughs(buildBlocks(items, warnings));
  for (const block of kept) {
    block.actions = block.actions.map((action) => ({ ...action, targetA: followAlias(action.targetA, aliases), targetB: followAlias(action.targetB, aliases) }));
  }
  const blocks = removeExitBlocks(kept, names);
  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    if (block.fallsThrough && next) block.actions.push(jumpAction(next.label));
  });
  const chunks = blocks.flatMap((block) => splitBlock(block, names));
  const labels = new Map(chunks.map((chunk) => [chunk.label, names.triggerUid(chunk.label)]));
  for (const [label, target] of aliases) {
    const uid = labels.get(target);
    if (uid !== undefined) labels.set(label, uid);
  }
  const triggers = chunks.map((chunk): Trigger => ({
    uid: names.triggerUid(chunk.label),
    enabled: true,
    maxCalls: UNLIMITED_CALLS,
    actions: chunk.actions.map((action): Action => ({
      opcode: action.opcode,
      targetA: resolveOperand(action.targetA, labels),
      targetB: resolveOperand(action.targetB, labels),
    })),
  }));
  const sourceMap = chunks.map((chunk) => ({
    uid: names.triggerUid(chunk.label),
    lines: chunk.actions.map((action) => action.location?.line ?? 0),
  }));
  return { triggers, warnings, sourceMap, labels };
}
