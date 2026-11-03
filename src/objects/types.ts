import type { Action } from '../program/types.ts';

export type Attribute = readonly [string, string];
export type MapObject = {
  constructorName: string; tag: string; uid: string | null; mark: string | null;
  set: readonly Attribute[]; initial: readonly Attribute[]; actions: readonly Action[] | null; line: number; file?: string;
};
