import {
  BLOCK_COMMENT_END, BLOCK_COMMENT_START, DIGIT, ESCAPE, ESCAPED, IDENTIFIER_PART, IDENTIFIER_START, INTERPOLATION_END, INTERPOLATION_START, KEYWORDS,
  LINE_COMMENT, NEWLINE, NUMBER, PUNCTUATORS, QUOTE, WHITESPACE,
} from './keys.ts';
import { TEXT } from './text.ts';
import { ESCAPE_LENGTH } from './constants.ts';

export type StringPart = { kind: 'text'; text: string } | { kind: 'source'; source: string; line: number };

export type Token =
  | { kind: 'identifier' | 'keyword' | 'number' | 'punctuator'; text: string; line: number; column: number }
  | { kind: 'string'; text: string; parts: StringPart[]; line: number; column: number }
  | { kind: 'end'; text: string; line: number; column: number };

export class SourceError extends Error {
  readonly line: number;
  file: string | undefined;

  constructor(line: number, message: string, file?: string) {
    super(message);
    this.line = line;
    this.file = file;
  }
}

type Cursor = { source: string; position: number; line: number; lineStart: number };

const peek = (cursor: Cursor, offset = 0): string => cursor.source[cursor.position + offset] ?? '';

const advance = (cursor: Cursor, count = 1): void => {
  for (let step = 0; step < count; step++) {
    if (peek(cursor) === NEWLINE) {
      cursor.line += 1;
      cursor.lineStart = cursor.position + 1;
    }
    cursor.position += 1;
  }
};

const skipSpaceAndComments = (cursor: Cursor): void => {
  for (;;) {
    if (WHITESPACE.test(peek(cursor))) {
      advance(cursor);
    } else if (cursor.source.startsWith(LINE_COMMENT, cursor.position)) {
      while (cursor.position < cursor.source.length && peek(cursor) !== NEWLINE) advance(cursor);
    } else if (cursor.source.startsWith(BLOCK_COMMENT_START, cursor.position)) {
      const startLine = cursor.line;
      const end = cursor.source.indexOf(BLOCK_COMMENT_END, cursor.position + BLOCK_COMMENT_START.length);
      if (end < 0) throw new SourceError(startLine, TEXT.unclosedComment);
      advance(cursor, end + BLOCK_COMMENT_END.length - cursor.position);
    } else {
      return;
    }
  }
};

const readInterpolation = (cursor: Cursor): StringPart => {
  const line = cursor.line;
  advance(cursor);
  let depth = 1;
  let source = '';
  let inString = false;
  while (cursor.position < cursor.source.length) {
    const character = peek(cursor);
    if (inString && character === ESCAPE) {
      source += character + peek(cursor, 1);
      advance(cursor, ESCAPE_LENGTH);
      continue;
    }
    if (character === QUOTE) inString = !inString;
    if (!inString && character === INTERPOLATION_START) depth += 1;
    if (!inString && character === INTERPOLATION_END) {
      depth -= 1;
      if (depth === 0) {
        advance(cursor);
        return { kind: 'source', source, line };
      }
    }
    if (character === NEWLINE) break;
    source += character;
    advance(cursor);
  }
  throw new SourceError(line, TEXT.unclosedInterpolation);
};

const readString = (cursor: Cursor): Token => {
  const line = cursor.line;
  const column = cursor.position - cursor.lineStart;
  const start = cursor.position;
  advance(cursor);
  const parts: StringPart[] = [];
  let text = '';
  const flush = (): void => {
    if (text !== '') parts.push({ kind: 'text', text });
    text = '';
  };
  for (;;) {
    const character = peek(cursor);
    if (character === '' || character === NEWLINE) throw new SourceError(line, TEXT.unclosedString);
    if (character === QUOTE) {
      advance(cursor);
      break;
    }
    if (character === ESCAPE) {
      const escaped = ESCAPED[peek(cursor, 1)];
      if (escaped === undefined) throw new SourceError(line, TEXT.badEscape(peek(cursor, 1)));
      text += escaped;
      advance(cursor, ESCAPE_LENGTH);
    } else if (character === INTERPOLATION_START) {
      flush();
      parts.push(readInterpolation(cursor));
    } else {
      text += character;
      advance(cursor);
    }
  }
  flush();
  return { kind: 'string', text: cursor.source.slice(start, cursor.position), parts, line, column };
};

export function tokenize(source: string, firstLine = 1): Token[] {
  const cursor: Cursor = { source, position: 0, line: firstLine, lineStart: 0 };
  const tokens: Token[] = [];
  for (;;) {
    skipSpaceAndComments(cursor);
    const line = cursor.line;
    const column = cursor.position - cursor.lineStart;
    const character = peek(cursor);
    if (character === '') {
      tokens.push({ kind: 'end', text: '', line, column });
      return tokens;
    }
    if (character === QUOTE) {
      tokens.push(readString(cursor));
      continue;
    }
    if (IDENTIFIER_START.test(character)) {
      let text = '';
      while (IDENTIFIER_PART.test(peek(cursor))) {
        text += peek(cursor);
        advance(cursor);
      }
      tokens.push({ kind: KEYWORDS.has(text) ? 'keyword' : 'identifier', text, line, column });
      continue;
    }
    if (DIGIT.test(character)) {
      const text = NUMBER.exec(source.slice(cursor.position))?.[0] ?? character;
      advance(cursor, text.length);
      tokens.push({ kind: 'number', text, line, column });
      continue;
    }
    const punctuator = PUNCTUATORS.find((candidate) => source.startsWith(candidate, cursor.position));
    if (punctuator === undefined) throw new SourceError(line, TEXT.unexpectedCharacter(character));
    advance(cursor, punctuator.length);
    tokens.push({ kind: 'punctuator', text: punctuator, line, column });
  }
}
