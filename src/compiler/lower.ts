import { OPCODE, SKIPS_NEXT } from '../opcodes/constants.ts';
import { labelOperand, textOperand } from './ir.ts';
import type { Condition, Instruction, Operand, SourceLocation, Value } from './ir.ts';
import { INTERNAL_VARIABLE, LABEL_HINT, ZERO_VALUE } from './keys.ts';
import type { Names } from './names.ts';
import { CompileError } from './names.ts';
import { TEXT } from './text.ts';

export type MachineItem =
  | { kind: 'label'; label: string; entry: boolean }
  | { kind: 'action'; opcode: number; targetA: Operand; targetB: Operand; location: SourceLocation | null }
  | { kind: 'end' };

type Emitter = { items: MachineItem[]; names: Names };

const emitAction = (emitter: Emitter, opcode: number, targetA: Operand, targetB: Operand, location: SourceLocation | null): void => {
  emitter.items.push({ kind: 'action', opcode, targetA, targetB, location });
};

const text = (value: string): Operand => textOperand(value);
const unused = (): Operand => textOperand(ZERO_VALUE);

const asVariable = (emitter: Emitter, value: Value, temporary: string, location: SourceLocation | null): string => {
  if (value.kind === 'variable') return value.name;
  const name = emitter.names.internalVariable(temporary);
  emitAction(emitter, OPCODE.setVariable, text(name), text(value.text), location);
  return name;
};

const jumpTo = (emitter: Emitter, label: string, location: SourceLocation | null): void => {
  emitAction(emitter, OPCODE.switchToTrigger, labelOperand(label), unused(), location);
};

const skipThenJump = (emitter: Emitter, skipOpcode: number, left: string, right: string, label: string, location: SourceLocation | null): void => {
  emitAction(emitter, skipOpcode, text(left), text(right), location);
  jumpTo(emitter, label, location);
};

const skipOverJump = (emitter: Emitter, skipOpcode: number, left: string, right: string, label: string, location: SourceLocation | null): void => {
  const continuation = emitter.names.freshLabel(LABEL_HINT.then);
  emitAction(emitter, skipOpcode, text(left), text(right), location);
  jumpTo(emitter, continuation, location);
  jumpTo(emitter, label, location);
  emitter.items.push({ kind: 'end' }, { kind: 'label', label: continuation, entry: false });
};

const equalToLiteral = (left: Value, right: Value): { variable: string; literal: string } | null => {
  if (left.kind === 'variable' && right.kind === 'literal') return { variable: left.name, literal: right.text };
  if (left.kind === 'literal' && right.kind === 'variable') return { variable: right.name, literal: left.text };
  return null;
};

const SKIP_WHEN_FALSE: Partial<Record<Condition, number>> = { ne: OPCODE.skipIfEqual, le: OPCODE.skipIfGreater, ge: OPCODE.skipIfLess };
const SKIP_WHEN_TRUE: Partial<Record<Condition, number>> = { eq: OPCODE.skipIfEqual, gt: OPCODE.skipIfGreater, lt: OPCODE.skipIfLess };

const lowerBranch = (emitter: Emitter, instruction: Extract<Instruction, { kind: 'branch' }>): void => {
  const { condition, left, right, label, location } = instruction;
  const literalEquality = condition === 'eq' ? equalToLiteral(left, right) : null;
  if (literalEquality) {
    skipThenJump(emitter, OPCODE.skipIfNotEqualValue, literalEquality.variable, literalEquality.literal, label, location);
    return;
  }
  const leftName = asVariable(emitter, left, INTERNAL_VARIABLE.left, location);
  const rightName = asVariable(emitter, right, INTERNAL_VARIABLE.right, location);
  const direct = SKIP_WHEN_FALSE[condition];
  if (direct !== undefined) {
    skipThenJump(emitter, direct, leftName, rightName, label, location);
    return;
  }
  const inverted = SKIP_WHEN_TRUE[condition];
  if (inverted !== undefined) skipOverJump(emitter, inverted, leftName, rightName, label, location);
};

const afterSkip = (emitter: Emitter): boolean => {
  const last = emitter.items.at(-1);
  return last?.kind === 'action' && SKIPS_NEXT.has(last.opcode);
};

const stopOperand = (emitter: Emitter): Operand => textOperand(emitter.names.internalVariable(INTERNAL_VARIABLE.stop));

export function lower(instructions: readonly Instruction[], names: Names): MachineItem[] {
  const emitter: Emitter = { items: [], names };
  for (const instruction of instructions) {
    switch (instruction.kind) {
      case 'label':
        if (afterSkip(emitter)) throw new CompileError(TEXT.skipBeforeLabel(instruction.label));
        emitter.items.push({ kind: 'label', label: instruction.label, entry: instruction.entry });
        break;
      case 'action':
        emitAction(emitter, instruction.opcode, instruction.targetA, instruction.targetB, instruction.location);
        break;
      case 'jump': {
        const conditional = afterSkip(emitter);
        jumpTo(emitter, instruction.label, instruction.location);
        if (!conditional) emitter.items.push({ kind: 'end' });
        break;
      }
      case 'call':
        emitAction(emitter, OPCODE.executeTrigger, labelOperand(instruction.label), unused(), instruction.location);
        break;
      case 'return':
        if (afterSkip(emitter)) emitAction(emitter, OPCODE.continueIfGreater, stopOperand(emitter), stopOperand(emitter), instruction.location);
        else emitter.items.push({ kind: 'end' });
        break;
      case 'branch':
        if (afterSkip(emitter)) throw new CompileError(TEXT.skipBeforeBranch(instruction.location?.line ?? 0));
        lowerBranch(emitter, instruction);
        break;
    }
  }
  return emitter.items;
}
