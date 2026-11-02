import vm from 'node:vm';
import { OPCODES_GLOBAL } from './keys.ts';

export type SnapshotAction = { alias?: string; a: string; b: string; desc: string };
export type Snapshot = { source: string; fetched: string; actions: Record<string, SnapshotAction> };

type RawAction = { desc: string; a: string; b: string; alias?: string };
type RawTable = { source: string; fetched: string; actions: Record<string, RawAction> };

export function readOpcodeTable(code: string): RawTable | null {
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  const table = sandbox[OPCODES_GLOBAL] as RawTable | undefined;
  return table?.actions ? table : null;
}

const byNumber = (first: string, second: string): number => Number(first) - Number(second);

export function toSnapshot(table: RawTable): Snapshot {
  const actions: Record<string, SnapshotAction> = {};
  for (const key of Object.keys(table.actions).sort(byNumber)) {
    const raw = table.actions[key];
    if (!raw) continue;
    actions[key] = raw.alias ? { alias: raw.alias, a: raw.a, b: raw.b, desc: raw.desc } : { a: raw.a, b: raw.b, desc: raw.desc };
  }
  return { source: table.source, fetched: table.fetched, actions };
}
