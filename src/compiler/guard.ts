import { OPCODE } from '../opcodes/constants.ts';
import type { Instruction } from './ir.ts';
import { textOperand } from './ir.ts';
import { INTERNAL_VARIABLE, LABEL_HINT, STEP_VALUE, ZERO_VALUE } from './keys.ts';
import type { Names } from './names.ts';

const isTransfer = (instruction: Instruction): instruction is Extract<Instruction, { kind: 'jump' | 'branch' }> =>
  instruction.kind === 'jump' || instruction.kind === 'branch';

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
    const instruction = isTransfer(original) ? { ...original, label: bodies.get(original.label) ?? original.label } : original;
    if (isTransfer(instruction) && defined.has(instruction.label)) {
      guarded.push(
        { kind: 'action', opcode: OPCODE.addValue, targetA: steps, targetB: textOperand(STEP_VALUE), location: instruction.location },
        { kind: 'action', opcode: OPCODE.continueIfLessValue, targetA: steps, targetB: textOperand(String(limit)), location: instruction.location },
      );
    }
    guarded.push(instruction);
    if (instruction.kind !== 'label') continue;
    defined.add(instruction.label);
    const body = bodies.get(instruction.label);
    if (body === undefined) continue;
    guarded.push(
      { kind: 'action', opcode: OPCODE.setVariable, targetA: steps, targetB: textOperand(ZERO_VALUE), location: null },
      { kind: 'label', label: body, entry: false },
    );
    defined.add(body);
  }
  return guarded;
}
