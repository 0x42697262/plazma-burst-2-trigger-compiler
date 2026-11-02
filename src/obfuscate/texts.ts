import type { Instruction, Operand, Value } from '../compiler/ir.ts';
import { textOperand, variable } from '../compiler/ir.ts';
import type { Names } from '../compiler/names.ts';
import { INTERNAL_MARK, USER_SEPARATOR, VARIABLE_MARK } from '../compiler/keys.ts';
import { OPCODE } from '../opcodes/constants.ts';
import { escapeXml } from '../emit/xml-emitter.ts';
import { SHOWN_TEXT_ENTITIES } from '../sim/keys.ts';
import { OBFUSCATION_VARIABLE, EMPTY, UID_MARK, ownNamePattern } from './keys.ts';
import { RADIX } from './constants.ts';

export type EncodedText = { variable: string; value: string };
export type TextEncoding = { instructions: Instruction[]; texts: EncodedText[] };

const SHOWN_SPECIAL: readonly string[] = SHOWN_TEXT_ENTITIES.map(([, character]) => character);

export const isGameNumber = (text: string): boolean => String(parseInt(text, RADIX)) === text;

const gameValue = (text: string): string => escapeXml(text);

const shownValue = (text: string): string => SHOWN_TEXT_ENTITIES.reduce((result, [entity, character]) => result.split(entity).join(character), escapeXml(text));

export function encodeTexts(instructions: readonly Instruction[], names: Names, hostNames: readonly string[]): TextEncoding {
  const variables = new Map<string, string>();
  const textVariable = (value: string): string => {
    let name = variables.get(value);
    if (name === undefined) {
      name = names.internalVariable(OBFUSCATION_VARIABLE.text(variables.size));
      variables.set(value, name);
    }
    return name;
  };
  const encodable = (text: string): boolean => text !== EMPTY && !text.startsWith(UID_MARK) && !isGameNumber(gameValue(text));
  const ownName = ownNamePattern(VARIABLE_MARK + names.prefix, USER_SEPARATOR + INTERNAL_MARK, VARIABLE_MARK);
  const hosts = [...hostNames].filter((name) => name !== EMPTY).sort((first, second) => second.length - first.length);

  const referenceAt = (text: string, position: number): string | null => {
    const rest = text.slice(position);
    const own = ownName.exec(rest);
    if (own) return own[0];
    return hosts.find((name) => rest.startsWith(name)) ?? null;
  };

  const shownText = (text: string): string => {
    if (text.startsWith(UID_MARK) || isGameNumber(gameValue(text))) return text;
    let result = EMPTY;
    let run = EMPTY;
    const closeRun = (): void => {
      const shown = shownValue(run);
      result += run === EMPTY || SHOWN_SPECIAL.some((character) => shown.includes(character)) ? run : textVariable(shown);
      run = EMPTY;
    };
    for (let position = 0; position < text.length;) {
      const reference = referenceAt(text, position);
      if (reference === null) {
        run += text[position];
        position += 1;
        continue;
      }
      closeRun();
      result += reference;
      position += reference.length;
    }
    closeRun();
    return result;
  };

  const encodeValue = (value: Value): Value => (value.kind === 'literal' && encodable(value.text) ? variable(textVariable(gameValue(value.text))) : value);

  const rewrite = (instruction: Instruction): Instruction => {
    if (instruction.kind === 'branch') return { ...instruction, left: encodeValue(instruction.left), right: encodeValue(instruction.right) };
    if (instruction.kind !== 'action') return instruction;
    const { targetA, targetB } = instruction;
    const textB = (operand: Operand): operand is Extract<Operand, { kind: 'text' }> => operand.kind === 'text' && encodable(operand.text);
    if (instruction.opcode === OPCODE.setVariable && targetA.kind === 'text' && textB(targetB)) {
      return { ...instruction, opcode: OPCODE.copyVariable, targetB: textOperand(textVariable(gameValue(targetB.text))) };
    }
    if (instruction.opcode === OPCODE.containsValue && targetA.kind === 'text' && textB(targetB)) {
      return { ...instruction, opcode: OPCODE.containsVariable, targetB: textOperand(textVariable(gameValue(targetB.text))) };
    }
    if (instruction.opcode === OPCODE.showText && targetA.kind === 'text') return { ...instruction, targetA: textOperand(shownText(targetA.text)) };
    return instruction;
  };

  const rewritten = instructions.map(rewrite);
  return { instructions: rewritten, texts: [...variables].map(([value, name]) => ({ variable: name, value })) };
}
