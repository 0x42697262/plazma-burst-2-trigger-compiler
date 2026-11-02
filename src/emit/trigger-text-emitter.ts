import type { Action, Program, Trigger } from '../program/types.ts';
import { opcodeByNumber } from '../opcodes/table.ts';
import { FIRST_ACTION_NUMBER } from './constants.ts';
import { OP_PREFIX, TEXT_BLOCK_SEPARATOR, TEXT_FORBIDDEN, TEXT_LINE_END, TEXT_TOKEN } from './keys.ts';
import { TEXT_HEADER } from './attributes.ts';
import { TEXT } from './text.ts';
import { EmitError, checkProgram } from './check.ts';

const hasNoForbidden = (value: string): boolean => !TEXT_FORBIDDEN.some((forbidden) => value.includes(forbidden));

export function isWritableAsText(targetA: string, targetB: string): boolean {
  if (!hasNoForbidden(targetA) || !hasNoForbidden(targetB)) return false;
  const line = TEXT.actionLine('', targetA, targetB);
  const separatorAt = TEXT_TOKEN.start.length + targetA.length;
  return line.indexOf(TEXT_TOKEN.start) === 0
    && line.indexOf(TEXT_TOKEN.separator) === separatorAt
    && line.indexOf(TEXT_TOKEN.end) === line.length - TEXT_TOKEN.end.length;
}

const editorName = (opcode: number): string => opcodeByNumber(opcode)?.alias ?? `${OP_PREFIX}${opcode}`;

const actionLine = (trigger: Trigger, action: Action, index: number): string => {
  if (!isWritableAsText(action.targetA, action.targetB)) {
    throw new EmitError(TEXT.notWritableAsText(trigger.uid, index + FIRST_ACTION_NUMBER, TEXT.actionLine('', action.targetA, action.targetB)));
  }
  return TEXT.actionLine(editorName(action.opcode), action.targetA, action.targetB);
};

export function emitTriggerText(trigger: Trigger): string {
  const headers = [
    TEXT.header(TEXT_HEADER.uid, trigger.uid),
    TEXT.header(TEXT_HEADER.enabled, String(trigger.enabled)),
    TEXT.header(TEXT_HEADER.maxCalls, String(trigger.maxCalls)),
  ];
  const actions = trigger.actions.map((action, index) => actionLine(trigger, action, index));
  return [...headers, '', ...actions].join(TEXT_LINE_END) + TEXT_LINE_END;
}

export function emitText(program: Program): string[] {
  checkProgram(program);
  return program.triggers.map(emitTriggerText);
}

export const joinTextBlocks = (blocks: readonly string[]): string => blocks.join(TEXT_BLOCK_SEPARATOR);
