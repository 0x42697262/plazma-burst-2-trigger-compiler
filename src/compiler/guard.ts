import { OPCODE, SKIPS_NEXT } from '../opcodes/constants.ts';
import type { Instruction } from './ir.ts';
import { textOperand } from './ir.ts';
import { INTERNAL_VARIABLE, LABEL_HINT, STEP_VALUE, ZERO_VALUE } from './keys.ts';
import { BEFORE_LAST } from './constants.ts';
import type { Names } from './names.ts';

type Redirectable = Extract<Instruction, { kind: 'jump' | 'branch' | 'call' }>;

const isRedirectable = (instruction: Instruction): instruction is Redirectable =>
  instruction.kind === 'jump' || instruction.kind === 'branch' || instruction.kind === 'call';

const isSkip = (instruction: Instruction | undefined): boolean => instruction?.kind === 'action' && SKIPS_NEXT.has(instruction.opcode);

const mayFallThrough = (last: Instruction | undefined, beforeLast: Instruction | undefined): boolean => {
  if (last === undefined) return false;
  if (last.kind !== 'jump' && last.kind !== 'return') return true;
  return isSkip(beforeLast);
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
  const guarded: Instruction[] = [];
  const defined = new Set<string>();
  for (const original of instructions) {
    const instruction = isRedirectable(original) ? { ...original, label: bodies.get(original.label) ?? original.label } : original;
    if ((instruction.kind === 'jump' || instruction.kind === 'branch') && defined.has(instruction.label)) {
      const location = instruction.location;
      const counting: Instruction[] = [
        { kind: 'action', opcode: OPCODE.addValue, targetA: steps, targetB: textOperand(STEP_VALUE), location },
        { kind: 'action', opcode: OPCODE.continueIfLessValue, targetA: steps, targetB: textOperand(String(limit)), location },
      ];
      const skip = isSkip(guarded.at(-1)) ? guarded.pop() : undefined;
      guarded.push(...counting, ...(skip ? [skip] : []));
    }
    const body = instruction.kind === 'label' ? bodies.get(instruction.label) : undefined;
    if (instruction.kind === 'label' && body !== undefined) {
      if (mayFallThrough(guarded.at(-1), guarded.at(BEFORE_LAST))) guarded.push({ kind: 'jump', label: body, location: null });
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
