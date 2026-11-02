import { opcodeByName } from '../opcodes/table.ts';
import { OPCODE } from '../opcodes/constants.ts';
import { labelOperand, literal, textOperand, variable } from '../compiler/ir.ts';
import type { Instruction, Module, Operand, SourceLocation, TimerSpec, Value } from '../compiler/ir.ts';
import type { Names } from '../compiler/names.ts';
import { CompileError } from '../compiler/names.ts';
import { UNUSED_TARGET } from '../program/keys.ts';
import { ZERO_VALUE } from '../compiler/keys.ts';
import {
  BRANCHES, COMMENT_MARKS, DIRECTIVE, DIRECTIVE_MARK, ESCAPE, ESCAPED, IDENTIFIER, INTERPOLATION_END, INTERPOLATION_START, LABEL_DEFINITION,
  LABEL_SIGIL, LINE_SPLIT, MNEMONIC, OPERAND_SEPARATOR, QUOTE, TIMER_DISABLED, VARIABLE_SIGIL, WHITESPACE,
} from './keys.ts';
import {
  BRANCH_OPERANDS, DEFAULT_COLOR, DEFAULT_TIMER_CALLS, NO_OPERANDS, ONE_OPERAND, TIMER_CALLS_POSITION, TIMER_MIN_OPERANDS, TIMER_STATE_POSITION, TWO_OPERANDS,
} from './constants.ts';
import { TEXT } from './text.ts';

type Token =
  | { kind: 'variable'; name: string }
  | { kind: 'label'; name: string }
  | { kind: 'string'; text: string }
  | { kind: 'bare'; text: string };

export type Assembly = { module: Module; externals: string[] };

class LineError extends Error {}

const fail = (message: string): never => {
  throw new LineError(message);
};

const identifier = (name: string): string => (IDENTIFIER.test(name) ? name : fail(TEXT.badIdentifier(name)));

export function stripComment(line: string): string {
  let inString = false;
  for (let position = 0; position < line.length; position++) {
    const character = line[position];
    if (inString && character === ESCAPE) {
      position += 1;
      continue;
    }
    if (character === QUOTE) inString = !inString;
    if (!inString && COMMENT_MARKS.some((mark) => line.startsWith(mark, position))) return line.slice(0, position);
  }
  return line;
}

export function splitOperands(text: string): string[] {
  if (text.trim() === '') return [];
  const operands: string[] = [];
  let current = '';
  let inString = false;
  for (let position = 0; position < text.length; position++) {
    const character = text[position] ?? '';
    if (inString && character === ESCAPE) {
      current += character + (text[position + 1] ?? '');
      position += 1;
      continue;
    }
    if (character === QUOTE) inString = !inString;
    if (!inString && character === OPERAND_SEPARATOR) {
      operands.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (inString) fail(TEXT.unclosedString);
  operands.push(current.trim());
  return operands;
}

const readString = (raw: string, names: Names): string => {
  if (raw.length < TWO_OPERANDS || !raw.endsWith(QUOTE)) fail(TEXT.unclosedString);
  const body = raw.slice(1, -1);
  let result = '';
  for (let position = 0; position < body.length; position++) {
    const character = body[position] ?? '';
    if (character === ESCAPE) {
      const next = body[position + 1] ?? '';
      const escaped = ESCAPED[next];
      if (escaped === undefined) fail(TEXT.badEscape(next));
      result += escaped;
      position += 1;
    } else if (character === INTERPOLATION_START) {
      const end = body.indexOf(INTERPOLATION_END, position);
      const inner = end < 0 ? '' : body.slice(position + 1, end);
      if (!inner.startsWith(VARIABLE_SIGIL)) fail(TEXT.badInterpolation);
      result += names.variable(identifier(inner.slice(VARIABLE_SIGIL.length)));
      position = end;
    } else if (character === QUOTE) {
      fail(TEXT.unclosedString);
    } else {
      result += character;
    }
  }
  return result;
};

const readToken = (raw: string, names: Names): Token => {
  if (raw === '') return fail(TEXT.emptyOperand);
  if (raw.startsWith(QUOTE)) return { kind: 'string', text: readString(raw, names) };
  if (raw.startsWith(VARIABLE_SIGIL)) return { kind: 'variable', name: identifier(raw.slice(VARIABLE_SIGIL.length)) };
  if (raw.startsWith(LABEL_SIGIL)) return { kind: 'label', name: identifier(raw.slice(LABEL_SIGIL.length)) };
  return { kind: 'bare', text: raw };
};

const operandOf = (token: Token, names: Names): Operand => {
  switch (token.kind) {
    case 'variable':
      return textOperand(names.variable(token.name));
    case 'label':
      return labelOperand(token.name);
    case 'string':
    case 'bare':
      return textOperand(token.text);
  }
};

const valueOf = (token: Token, names: Names): Value => {
  switch (token.kind) {
    case 'variable':
      return variable(names.variable(token.name));
    case 'label':
      return fail(TEXT.labelInValue);
    case 'string':
    case 'bare':
      return literal(token.text);
  }
};

const labelOf = (token: Token | undefined): string => (token?.kind === 'label' ? token.name : fail(TEXT.expectedLabel(token ? JSON.stringify(token) : '')));

const expectCount = (name: string, tokens: readonly Token[], count: number): void => {
  if (tokens.length !== count) fail(TEXT.operandCount(name, TEXT.exactly(count), tokens.length));
};

type State = { instructions: Instruction[]; entries: Set<string>; start: string | null; externals: string[]; timers: TimerSpec[]; firstLabel: string | null };

const action = (opcode: number, targetA: Operand, targetB: Operand, location: SourceLocation): Instruction => ({ kind: 'action', opcode, targetA, targetB, location });

const unused = (): Operand => textOperand(UNUSED_TARGET);

function instructionsOf(mnemonic: string, tokens: Token[], names: Names, location: SourceLocation): Instruction[] {
  const operand = (index: number): Operand => {
    const token = tokens[index];
    return token ? operandOf(token, names) : unused();
  };
  switch (mnemonic) {
    case MNEMONIC.jump:
      expectCount(mnemonic, tokens, ONE_OPERAND);
      return [{ kind: 'jump', label: labelOf(tokens[0]), location }];
    case MNEMONIC.call:
      expectCount(mnemonic, tokens, ONE_OPERAND);
      return [{ kind: 'call', label: labelOf(tokens[0]), location }];
    case MNEMONIC.ret:
      expectCount(mnemonic, tokens, NO_OPERANDS);
      return [{ kind: 'return', location }];
    case MNEMONIC.set:
      expectCount(mnemonic, tokens, TWO_OPERANDS);
      return [action(tokens[1]?.kind === 'variable' ? OPCODE.copyVariable : OPCODE.setVariable, operand(0), operand(1), location)];
    case MNEMONIC.add:
      expectCount(mnemonic, tokens, TWO_OPERANDS);
      if (tokens[1]?.kind !== 'variable') return [action(OPCODE.addValue, operand(0), operand(1), location)];
      return [action(OPCODE.addValue, operand(0), textOperand(ZERO_VALUE), location), action(OPCODE.addVariable, operand(0), operand(1), location)];
    case MNEMONIC.say:
      if (tokens.length < ONE_OPERAND || tokens.length > TWO_OPERANDS) fail(TEXT.operandCount(mnemonic, TEXT.zeroToTwo, tokens.length));
      return [action(OPCODE.showText, operand(0), tokens[1] ? operand(1) : textOperand(DEFAULT_COLOR), location)];
    default:
      break;
  }
  const condition = BRANCHES[mnemonic];
  if (condition) {
    expectCount(mnemonic, tokens, BRANCH_OPERANDS);
    const [left, right] = tokens as [Token, Token, Token];
    return [{ kind: 'branch', condition, left: valueOf(left, names), right: valueOf(right, names), label: labelOf(tokens[2]), location }];
  }
  const opcode = opcodeByName(mnemonic);
  if (!opcode) return fail(TEXT.unknownInstruction(mnemonic));
  if (tokens.length > TWO_OPERANDS) fail(TEXT.operandCount(mnemonic, TEXT.zeroToTwo, tokens.length));
  return [action(opcode.number, operand(0), operand(1), location)];
}

const parseNumber = (text: string | undefined): number => {
  const value = Number(text);
  return text !== undefined && text !== '' && Number.isFinite(value) ? value : fail(TEXT.badNumber(text ?? ''));
};

function directive(line: string, state: State): void {
  const words = line.slice(DIRECTIVE_MARK.length).split(WHITESPACE).filter((word) => word !== '');
  const [name, ...rest] = words;
  switch (name) {
    case DIRECTIVE.start:
      state.start = identifier(rest[0] ?? '');
      break;
    case DIRECTIVE.entry:
      for (const label of rest) state.entries.add(identifier(label));
      break;
    case DIRECTIVE.extern:
      state.externals.push(...rest);
      break;
    case DIRECTIVE.prefix:
      break;
    case DIRECTIVE.timer: {
      if (rest.length < TIMER_MIN_OPERANDS) fail(TEXT.operandCount(name, String(TIMER_MIN_OPERANDS), rest.length));
      const target = rest[1] ?? '';
      state.timers.push({
        label: identifier(rest[0] ?? ''),
        target: identifier(target.startsWith(LABEL_SIGIL) ? target.slice(LABEL_SIGIL.length) : target),
        delay: parseNumber(rest[2]),
        maxCalls: rest[TIMER_CALLS_POSITION] === undefined ? DEFAULT_TIMER_CALLS : parseNumber(rest[TIMER_CALLS_POSITION]),
        enabled: rest[TIMER_STATE_POSITION] !== TIMER_DISABLED,
      });
      break;
    }
    default:
      fail(TEXT.unknownDirective(name ?? ''));
  }
}

export function readPrefixDirective(source: string): string | null {
  for (const rawLine of source.split(LINE_SPLIT)) {
    const words = stripComment(rawLine).trim().split(WHITESPACE).filter((word) => word !== '');
    if (words[0] === DIRECTIVE_MARK + DIRECTIVE.prefix && words[1] !== undefined) return words[1];
  }
  return null;
}

function parseLine(rawLine: string, lineNumber: number, state: State, names: Names): void {
  let line = stripComment(rawLine).trim();
  const location = { line: lineNumber };
  for (let match = LABEL_DEFINITION.exec(line); match; match = LABEL_DEFINITION.exec(line)) {
    const label = match[1] ?? '';
    state.instructions.push({ kind: 'label', label, entry: false });
    state.firstLabel ??= label;
    line = line.slice(match[0].length).trim();
  }
  if (line === '') return;
  if (line.startsWith(DIRECTIVE_MARK)) {
    directive(line, state);
    return;
  }
  const space = line.search(WHITESPACE);
  const mnemonic = space < 0 ? line : line.slice(0, space);
  const tokens = splitOperands(space < 0 ? '' : line.slice(space)).map((raw) => readToken(raw, names));
  state.instructions.push(...instructionsOf(mnemonic, tokens, names, location));
}

export function parseAssembly(source: string, names: Names): Assembly {
  const state: State = { instructions: [], entries: new Set(), start: null, externals: [], timers: [], firstLabel: null };
  source.split(LINE_SPLIT).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    try {
      parseLine(rawLine, lineNumber, state, names);
    } catch (error) {
      if (error instanceof LineError) throw new CompileError(TEXT.where(lineNumber, error.message));
      throw error;
    }
  });
  const start = state.start ?? state.firstLabel;
  if (start === null) throw new CompileError(TEXT.noLabel);
  state.entries.add(start);
  for (const timer of state.timers) state.entries.add(timer.target);
  const instructions = state.instructions.map((instruction) =>
    (instruction.kind === 'label' && state.entries.has(instruction.label) ? { ...instruction, entry: true } : instruction));
  return { module: { instructions, start, timers: state.timers }, externals: state.externals };
}
