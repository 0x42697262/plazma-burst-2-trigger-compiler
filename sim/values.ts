import { DECIMAL, NOT_FOUND } from './constants.ts';
import { EMPTY, UID_MARK } from './keys.ts';

export type Registry = { uids: string[]; ids: number[] };

export function loadValue(raw: string, registry: Registry): unknown {
  if (raw.startsWith(UID_MARK)) {
    const position = registry.uids.indexOf(raw);
    const id = position === NOT_FOUND ? undefined : registry.ids[position];
    return id === undefined ? raw : id;
  }
  const integer = parseInt(raw, DECIMAL);
  return String(integer) === raw ? integer : raw;
}

export const toFloat = (value: unknown): number => parseFloat(String(value));

export const toNumber = (value: unknown): number => Number(value);

export const toIndex = (value: unknown): number => {
  if (typeof value !== 'string') return value as number;
  const parsed = parseInt(value, DECIMAL);
  return isNaN(parsed) ? 0 : parsed;
};

const toPrimitive = (value: unknown): unknown => (Array.isArray(value) ? value.join() : value);

export function add(left: unknown, right: unknown): unknown {
  const leftPrimitive = toPrimitive(left);
  const rightPrimitive = toPrimitive(right);
  if (typeof leftPrimitive === 'string' || typeof rightPrimitive === 'string') return String(leftPrimitive) + String(rightPrimitive);
  return toNumber(leftPrimitive) + toNumber(rightPrimitive);
}

export const stringOf = (value: unknown): string => add(EMPTY, value) as string;

export function replaceVariables(input: unknown, variables: Record<string, unknown>): string {
  const text = typeof input === 'string' ? input : stringOf(input);
  const found: string[] = [];
  for (const key in variables) {
    if (text.indexOf(key) === NOT_FOUND) continue;
    found.push(key);
    let added = false;
    for (let position = 0; position < found.length; position++) {
      if (key.length > (found[position] ?? EMPTY).length) {
        found.splice(position, 0, key);
        added = true;
        break;
      }
    }
    if (!added) found.push(key);
  }
  let result = text;
  for (const key of found) result = result.split(key).join(variables[key] as string);
  return result;
}
