import { compileSource } from '../lang/compile.ts';
import { compileAssembly } from '../compiler/assemble.ts';
import { tokenize } from '../lang/lexer.ts';
import type { Token } from '../lang/lexer.ts';
import { BUILTIN, KEYWORD, KEYWORDS, PUNCTUATOR } from '../lang/keys.ts';
import { directoryOf, resolvePath } from '../lang/file-paths.ts';
import { OPCODES, opcodeByName, opcodeByNumber, textName } from '../opcodes/table.ts';
import { VALUE_GROUP_LIST, valueGroup } from '../opcodes/values.ts';
import { OBJECT_KINDS } from '../objects/keys.ts';
import { isObjectKeyword } from '../objects/objects.ts';
import {
  ACTION_BEFORE_CURSOR, COMPLETION_KIND, DECLARING_KEYWORDS, DIAGNOSTIC_LINE, DOT, MEMBER_BEFORE_CURSOR, NEWLINE, OPEN_BRACKET, SERVICE_PREFIX, SEVERITY,
  SYMBOL_KIND, WORD_CHARACTER, DIGITS,
} from './keys.ts';
import { AFTER_NEXT, FIRST_LINE, FIRST_PARAMETER, MAX_ACTION_COMPLETIONS } from './constants.ts';
import { TEXT } from './text.ts';

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];
export type CompletionKind = (typeof COMPLETION_KIND)[keyof typeof COMPLETION_KIND];
export type SymbolKind = (typeof SYMBOL_KIND)[keyof typeof SYMBOL_KIND];
export type Position = { line: number; column: number };
export type ServiceDiagnostic = { line: number; message: string; severity: Severity };
export type ServiceCompletion = { label: string; kind: CompletionKind; detail: string; documentation: string; insertText: string };
export type ServiceLocation = { file: string; line: number; column: number };
export type ServiceSymbol = { name: string; kind: SymbolKind; line: number; column: number };
export type SourceReader = (file: string) => string | null;

type Declaration = ServiceSymbol & { code: string; topLevel: boolean };

const tokensOf = (source: string): Token[] => {
  try {
    return tokenize(source);
  } catch {
    return [];
  }
};

const lineText = (source: string, line: number): string => source.split(NEWLINE)[line] ?? '';

function declarationsOf(source: string): Declaration[] {
  const tokens = tokensOf(source);
  const found: Declaration[] = [];
  let depth = 0;
  const add = (token: Token, kind: SymbolKind): void => {
    found.push({ name: token.text, kind, line: token.line - FIRST_LINE, column: token.column, code: lineText(source, token.line - FIRST_LINE).trim(), topLevel: depth === 0 });
  };
  tokens.forEach((token, index) => {
    const next = tokens[index + 1];
    const after = tokens[index + AFTER_NEXT];
    if (token.kind === 'punctuator' && token.text === PUNCTUATOR.openBrace) depth += 1;
    if (token.kind === 'punctuator' && token.text === PUNCTUATOR.closeBrace) depth -= 1;
    if (!next) return;
    if (token.kind === 'keyword' && DECLARING_KEYWORDS.has(token.text) && next.kind === 'identifier') {
      if (token.text === KEYWORD.function) {
        add(next, SYMBOL_KIND.function);
        for (let position = index + FIRST_PARAMETER; position < tokens.length; position++) {
          const parameter = tokens[position] as Token;
          if (parameter.kind === 'punctuator' && parameter.text === PUNCTUATOR.closeParen) break;
          if (parameter.kind === 'identifier') found.push({ ...declarationAt(source, parameter, SYMBOL_KIND.variable), topLevel: false });
        }
      } else {
        const isArray = after?.kind === 'punctuator' && after.text === OPEN_BRACKET;
        add(next, token.text === KEYWORD.const ? SYMBOL_KIND.constant : isArray ? SYMBOL_KIND.array : SYMBOL_KIND.variable);
      }
    } else if (token.kind === 'identifier' && depth === 0 && isObjectKeyword(token.text) && next.kind === 'identifier') {
      add(next, SYMBOL_KIND.object);
    } else if (token.kind === 'keyword' && token.text === KEYWORD.player && next.kind === 'identifier') {
      found.push({ ...declarationAt(source, next, SYMBOL_KIND.variable), topLevel: false });
    } else if (token.kind === 'keyword' && (token.text === KEYWORD.on || token.text === KEYWORD.every) && depth === 0) {
      found.push({ ...declarationAt(source, token, SYMBOL_KIND.event), name: TEXT.eventName(token.text, next.text), topLevel: true });
    }
  });
  return found;
}

const declarationAt = (source: string, token: Token, kind: SymbolKind): Omit<Declaration, 'topLevel'> => ({
  name: token.text, kind, line: token.line - FIRST_LINE, column: token.column, code: lineText(source, token.line - FIRST_LINE).trim(),
});

const importsOf = (source: string): { path: string; line: number }[] => {
  const tokens = tokensOf(source);
  const found: { path: string; line: number }[] = [];
  tokens.forEach((token, index) => {
    const next = tokens[index + 1];
    if (token.kind === 'keyword' && token.text === KEYWORD.import && next?.kind === 'string') {
      found.push({ path: next.parts.map((part) => (part.kind === 'text' ? part.text : '')).join(''), line: token.line - FIRST_LINE });
    }
  });
  return found;
};

function importedSources(source: string, file: string, read: SourceReader): { file: string; source: string }[] {
  const seen = new Set<string>([file]);
  const result: { file: string; source: string }[] = [];
  const visit = (text: string, from: string): void => {
    for (const entry of importsOf(text)) {
      const target = resolvePath(directoryOf(from), entry.path);
      if (seen.has(target)) continue;
      seen.add(target);
      const imported = read(target);
      if (imported === null) continue;
      result.push({ file: target, source: imported });
      visit(imported, target);
    }
  };
  visit(source, file);
  return result;
}

export function diagnoseAssembly(source: string): ServiceDiagnostic[] {
  const toDiagnostic = (message: string, severity: Severity): ServiceDiagnostic => {
    const match = DIAGNOSTIC_LINE.exec(message);
    return match ? { line: Number(match[2]) - FIRST_LINE, message: match[3] ?? message, severity } : { line: 0, message, severity };
  };
  try {
    return compileAssembly(source, SERVICE_PREFIX).warnings.map((warning) => toDiagnostic(warning, SEVERITY.warning));
  } catch (error) {
    return [toDiagnostic(error instanceof Error ? error.message : String(error), SEVERITY.error)];
  }
}

export function diagnose(source: string, file: string, read: SourceReader): ServiceDiagnostic[] {
  const importLine = (label: string): number => {
    const wanted = resolvePath(directoryOf(file), label);
    return importsOf(source).find((entry) => resolvePath(directoryOf(file), entry.path) === wanted)?.line ?? 0;
  };
  const toDiagnostic = (message: string, severity: Severity): ServiceDiagnostic => {
    const match = DIAGNOSTIC_LINE.exec(message);
    if (!match) return { line: 0, message, severity };
    const [, label, line, text] = match;
    if (label !== undefined) return { line: importLine(label), message: TEXT.importLine(label, Number(line), text ?? ''), severity };
    return { line: Number(line) - FIRST_LINE, message: text ?? message, severity };
  };
  try {
    const reader = (name: string): string => {
      const text = read(name);
      if (text === null) throw new Error(name);
      return text;
    };
    const result = compileSource(source, SERVICE_PREFIX, {}, { file, read: reader });
    return result.warnings.map((warning) => toDiagnostic(warning, SEVERITY.warning));
  } catch (error) {
    return [toDiagnostic(error instanceof Error ? error.message : String(error), SEVERITY.error)];
  }
}

const wordAt = (source: string, position: Position): { word: string; start: number; end: number; text: string } => {
  const text = lineText(source, position.line);
  let start = position.column;
  let end = position.column;
  while (start > 0 && WORD_CHARACTER.test(text.charAt(start - 1))) start -= 1;
  while (end < text.length && WORD_CHARACTER.test(text.charAt(end))) end += 1;
  return { word: text.slice(start, end), start, end, text };
};

const precedingWord = (text: string, before: number): string | null => {
  if (text.charAt(before - 1) !== DOT) return null;
  let start = before - 1;
  while (start > 0 && WORD_CHARACTER.test(text.charAt(start - 1))) start -= 1;
  return start < before - 1 ? text.slice(start, before - 1) : null;
};

const BUILTIN_NAMES: readonly string[] = Object.values(BUILTIN);

export function complete(source: string, position: Position, file: string, read: SourceReader): ServiceCompletion[] {
  const before = lineText(source, position.line).slice(0, position.column);
  const member = MEMBER_BEFORE_CURSOR.exec(before);
  const group = member ? valueGroup(member[1] ?? '') : null;
  if (group) {
    return group.entries.flatMap((entry) => entry.names.map((name) => ({
      label: name, kind: COMPLETION_KIND.value, detail: entry.value, documentation: entry.label, insertText: name,
    })));
  }
  if (ACTION_BEFORE_CURSOR.test(before)) {
    return [...OPCODES.values()].slice(0, MAX_ACTION_COMPLETIONS).map((opcode) => {
      const name = opcode.alias ?? String(opcode.number);
      return { label: name, kind: COMPLETION_KIND.action, detail: TEXT.actionDetail(opcode.number), documentation: opcode.description, insertText: name };
    });
  }
  const items: ServiceCompletion[] = [];
  for (const keyword of KEYWORDS) items.push({ label: keyword, kind: COMPLETION_KIND.keyword, detail: '', documentation: TEXT.keywords[keyword] ?? '', insertText: keyword });
  for (const name of BUILTIN_NAMES) {
    const [signature, description] = TEXT.builtins[name] ?? [name, ''];
    items.push({ label: name, kind: COMPLETION_KIND.function, detail: signature, documentation: description, insertText: name });
  }
  for (const entry of VALUE_GROUP_LIST) items.push({ label: entry.name, kind: COMPLETION_KIND.group, detail: entry.paramKind, documentation: '', insertText: entry.name });
  for (const kind of Object.keys(OBJECT_KINDS)) items.push({ label: kind, kind: COMPLETION_KIND.kind, detail: '', documentation: TEXT.objectKindHover(kind), insertText: kind });
  const declared = [...declarationsOf(source), ...importedSources(source, file, read).flatMap((imported) => declarationsOf(imported.source).filter((entry) => entry.topLevel))];
  const seen = new Set(items.map((item) => item.label));
  for (const entry of declared) {
    if (entry.kind === SYMBOL_KIND.event || seen.has(entry.name)) continue;
    seen.add(entry.name);
    const kind = entry.kind === SYMBOL_KIND.function ? COMPLETION_KIND.function : entry.kind === SYMBOL_KIND.constant ? COMPLETION_KIND.constant : COMPLETION_KIND.variable;
    items.push({ label: entry.name, kind, detail: entry.code, documentation: '', insertText: entry.name });
  }
  return items;
}

function findDeclaration(source: string, file: string, read: SourceReader, name: string, line: number): ServiceLocation | null {
  const local = declarationsOf(source).filter((entry) => entry.name === name && entry.kind !== SYMBOL_KIND.event);
  const before = local.filter((entry) => entry.line <= line);
  const chosen = before[before.length - 1] ?? local[0];
  if (chosen) return { file, line: chosen.line, column: chosen.column };
  for (const imported of importedSources(source, file, read)) {
    const match = declarationsOf(imported.source).find((entry) => entry.name === name && entry.topLevel);
    if (match) return { file: imported.file, line: match.line, column: match.column };
  }
  return null;
}

export function definition(source: string, position: Position, file: string, read: SourceReader): ServiceLocation | null {
  const { word } = wordAt(source, position);
  return word === '' ? null : findDeclaration(source, file, read, word, position.line);
}

export function hover(source: string, position: Position, file: string, read: SourceReader): string | null {
  const { word, start, end, text } = wordAt(source, position);
  if (word === '') return null;
  const groupName = precedingWord(text, start);
  const group = groupName === null ? null : valueGroup(groupName);
  const value = group?.members.get(word);
  if (group && value !== undefined) {
    const entry = group.entries.find((candidate) => candidate.names.includes(word));
    return TEXT.valueHover(group.name, word, value, entry?.label ?? '');
  }
  if (text.charAt(end) === DOT) {
    const named = valueGroup(word);
    if (named) return TEXT.groupHover(named.name, named.paramKind, named.entries.length);
  }
  const builtin = TEXT.builtins[word];
  if (builtin) return TEXT.builtinHover(builtin[0], builtin[1]);
  const keyword = TEXT.keywords[word];
  if (keyword) return keyword;
  if (isObjectKeyword(word)) return TEXT.objectKindHover(word);
  const opcode = DIGITS.test(word) && ACTION_BEFORE_CURSOR.test(text.slice(0, end)) ? opcodeByNumber(Number(word)) : opcodeByName(word);
  if (opcode) return TEXT.actionHover(opcode.number, opcode.alias ?? textName(opcode), opcode.description, opcode.paramA, opcode.paramB);
  const location = findDeclaration(source, file, read, word, position.line);
  if (!location) return null;
  const code = location.file === file ? lineText(source, location.line) : lineText(read(location.file) ?? '', location.line);
  return TEXT.declarationHover(code.trim());
}

export const symbols = (source: string): ServiceSymbol[] =>
  declarationsOf(source).filter((entry) => entry.topLevel).map(({ name, kind, line, column }) => ({ name, kind, line, column }));
