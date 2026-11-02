import { OPCODE, SKIPS_NEXT } from '../opcodes/constants.ts';
import type { Instruction } from './ir.ts';
import { labelOperand, textOperand } from './ir.ts';
import { INTERNAL_VARIABLE, LABEL_HINT, STEP_VALUE, ZERO_VALUE } from './keys.ts';
import type { Names } from './names.ts';

type Redirectable = Extract<Instruction, { kind: 'jump' | 'branch' | 'call' }>;

const isRedirectable = (instruction: Instruction): instruction is Redirectable =>
  instruction.kind === 'jump' || instruction.kind === 'branch' || instruction.kind === 'call';

const TRANSFER_ACTIONS: ReadonlySet<number> = new Set([OPCODE.executeTrigger, OPCODE.switchToTrigger]);

const rawTarget = (instruction: Instruction): string | null =>
  (instruction.kind === 'action' && TRANSFER_ACTIONS.has(instruction.opcode) && instruction.targetA.kind === 'label' ? instruction.targetA.label : null);

const redirect = (instruction: Instruction, bodies: ReadonlyMap<string, string>): Instruction => {
  if (isRedirectable(instruction)) return { ...instruction, label: bodies.get(instruction.label) ?? instruction.label };
  const target = rawTarget(instruction);
  if (target === null || instruction.kind !== 'action' || !bodies.has(target)) return instruction;
  return { ...instruction, targetA: labelOperand(bodies.get(target) ?? target) };
};

const backEdgeTarget = (instruction: Instruction): string | null => {
  if (instruction.kind === 'jump' || instruction.kind === 'branch') return instruction.label;
  return instruction.kind === 'action' && instruction.opcode === OPCODE.switchToTrigger ? rawTarget(instruction) : null;
};

const isSkip = (instruction: Instruction | undefined): boolean => instruction?.kind === 'action' && SKIPS_NEXT.has(instruction.opcode);

const referencedLabels = (instructions: readonly Instruction[]): Set<string> => {
  const labels = new Set<string>();
  for (const instruction of instructions) {
    if (isRedirectable(instruction)) labels.add(instruction.label);
    if (instruction.kind !== 'action') continue;
    for (const operand of [instruction.targetA, instruction.targetB]) if (operand.kind === 'label') labels.add(operand.label);
  }
  return labels;
};

const mayFallThrough = (guarded: readonly Instruction[], referenced: ReadonlySet<string>): boolean => {
  for (let position = guarded.length - 1; position >= 0; position--) {
    const instruction = guarded[position] as Instruction;
    if (instruction.kind === 'label') {
      if (referenced.has(instruction.label)) return true;
      continue;
    }
    const ends = instruction.kind === 'jump' || instruction.kind === 'return' || (instruction.kind === 'action' && instruction.opcode === OPCODE.switchToTrigger);
    if (!ends) return true;
    return isSkip(guarded[position - 1]);
  }
  return false;
};

const entryBodies = (instructions: readonly Instruction[], names: Names): Map<string, string> => {
  const bodies = new Map<string, string>();
  for (const instruction of instructions) {
    if (instruction.kind === 'label' && instruction.entry) bodies.set(instruction.label, names.freshLabel(LABEL_HINT.body));
  }
  return bodies;
};

export function addLoopGuard(instructions: readonly Instruction[], names: Names, limit: number): Instruction[] {
  const steps = textOperand(names.internalVariable(INTERNAL_VARIABLE.steps));
  const bodies = entryBodies(instructions, names);
  const referenced = referencedLabels(instructions);
  const guarded: Instruction[] = [];
  const defined = new Set<string>();
  for (const original of instructions) {
    const instruction = redirect(original, bodies);
    const backTarget = backEdgeTarget(instruction);
    if (backTarget !== null && defined.has(backTarget)) {
      const location = instruction.kind === 'label' ? null : instruction.location;
      const counting: Instruction[] = [
        { kind: 'action', opcode: OPCODE.addValue, targetA: steps, targetB: textOperand(STEP_VALUE), location },
        { kind: 'action', opcode: OPCODE.continueIfLessValue, targetA: steps, targetB: textOperand(String(limit)), location },
      ];
      const skips: Instruction[] = [];
      while (isSkip(guarded.at(-1))) skips.unshift(guarded.pop() as Instruction);
      guarded.push(...counting, ...skips);
    }
    const body = instruction.kind === 'label' ? bodies.get(instruction.label) : undefined;
    if (instruction.kind === 'label' && body !== undefined) {
      if (!isSkip(guarded.at(-1)) && mayFallThrough(guarded, referenced)) guarded.push({ kind: 'jump', label: body, location: null });
      guarded.push(
        instruction,
        { kind: 'action', opcode: OPCODE.setVariable, targetA: steps, targetB: textOperand(ZERO_VALUE), location: null },
        { kind: 'label', label: body, entry: false },
      );
      defined.add(instruction.label);
      defined.add(body);
      continue;
    }
    guarded.push(instruction);
    if (instruction.kind === 'label') defined.add(instruction.label);
  }
  return guarded;
}
