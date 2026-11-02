import type { Instruction, Operand } from '../compiler/ir.ts';
import { textOperand, variable } from '../compiler/ir.ts';
import type { Names } from '../compiler/names.ts';
import { CompileError } from '../compiler/names.ts';
import { lower } from '../compiler/lower.ts';
import { layout } from '../compiler/layout.ts';
import type { Trigger } from '../program/types.ts';
import { OPCODE } from '../opcodes/constants.ts';
import { escapeXml } from '../emit/xml-emitter.ts';
import type { EncodedText } from './texts.ts';
import type { Random } from './random.ts';
import {
  DECOY_ALPHABET, EMPTY, LEADING_ALPHABET, OBFUSCATION_LABEL, OBFUSCATION_VARIABLE, ONE, READY_MARK, SAY_COLOR, SEPARATOR_CANDIDATES, SPLIT_CHARACTERS, ZERO,
} from './keys.ts';
import { CHECK_FACTOR, CHECK_MODULUS, CHECK_START, CHECKSUM_MULTIPLIER, CODE_CHARACTERS, DECOY_CHARACTERS, FIRST_OFFSET, INVALID_BASE } from './constants.ts';
import { TEXT } from './text.ts';

export type CheckPlan = {
  texts: readonly EncodedText[];
  plain: string;
  codes: string;
  encoded: string;
  separator: string;
  sumStart: number;
  factorSum: number;
  factorLength: number;
  offset: number;
  expected: number;
};

export type Region = { first: string; last: string; size: number };

export type Variables = {
  state: string; run: string; check: string; base: string; last: string; size: string; select: string; work: string; ready: string; stop: string; failed: string;
};

export const variablesOf = (names: Names): Variables => ({
  state: names.internalVariable(OBFUSCATION_VARIABLE.state),
  run: names.internalVariable(OBFUSCATION_VARIABLE.run),
  check: names.internalVariable(OBFUSCATION_VARIABLE.check),
  base: names.internalVariable(OBFUSCATION_VARIABLE.base),
  last: names.internalVariable(OBFUSCATION_VARIABLE.last),
  size: names.internalVariable(OBFUSCATION_VARIABLE.size),
  select: names.internalVariable(OBFUSCATION_VARIABLE.select),
  work: names.internalVariable(OBFUSCATION_VARIABLE.work),
  ready: names.internalVariable(OBFUSCATION_VARIABLE.ready),
  stop: names.internalVariable(OBFUSCATION_VARIABLE.stop),
  failed: names.internalVariable(OBFUSCATION_VARIABLE.failed),
});

const characters = (text: string): string[] => text.split(SPLIT_CHARACTERS);

const mix = (sum: number, value: number): number => (sum * CHECKSUM_MULTIPLIER + value) % CHECK_MODULUS;

type Decoded = { text: string; sum: number };

const decode = (encoded: string, codes: readonly string[], plain: readonly string[], sumStart: number): Decoded => {
  let text = encoded;
  let sum = sumStart;
  codes.forEach((code, index) => {
    const character = plain[index] ?? EMPTY;
    const pieces = text.split(code);
    sum = mix(sum, pieces.length);
    text = pieces.join(character);
    sum = mix(sum, text.split(character).length);
  });
  return { text, sum };
};

export function planCheck(texts: readonly EncodedText[], random: Random): CheckPlan {
  const used = new Set(characters(texts.map((entry) => entry.value).join(EMPTY)));
  const separator = SEPARATOR_CANDIDATES.find((candidate) => !used.has(candidate));
  if (separator === undefined) throw new CompileError(TEXT.noSeparator);
  const joined = texts.map((entry) => entry.value).join(separator);
  const decoys = Array.from({ length: DECOY_CHARACTERS }, () => random.pick(characters(DECOY_ALPHABET)));
  const pool = random.shuffle([...new Set([...characters(joined), ...decoys])]);
  const plainProgram = random.pick(characters(LEADING_ALPHABET)) + pool.join(EMPTY);
  const plain = characters(escapeXml(plainProgram));
  const taken = new Set([...plain, ...characters(joined)]);
  const codes: string[] = [];
  while (codes.length < plain.length) {
    const code = String.fromCharCode(random.between(CODE_CHARACTERS.low, CODE_CHARACTERS.high));
    if (!taken.has(code)) codes.push(code);
    taken.add(code);
  }
  const codeOf = new Map<string, string>();
  plain.forEach((character, index) => {
    if (!codeOf.has(character)) codeOf.set(character, codes[index] ?? EMPTY);
  });
  const encoded = texts.length === 0 ? EMPTY : characters(joined).map((character) => codeOf.get(character) ?? character).join(EMPTY);
  const sumStart = random.between(CHECK_START.low, CHECK_START.high);
  const decoded = texts.length === 0 ? { text: EMPTY, sum: sumStart } : decode(encoded, codes, plain, sumStart);
  if (decoded.text !== (texts.length === 0 ? EMPTY : joined)) throw new CompileError(TEXT.badDecode);
  const summed = texts.reduce((sum, entry) => mix(sum, entry.value.length), decoded.sum);
  const factorSum = random.between(CHECK_FACTOR.low, CHECK_FACTOR.high);
  const factorLength = random.between(CHECK_FACTOR.low, CHECK_FACTOR.high);
  const offset = random.between(CHECK_START.low, CHECK_START.high);
  const expected = (summed * factorSum + plain.length * factorLength + offset) % CHECK_MODULUS;
  return { texts, plain: plainProgram, codes: codes.join(EMPTY), encoded, separator, sumStart, factorSum, factorLength, offset, expected };
}

export type Init = { triggers: Trigger[]; uid: string; label: string };

export function initLabel(names: Names): string {
  return names.freshLabel(OBFUSCATION_LABEL.init);
}

export function buildInit(names: Names, label: string, plan: CheckPlan, region: Region): Init {
  const vars = variablesOf(names);
  const internal = (stem: string): string => names.internalVariable(stem);
  const alphabet = internal(OBFUSCATION_VARIABLE.alphabet);
  const codes = internal(OBFUSCATION_VARIABLE.codes);
  const count = internal(OBFUSCATION_VARIABLE.count);
  const index = internal(OBFUSCATION_VARIABLE.index);
  const out = internal(OBFUSCATION_VARIABLE.out);
  const sum = internal(OBFUSCATION_VARIABLE.sum);
  const code = internal(OBFUSCATION_VARIABLE.code);
  const character = internal(OBFUSCATION_VARIABLE.character);
  const pieces = internal(OBFUSCATION_VARIABLE.pieces);
  const copy = internal(OBFUSCATION_VARIABLE.copy);
  const loop = names.freshLabel(OBFUSCATION_LABEL.loop);
  const decoded = names.freshLabel(OBFUSCATION_LABEL.decoded);
  const alarm = names.freshLabel(OBFUSCATION_LABEL.alarm);
  const instructions: Instruction[] = [];
  const text = (value: string): Operand => textOperand(value);
  const act = (opcode: number, targetA: string, targetB: string = ZERO): void => {
    instructions.push({ kind: 'action', opcode, targetA: text(targetA), targetB: text(targetB), location: null });
  };
  const mark = (name: string, entry = false): void => {
    instructions.push({ kind: 'label', label: name, entry });
  };
  const mixInto = (value: string): void => {
    act(OPCODE.multiplyValue, sum, String(CHECKSUM_MULTIPLIER));
    act(OPCODE.addVariable, sum, value);
    act(OPCODE.moduloValue, sum, String(CHECK_MODULUS));
  };
  mark(label, true);
  act(OPCODE.skipIfNotEqualValue, vars.ready, READY_MARK);
  instructions.push({ kind: 'return', location: null });
  act(OPCODE.setVariable, vars.failed, ZERO);
  act(OPCODE.setVariable, alphabet, plan.plain);
  act(OPCODE.length, vars.work, alphabet);
  act(OPCODE.setVariable, sum, String(plan.sumStart));
  if (plan.texts.length > 0) {
    act(OPCODE.splitByValue, alphabet, SPLIT_CHARACTERS);
    act(OPCODE.setVariable, codes, plan.codes);
    act(OPCODE.splitByValue, codes, SPLIT_CHARACTERS);
    act(OPCODE.length, count, codes);
    act(OPCODE.setVariable, out, plan.encoded);
    act(OPCODE.setVariable, index, ZERO);
    mark(loop);
    instructions.push({ kind: 'branch', condition: 'ge', left: variable(index), right: variable(count), label: decoded, location: null });
    act(OPCODE.copyVariable, code, codes);
    act(OPCODE.arrayGetIndex, code, index);
    act(OPCODE.copyVariable, character, alphabet);
    act(OPCODE.arrayGetIndex, character, index);
    act(OPCODE.splitByVariable, out, code);
    act(OPCODE.length, pieces, out);
    mixInto(pieces);
    act(OPCODE.joinByVariable, out, character);
    act(OPCODE.copyVariable, copy, out);
    act(OPCODE.splitByVariable, copy, character);
    act(OPCODE.length, pieces, copy);
    mixInto(pieces);
    act(OPCODE.addValue, index, ONE);
    instructions.push({ kind: 'jump', label: loop, location: null });
    mark(decoded);
    act(OPCODE.splitByValue, out, plan.separator);
    plan.texts.forEach((entry, position) => {
      act(OPCODE.copyVariable, entry.variable, out);
      act(OPCODE.arrayGetIndex, entry.variable, String(position));
      act(OPCODE.length, pieces, entry.variable);
      mixInto(pieces);
    });
  }
  act(OPCODE.multiplyValue, vars.work, String(plan.factorLength));
  act(OPCODE.copyVariable, vars.check, sum);
  act(OPCODE.multiplyValue, vars.check, String(plan.factorSum));
  act(OPCODE.addVariable, vars.check, vars.work);
  act(OPCODE.addValue, vars.check, String(plan.offset));
  act(OPCODE.moduloValue, vars.check, String(CHECK_MODULUS));
  act(OPCODE.setVariable, vars.base, region.first);
  act(OPCODE.setVariable, vars.last, region.last);
  act(OPCODE.copyVariable, vars.size, vars.base);
  act(OPCODE.negate, vars.size);
  act(OPCODE.addVariable, vars.size, vars.last);
  act(OPCODE.addValue, vars.size, String(FIRST_OFFSET));
  act(OPCODE.setVariable, vars.ready, READY_MARK);
  instructions.push({ kind: 'branch', condition: 'ne', left: variable(vars.check), right: { kind: 'literal', text: String(plan.expected) }, label: alarm, location: null });
  instructions.push({ kind: 'branch', condition: 'ne', left: variable(vars.size), right: { kind: 'literal', text: String(region.size) }, label: alarm, location: null });
  instructions.push({ kind: 'return', location: null });
  mark(alarm);
  instructions.push({ kind: 'action', opcode: OPCODE.showText, targetA: text(TEXT.alarm), targetB: text(SAY_COLOR), location: null });
  act(OPCODE.setVariable, vars.base, String(INVALID_BASE));
  act(OPCODE.setVariable, vars.failed, ONE);
  instructions.push({ kind: 'return', location: null });
  const laid = layout(lower(instructions, names), names);
  return { triggers: laid.triggers, uid: laid.labels.get(label) ?? names.triggerUid(label), label };
}

export const initCall = (uid: string, failed: string): Instruction[] => [
  { kind: 'action', opcode: OPCODE.executeTrigger, targetA: textOperand(uid), targetB: textOperand(ZERO), location: null },
  { kind: 'action', opcode: OPCODE.continueIfLessValue, targetA: textOperand(failed), targetB: textOperand(ONE), location: null },
];
