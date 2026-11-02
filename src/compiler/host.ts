import type { Program } from '../program/types.ts';
import { escapeXml } from '../emit/xml-emitter.ts';
import { opcodeByNumber } from '../opcodes/table.ts';
import { OPCODE, TEMPLATE_REPLACED_A, TEMPLATE_REPLACED_B } from '../opcodes/constants.ts';
import { HOST_ACTION_ATTRIBUTE, HOST_TRIGGER_ELEMENT, STRING_PARAM_KIND } from './keys.ts';
import { TEXT } from './text.ts';
import type { ExportedVariable } from './ir.ts';
import { ELEMENT_START } from './keys.ts';

const NOT_VARIABLE_NAMES: ReadonlySet<number> = new Set([OPCODE.showText]);

export function hostVariableNames(mapXml: string): Set<string> {
  const names = new Set<string>();
  for (const element of mapXml.matchAll(HOST_TRIGGER_ELEMENT)) {
    const attributes = element[0];
    for (const match of attributes.matchAll(HOST_ACTION_ATTRIBUTE)) {
      const opcode = Number(match[2]);
      const targetA = match[3] ?? '';
      const kind = opcodeByNumber(opcode)?.paramA;
      if (kind === STRING_PARAM_KIND && !NOT_VARIABLE_NAMES.has(opcode) && targetA !== '') names.add(targetA);
    }
  }
  return names;
}

export function checkHostNames(program: Program, mapXml: string): string[] {
  const hostNames = [...hostVariableNames(mapXml)];
  const warnings = new Set<string>();
  for (const trigger of program.triggers) {
    for (const action of trigger.actions) {
      const replaced = [
        ...(TEMPLATE_REPLACED_A.has(action.opcode) ? [action.targetA] : []),
        ...(TEMPLATE_REPLACED_B.has(action.opcode) ? [action.targetB] : []),
      ].map(escapeXml);
      for (const value of replaced) {
        for (const name of hostNames) if (value.includes(name)) warnings.add(TEXT.hostNameInText(trigger.uid, name, value));
      }
    }
  }
  return [...warnings];
}

const isExported = (name: string, exports: readonly ExportedVariable[]): boolean => exports.some((entry) => {
  if (entry.lengthName === null) return entry.gameName === name;
  return name === entry.lengthName || name.startsWith(entry.gameName.slice(0, entry.gameName.indexOf(ELEMENT_START) + ELEMENT_START.length));
});

export function checkHostUses(mapXml: string, owns: (name: string) => boolean, exports: readonly ExportedVariable[]): string[] {
  return [...hostVariableNames(mapXml)]
    .filter((name) => owns(name) && !isExported(name, exports))
    .map((name) => TEXT.hostUsesUnexported(name));
}
