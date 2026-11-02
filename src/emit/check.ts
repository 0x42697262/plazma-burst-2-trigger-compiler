import { MAX_ACTIONS_PER_TRIGGER } from '../program/constants.ts';
import type { Program } from '../program/types.ts';
import { opcodeByNumber } from '../opcodes/table.ts';
import { TEXT } from './text.ts';

export class EmitError extends Error {}

export function checkProgram(program: Program): void {
  const seen = new Set<string>();
  const uids = [...program.triggers.map((trigger) => trigger.uid), ...(program.startTimer ? [program.startTimer.uid] : [])];
  for (const uid of uids) {
    if (seen.has(uid)) throw new EmitError(TEXT.duplicateUid(uid));
    seen.add(uid);
  }
  for (const trigger of program.triggers) {
    if (trigger.actions.length > MAX_ACTIONS_PER_TRIGGER) {
      throw new EmitError(TEXT.tooManyActions(trigger.uid, trigger.actions.length, MAX_ACTIONS_PER_TRIGGER));
    }
    const unknown = trigger.actions.find((action) => opcodeByNumber(action.opcode) === null);
    if (unknown) throw new EmitError(TEXT.unknownOpcode(trigger.uid, unknown.opcode));
  }
}
