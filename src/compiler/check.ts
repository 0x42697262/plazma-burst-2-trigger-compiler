import type { Program } from '../program/types.ts';
import { opcodeByNumber } from '../opcodes/table.ts';
import { AVOIDED, SKIPS_NEXT } from '../opcodes/constants.ts';
import { isWritableAsText } from '../emit/trigger-text-emitter.ts';
import { escapeXml } from '../emit/xml-emitter.ts';
import { OPCODE } from '../opcodes/constants.ts';
import { SHOWN_DECODED } from './keys.ts';
import { COLOR_PARAM_KIND, OBJECT_PARAM_KINDS, TRIGGER_MARK } from './keys.ts';
import { TEXT } from './text.ts';

const isObjectParam = (kind: string | undefined): boolean => kind !== undefined && OBJECT_PARAM_KINDS.has(kind);

export function checkTriggers(program: Program, externalUids: readonly string[]): string[] {
  const warnings: string[] = [];
  const known = new Set([...program.triggers.map((trigger) => trigger.uid), ...program.timers.map((timer) => timer.uid), ...externalUids]);
  for (const trigger of program.triggers) {
    let textWarned = false;
    let entityWarned = false;
    trigger.actions.forEach((action, index) => {
      const shownDecoded = (value: string): string => (action.opcode === OPCODE.showText && value === action.targetA ? SHOWN_DECODED.reduce((text, character) => text.split(character).join(''), value) : value);
      const encoded = [action.targetA, action.targetB].find((value) => escapeXml(shownDecoded(value)) !== shownDecoded(value));
      if (encoded !== undefined && !entityWarned) {
        warnings.push(TEXT.entityValue(trigger.uid, encoded));
        entityWarned = true;
      }
      const opcode = opcodeByNumber(action.opcode);
      if (AVOIDED.has(action.opcode)) warnings.push(TEXT.switchByIndex(trigger.uid));
      const isLast = index === trigger.actions.length - 1;
      if (isLast && SKIPS_NEXT.has(action.opcode)) warnings.push(TEXT.skipAtEnd(trigger.uid));
      const params = [[opcode?.paramA, action.targetA], [opcode?.paramB, action.targetB]] as const;
      for (const [kind, value] of params) {
        if (!value.startsWith(TRIGGER_MARK) || kind === COLOR_PARAM_KIND) continue;
        if (isObjectParam(kind)) {
          if (!known.has(value)) warnings.push(TEXT.unknownTarget(trigger.uid, value));
        } else {
          warnings.push(TEXT.hashValue(trigger.uid, value));
        }
      }
      const writable = isWritableAsText(action.targetA, action.targetB);
      if (!writable && !textWarned) {
        warnings.push(TEXT.notText(trigger.uid));
        textWarned = true;
      }
    });
  }
  return warnings;
}
