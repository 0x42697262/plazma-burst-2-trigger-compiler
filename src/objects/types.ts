export type Attribute = readonly [string, string];
export type MapObject = {
  constructorName: string; tag: string; uid: string | null; mark: string | null;
  set: readonly Attribute[]; initial: readonly Attribute[]; line: number; file?: string;
};
