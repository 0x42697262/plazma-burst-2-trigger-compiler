import { OPCODE, SKIPS_NEXT } from '../opcodes/constants.ts';
import { uidOf } from './map-file.ts';
import type { MapAction, MapElement } from './map-file.ts';
import { TAG, UID_MARK } from './keys.ts';

type Uses = ReadonlyMap<string, readonly MapAction[]>;

function usesByVariable(elements: readonly MapElement[]): Uses {
  const uses = new Map<string, MapAction[]>();
  const add = (name: string, action: MapAction): void => {
    uses.set(name, [...(uses.get(name) ?? []), action]);
  };
  for (const element of elements) {
    for (const action of element.actions) {
      add(action.targetA, action);
      if (action.targetB !== action.targetA) add(action.targetB, action);
    }
  }
  return uses;
}

function triggerUids(elements: readonly MapElement[]): ReadonlySet<string> {
  const first = new Map<string, MapElement>();
  for (const element of elements) {
    const uid = uidOf(element);
    if (uid !== undefined && uid.startsWith(UID_MARK) && !first.has(uid)) first.set(uid, element);
  }
  return new Set([...first].filter(([, element]) => element.tag === TAG.trigger).map(([uid]) => uid));
}

function isTriggerList(name: string, uses: Uses, triggers: ReadonlySet<string>): boolean {
  const found = uses.get(name) ?? [];
  const isAllowed = (action: MapAction): boolean => {
    if (action.targetA === name && action.type === OPCODE.createArray) return true;
    if (action.targetA === name && action.type === OPCODE.arrayPush) return triggers.has(action.targetB);
    return action.targetB === name && action.targetA !== name && action.type === OPCODE.copyVariable;
  };
  return found.some((action) => action.type === OPCODE.createArray) && found.every(isAllowed);
}

function isProven(actions: readonly MapAction[], position: number, uses: Uses, triggers: ReadonlySet<string>): boolean {
  const name = actions[position]?.targetA ?? '';
  let readsElement = false;
  for (let index = position - 1; index >= 0; index--) {
    const action = actions[index];
    if (action === undefined || action.targetA !== name) return false;
    const isSkipped = index > 0 && SKIPS_NEXT.has(actions[index - 1]?.type ?? 0);
    if (action.type === OPCODE.arrayGetIndex && action.targetB !== name) {
      readsElement = true;
      continue;
    }
    if (isSkipped) return false;
    if (action.type === OPCODE.copyVariable) return readsElement && isTriggerList(action.targetB, uses, triggers);
    if (action.type === OPCODE.setVariable) return !readsElement && triggers.has(action.targetB);
    return false;
  }
  return false;
}

export function unprovenSwitches(elements: readonly MapElement[]): MapAction[] {
  const switches = elements.flatMap((element) => element.actions.flatMap((action, position) => (action.type === OPCODE.switchToTriggerIndex ? [{ element, position, action }] : [])));
  if (switches.length === 0) return [];
  const storesByName = elements.some((element) => element.actions.some((action) => action.type === OPCODE.storeIndirect));
  if (storesByName) return switches.map(({ action }) => action);
  const uses = usesByVariable(elements);
  const triggers = triggerUids(elements);
  return switches.filter(({ element, position }) => !isProven(element.actions, position, uses, triggers)).map(({ action }) => action);
}
