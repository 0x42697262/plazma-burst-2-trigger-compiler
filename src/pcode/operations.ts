import { OPCODE } from '../opcodes/constants.ts';

export type Access = 'read' | 'write' | 'both' | 'fixed';

const both = (...opcodes: number[]): [number, [Access, Access]][] => opcodes.map((opcode) => [opcode, ['both', 'read']]);
const changeA = (...opcodes: number[]): [number, [Access, Access]][] => opcodes.map((opcode) => [opcode, ['both', 'fixed']]);
const writeFromB = (...opcodes: number[]): [number, [Access, Access]][] => opcodes.map((opcode) => [opcode, ['write', 'read']]);
const writeA = (...opcodes: number[]): [number, [Access, Access]][] => opcodes.map((opcode) => [opcode, ['write', 'fixed']]);
const readBoth = (...opcodes: number[]): [number, [Access, Access]][] => opcodes.map((opcode) => [opcode, ['read', 'read']]);

export const OPERATIONS: ReadonlyMap<number, readonly [Access, Access]> = new Map([
  ...both(
    OPCODE.addVariable, OPCODE.multiplyVariable, OPCODE.moduloVariable, OPCODE.divideVariable, OPCODE.powerVariable,
    OPCODE.appendString, OPCODE.containsVariable, OPCODE.splitByVariable, OPCODE.joinByVariable,
  ),
  ...changeA(
    OPCODE.setIfUndefined, OPCODE.addValue, OPCODE.multiplyValue, OPCODE.moduloValue, OPCODE.divideValue, OPCODE.powerValue,
    OPCODE.containsValue, OPCODE.splitByValue, OPCODE.round, OPCODE.floor, OPCODE.negate, OPCODE.arrayGetIndex,
  ),
  ...writeFromB(
    OPCODE.copyVariable, OPCODE.length, OPCODE.loadIndirect, OPCODE.replaceInVariable, OPCODE.playerNameBySlotVariable,
    OPCODE.teamBySlotVariable, OPCODE.randomFloatVariable,
  ),
  ...writeA(
    OPCODE.randomFloat, OPCODE.randomInteger, OPCODE.playerNameBySlot, OPCODE.teamBySlot, OPCODE.currentPlayerSlot,
    OPCODE.initiatorSlot, OPCODE.talkerSlot, OPCODE.talkerName, OPCODE.talkerLogin, OPCODE.chatInput, OPCODE.timeSinceStart,
    OPCODE.activeSlots, OPCODE.createArray, OPCODE.replaceInValue,
  ),
  ...readBoth(OPCODE.storeIndirect, OPCODE.skipIfEqual, OPCODE.skipIfGreater, OPCODE.skipIfLess),
  [OPCODE.showText, ['read', 'fixed']],
  [OPCODE.skipIfNotEqualValue, ['read', 'fixed']],
  [OPCODE.arrayPush, ['read', 'fixed']],
  [OPCODE.removeStart, ['fixed', 'both']],
]);

export const SWITCHES: ReadonlySet<number> = new Set([OPCODE.switchToTrigger, OPCODE.switchToTriggerIndex]);
