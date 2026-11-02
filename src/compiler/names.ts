import { CONTINUATION_SEPARATOR, HASH_SEPARATOR, INTERNAL_MARK, PREFIX_PATTERN, SEED_PREFIX_LETTER, TOKEN_LETTERS, TOKEN_SPACE, TRIGGER_MARK, USER_SEPARATOR, VARIABLE_MARK } from './keys.ts';
import type { TokenSpace } from './keys.ts';
import { BASE36, FNV_OFFSET_BASIS, FNV_PRIME, MIN_TOKEN_LENGTH } from './constants.ts';
import { TEXT } from './text.ts';

export class CompileError extends Error {}

export function fnvHash(text: string, start: number = FNV_OFFSET_BASIS): number {
  let hash = start >>> 0;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

export function seededPrefix(seed: string): string {
  return SEED_PREFIX_LETTER + fnvHash(seed).toString(BASE36);
}

export type Shortening = { seed: string };

export type LegendEntry = { space: TokenSpace; token: string; source: string };

export type NamedEntry = { game: string; source: string };

export const describeLegend = (prefix: string, legend: readonly LegendEntry[]): NamedEntry[] => legend.map((entry) => {
  switch (entry.space) {
    case TOKEN_SPACE.user:
      return { game: `${VARIABLE_MARK}${prefix}${USER_SEPARATOR}${entry.token}`, source: `${VARIABLE_MARK}${prefix}${USER_SEPARATOR}${entry.source}` };
    case TOKEN_SPACE.internal:
      return { game: `${VARIABLE_MARK}${prefix}${INTERNAL_MARK}${entry.token}`, source: `${VARIABLE_MARK}${prefix}${INTERNAL_MARK}${entry.source}` };
    case TOKEN_SPACE.userUid:
      return { game: `${TRIGGER_MARK}${prefix}${USER_SEPARATOR}${entry.token}`, source: `${TRIGGER_MARK}${prefix}${USER_SEPARATOR}${entry.source}` };
    case TOKEN_SPACE.internalUid:
      return { game: `${TRIGGER_MARK}${prefix}${INTERNAL_MARK}${entry.token}`, source: `${TRIGGER_MARK}${prefix}${entry.source}` };
  }
});

export type Names = {
  prefix: string;
  shortened: boolean;
  variable: (name: string) => string;
  internalVariable: (name: string) => string;
  userStem: (name: string) => string;
  internalStem: (name: string) => string;
  triggerUid: (label: string) => string;
  freshLabel: (hint: string) => string;
  continuationLabel: (label: string, part: number) => string;
  ownsVariable: (name: string) => boolean;
  ownsUid: (uid: string) => boolean;
  keep: (space: TokenSpace, stem: string) => void;
  legend: () => LegendEntry[];
  reveal: (name: string) => string;
};

const isInternal = (name: string): boolean => name.startsWith(INTERNAL_MARK);

const tokenText = (seed: string, space: TokenSpace, stem: string, attempt: number): string => {
  const length = MIN_TOKEN_LENGTH + Math.floor(attempt / MIN_TOKEN_LENGTH);
  let hash = fnvHash([seed, space, stem, attempt].join(HASH_SEPARATOR));
  let token = '';
  while (token.length < length) {
    token += TOKEN_LETTERS[hash % TOKEN_LETTERS.length];
    hash = Math.floor(hash / TOKEN_LETTERS.length);
    if (hash === 0) hash = fnvHash(token, hash + attempt + 1);
  }
  return token;
};

type Table = { tokens: Map<string, string>; sources: Map<string, string>; kept: Set<string> };

const REVEALED = /^([~#])([A-Za-z][A-Za-z0-9]*)([_:])([a-z]+)(?=[~[0-9]|$)/;

function createShortener(seed: string) {
  const tables = new Map<TokenSpace, Table>(Object.values(TOKEN_SPACE).map((space) => [space, { tokens: new Map(), sources: new Map(), kept: new Set() }]));
  const tableOf = (space: TokenSpace): Table => tables.get(space) as Table;
  const shorten = (space: TokenSpace, stem: string): string => {
    const table = tableOf(space);
    if (table.kept.has(stem)) return stem;
    const known = table.tokens.get(stem);
    if (known !== undefined) return known;
    let attempt = 0;
    let token = tokenText(seed, space, stem, attempt);
    while (table.sources.has(token) || table.kept.has(token)) {
      attempt += 1;
      token = tokenText(seed, space, stem, attempt);
    }
    table.tokens.set(stem, token);
    table.sources.set(token, stem);
    return token;
  };
  const keep = (space: TokenSpace, stem: string): void => {
    const table = tableOf(space);
    if (table.tokens.has(stem)) throw new CompileError(TEXT.keptTooLate(stem));
    table.kept.add(stem);
  };
  const legend = (): LegendEntry[] => [...tables].flatMap(([space, table]) => [...table.tokens].map(([source, token]) => ({ space, token, source })));
  const sourceOf = (space: TokenSpace, token: string): string | undefined => tableOf(space).sources.get(token);
  return { shorten, keep, legend, sourceOf };
}

export function createNames(prefix: string, shortening: Shortening | null = null): Names {
  if (!PREFIX_PATTERN.test(prefix)) throw new CompileError(TEXT.badPrefix(prefix));
  let counter = 0;
  const shortener = shortening === null ? null : createShortener(shortening.seed);
  const stem = (space: TokenSpace, name: string): string => (shortener === null ? name : shortener.shorten(space, name));
  const userStem = (name: string): string => stem(TOKEN_SPACE.user, name);
  const internalStem = (name: string): string => stem(TOKEN_SPACE.internal, name);
  const qualify = (label: string): string => (isInternal(label)
    ? `${prefix}${shortener === null ? label : INTERNAL_MARK + stem(TOKEN_SPACE.internalUid, label)}`
    : `${prefix}${USER_SEPARATOR}${stem(TOKEN_SPACE.userUid, label)}`);
  const reveal = (name: string): string => {
    if (shortener === null) return name;
    const match = REVEALED.exec(name);
    if (match === null || match[2] !== prefix) return name;
    const [whole, mark, , separator, token] = match as unknown as [string, string, string, string, string];
    const variable = mark === VARIABLE_MARK;
    const internal = separator === INTERNAL_MARK;
    const space = variable ? (internal ? TOKEN_SPACE.internal : TOKEN_SPACE.user) : (internal ? TOKEN_SPACE.internalUid : TOKEN_SPACE.userUid);
    const source = shortener.sourceOf(space, token);
    if (source === undefined) return name;
    const revealed = variable || !internal ? `${mark}${prefix}${separator}${source}` : `${mark}${prefix}${source}`;
    return revealed + name.slice(whole.length);
  };
  return {
    prefix,
    shortened: shortener !== null,
    variable: (name) => `${VARIABLE_MARK}${prefix}${USER_SEPARATOR}${userStem(name)}${VARIABLE_MARK}`,
    internalVariable: (name) => `${VARIABLE_MARK}${prefix}${INTERNAL_MARK}${internalStem(name)}${VARIABLE_MARK}`,
    userStem,
    internalStem,
    triggerUid: (label) => `${TRIGGER_MARK}${qualify(label)}`,
    freshLabel: (hint) => {
      counter += 1;
      return `${INTERNAL_MARK}${hint}${counter}`;
    },
    continuationLabel: (label, part) => `${label}${CONTINUATION_SEPARATOR}${part}`,
    ownsVariable: (name) => [USER_SEPARATOR, INTERNAL_MARK].some((mark) => name.startsWith(`${VARIABLE_MARK}${prefix}${mark}`)),
    ownsUid: (uid) => [USER_SEPARATOR, INTERNAL_MARK].some((mark) => uid.startsWith(`${TRIGGER_MARK}${prefix}${mark}`)),
    keep: (space, name) => shortener?.keep(space, name),
    legend: () => shortener?.legend() ?? [],
    reveal,
  };
}
