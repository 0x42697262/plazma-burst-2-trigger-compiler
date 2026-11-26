import { ARRAY_TYPE } from './keys.ts';

export type Encoded = readonly [string, string];
export type Snapshot = Record<string, Encoded>;
export type Mismatch = { name: string; simulated: Encoded | null; game: Encoded | null };

export const encodeValue = (value: unknown): Encoded =>
  (Array.isArray(value) ? [ARRAY_TYPE, JSON.stringify(value.map(String))] : [typeof value, String(value)]);

export const encodeVariables = (variables: Record<string, unknown>): Snapshot =>
  Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, encodeValue(value)]));

const sameValue = (first: Encoded | null, second: Encoded | null): boolean =>
  first !== null && second !== null && first[0] === second[0] && first[1] === second[1];

export function compareSnapshots(simulated: Snapshot, game: Snapshot, owns: (name: string) => boolean): Mismatch[] {
  const names = new Set([...Object.keys(simulated), ...Object.keys(game)].filter(owns));
  const mismatches: Mismatch[] = [];
  for (const name of [...names].sort()) {
    const simulatedValue = simulated[name] ?? null;
    const gameValue = game[name] ?? null;
    if (!sameValue(simulatedValue, gameValue)) mismatches.push({ name, simulated: simulatedValue, game: gameValue });
  }
  return mismatches;
}
