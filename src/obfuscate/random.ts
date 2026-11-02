import { fnvHash } from '../compiler/names.ts';
import { HASH_SEPARATOR } from '../compiler/keys.ts';
import { BASE36 } from '../compiler/constants.ts';
import { MULBERRY, RANDOM_SEED_WORDS } from './constants.ts';
import { EMPTY, RANDOM_SEED } from './keys.ts';

export type Random = {
  below: (limit: number) => number;
  between: (low: number, high: number) => number;
  chance: (probability: number) => boolean;
  pick: <Item>(items: readonly Item[]) => Item;
  shuffle: <Item>(items: readonly Item[]) => Item[];
};

export function randomSeed(): string {
  const words = new Uint32Array(RANDOM_SEED_WORDS);
  globalThis.crypto.getRandomValues(words);
  return [...words].map((word) => word.toString(BASE36)).join(EMPTY);
}

export const isRandomSeed = (seed: string): boolean => seed.trim().toLowerCase() === RANDOM_SEED;

export const resolveSeed = (seed: string): string => (isRandomSeed(seed) ? randomSeed() : seed);

export function createRandom(seed: string, purpose: string): Random {
  let state = fnvHash([seed, purpose].join(HASH_SEPARATOR));
  const next = (): number => {
    state = (state + MULBERRY.increment) >>> 0;
    let mixed = Math.imul(state ^ (state >>> MULBERRY.shiftA), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> MULBERRY.shiftB), mixed | MULBERRY.orMask);
    return ((mixed ^ (mixed >>> MULBERRY.shiftC)) >>> 0) / MULBERRY.range;
  };
  const below = (limit: number): number => Math.floor(next() * limit);
  return {
    below,
    between: (low, high) => low + below(high - low),
    chance: (probability) => next() < probability,
    pick: (items) => items[below(items.length)] as (typeof items)[number],
    shuffle: (items) => {
      const shuffled = [...items];
      for (let position = shuffled.length - 1; position > 0; position--) {
        const other = below(position + 1);
        [shuffled[position], shuffled[other]] = [shuffled[other] as (typeof items)[number], shuffled[position] as (typeof items)[number]];
      }
      return shuffled;
    },
  };
}
