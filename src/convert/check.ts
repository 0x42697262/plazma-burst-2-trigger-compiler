import { compileSource } from '../lang/compile.ts';
import { createNames } from '../compiler/names.ts';
import { placeObjects } from '../emit/place.ts';
import { stagingPosition } from '../emit/xml-emitter.ts';
import { parseMap } from './map-file.ts';
import type { MapAction } from './map-file.ts';
import { SWITCH_TO_TRIGGER } from './constants.ts';
import { compareMaps, emptyReport } from './compare.ts';
import type { Report } from './compare.ts';
import type { Conversion } from './convert.ts';

export type Rebuild = { report: Report; xml: string };

export function checkConversion(conversion: Conversion, prefix: string): Rebuild {
  let result;
  try {
    result = compileSource(conversion.source, prefix);
  } catch (error) {
    return { report: emptyReport(error instanceof Error ? error.message : String(error)), xml: '' };
  }
  const program = result.program;
  const placement = placeObjects(result.mapObjects, { host: null, staging: (index) => stagingPosition(index, program), previousWalls: [], replacing: false });
  const functionUids = new Map<string, string>();
  const names = createNames(prefix);
  const triggerUids = new Set(program.triggers.map((trigger) => trigger.uid));
  for (const [uid, name] of conversion.functions) {
    const triggerUid = names.triggerUid(name);
    if (triggerUids.has(triggerUid)) functionUids.set(uid, triggerUid);
  }
  const byUid = new Map(program.triggers.map((trigger) => [trigger.uid, trigger]));
  const originalOf = new Map<string, string>();
  for (const [uid, triggerUid] of functionUids) {
    originalOf.set(triggerUid, uid);
    const last = byUid.get(triggerUid)?.actions.at(-1);
    if (last?.opcode === SWITCH_TO_TRIGGER && byUid.has(last.targetA)) originalOf.set(last.targetA, uid);
  }
  const original = (target: string): string => originalOf.get(target) ?? target;
  const functionActions = new Map<string, MapAction[]>();
  for (const [uid, triggerUid] of functionUids) {
    const seen = new Set([triggerUid]);
    const queue = [triggerUid];
    const actions: MapAction[] = [];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      for (const action of byUid.get(next)?.actions ?? []) {
        actions.push({ type: action.opcode, targetA: original(action.targetA), targetB: original(action.targetB) });
        for (const target of [action.targetA, action.targetB]) {
          if (!byUid.has(target) || seen.has(target) || (originalOf.has(target) && original(target) !== uid)) continue;
          seen.add(target);
          queue.push(target);
        }
      }
    }
    functionActions.set(uid, actions);
  }
  return { report: compareMaps(parseMap(placement.xml), conversion, functionUids, functionActions), xml: placement.xml };
}
