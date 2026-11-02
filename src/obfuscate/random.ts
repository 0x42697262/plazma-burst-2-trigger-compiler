import { fnvHash } from '../compiler/names.ts';
import { HASH_SEPARATOR } from '../compiler/keys.ts';
import { MULBERRY } from './constants.ts';

export type Random = {
  below: (limit: number) => number;
  between: (low: number, high: number) => number;
  chance: (probability: number) => boolean;
  pick: <Item>(items: readonly Item[]) => Item;
  shuffle: <Item>(items: readonly Item[]) => Item[];
};

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
