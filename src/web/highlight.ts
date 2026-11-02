import { StreamLanguage } from '@codemirror/language';
import type { StringStream } from '@codemirror/language';
import { BUILTIN, KEYWORDS } from '../lang/keys.ts';
import { isObjectKeyword } from '../objects/objects.ts';
import { ASSEMBLY_INSTRUCTIONS, BOOLEANS, HIGHLIGHT, TOKEN } from './keys.ts';

type State = { inComment: boolean };

const BUILTINS: ReadonlySet<string> = new Set(Object.values(BUILTIN));

const readString = (stream: StringStream): string => {
  let escaped = false;
  for (let next = stream.next(); next !== undefined; next = stream.next()) {
    if (next === HIGHLIGHT.quote && !escaped) break;
    escaped = next === HIGHLIGHT.escape && !escaped;
  }
  return TOKEN.string;
};

const blockComment = (stream: StringStream, state: State): string => {
  if (stream.skipTo(HIGHLIGHT.blockEnd)) {
    stream.match(HIGHLIGHT.blockEnd);
    state.inComment = false;
  } else {
    stream.skipToEnd();
  }
  return TOKEN.comment;
};

export const ptcLanguage = StreamLanguage.define<State>({
  startState: () => ({ inComment: false }),
  token(stream, state) {
    if (state.inComment) return blockComment(stream, state);
    if (stream.eatSpace()) return null;
    if (stream.match(HIGHLIGHT.lineComment)) {
      stream.skipToEnd();
      return TOKEN.comment;
    }
    if (stream.match(HIGHLIGHT.blockStart)) {
      state.inComment = true;
      return blockComment(stream, state);
    }
    if (stream.eat(HIGHLIGHT.quote)) return readString(stream);
    if (stream.match(HIGHLIGHT.namedValue)) return TOKEN.atom;
    if (stream.match(HIGHLIGHT.number)) return TOKEN.number;
    if (stream.match(HIGHLIGHT.reference)) return TOKEN.special;
    const word = stream.match(HIGHLIGHT.identifier);
    if (Array.isArray(word)) {
      const text = word[0];
      if (BOOLEANS.has(text)) return TOKEN.atom;
      if (KEYWORDS.has(text)) return TOKEN.keyword;
      if (isObjectKeyword(text)) return TOKEN.type;
      if (BUILTINS.has(text) && stream.match(HIGHLIGHT.callAhead, false)) return TOKEN.builtin;
      return TOKEN.variable;
    }
    if (stream.match(HIGHLIGHT.operator)) return TOKEN.operator;
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: HIGHLIGHT.lineComment, block: { open: HIGHLIGHT.blockStart, close: HIGHLIGHT.blockEnd } } },
});

export const pasmLanguage = StreamLanguage.define<State>({
  startState: () => ({ inComment: false }),
  token(stream) {
    if (stream.sol() && stream.match(HIGHLIGHT.label)) return TOKEN.label;
    if (stream.eatSpace()) return null;
    if (stream.match(HIGHLIGHT.assemblyComment)) {
      stream.skipToEnd();
      return TOKEN.comment;
    }
    if (stream.match(HIGHLIGHT.directive)) return TOKEN.meta;
    if (stream.eat(HIGHLIGHT.quote)) return readString(stream);
    if (stream.match(HIGHLIGHT.reference)) return TOKEN.special;
    if (stream.match(HIGHLIGHT.number)) return TOKEN.number;
    const word = stream.match(HIGHLIGHT.identifier);
    if (Array.isArray(word)) return ASSEMBLY_INSTRUCTIONS.has(word[0]) ? TOKEN.keyword : TOKEN.builtin;
    stream.next();
    return null;
  },
});
