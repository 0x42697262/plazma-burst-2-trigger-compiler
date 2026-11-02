export const ACTION_COUNT = 531;

export const OPCODE = Object.freeze({
  showText: 42,
  disableTrigger: 19,
  enableTrigger: 20,
  setTriggerCalls: 22,
  enableTimer: 25,
  resetTimer: 44,
  disableTimer: 26,
  executeTrigger: 99,
  setVariable: 100,
  setIfUndefined: 101,
  addValue: 102,
  multiplyValue: 103,
  addVariable: 104,
  multiplyVariable: 105,
  randomFloat: 106,
  randomInteger: 107,
  round: 108,
  floor: 109,
  continueIfGreater: 110,
  continueIfLessValue: 115,
  skipIfNotEqualValue: 123,
  moduloValue: 124,
  copyVariable: 125,
  moduloVariable: 127,
  divideValue: 131,
  divideVariable: 132,
  powerVariable: 133,
  powerValue: 134,
  currentPlayerSlot: 137,
  containsValue: 149,
  containsVariable: 150,
  length: 151,
  appendString: 152,
  negate: 154,
  initiatorSlot: 180,
  playerNameBySlot: 185,
  playerNameBySlotVariable: 188,
  syncReplace: 223,
  syncDefault: 224,
  syncMax: 225,
  syncMin: 226,
  syncLongest: 227,
  onPlayerJoin: 228,
  bindKey: 288,
  loadIndirect: 294,
  replaceTemplate: 295,
  replaceInVariable: 325,
  replaceInValue: 326,
  randomFloatVariable: 327,
  storeIndirect: 342,
  timeSinceStart: 348,
  splitByValue: 349,
  arrayGetIndex: 350,
  arrayPush: 352,
  createArray: 354,
  skipIfEqual: 361,
  switchToTriggerIndex: 362,
  switchToTrigger: 363,
  skipIfGreater: 364,
  skipIfLess: 365,
  removeStart: 372,
  splitByVariable: 399,
  joinByVariable: 405,
  activeSlots: 508,
});

export const TEMPLATE_REPLACED_B: ReadonlySet<number> = new Set([
  OPCODE.replaceTemplate, OPCODE.replaceInVariable, OPCODE.replaceInValue, OPCODE.arrayGetIndex, OPCODE.arrayPush,
]);

export const TEMPLATE_REPLACED_A: ReadonlySet<number> = new Set([OPCODE.showText]);

export const SKIPS_NEXT: ReadonlySet<number> = new Set([
  OPCODE.skipIfNotEqualValue, OPCODE.skipIfEqual, OPCODE.skipIfGreater, OPCODE.skipIfLess,
]);

export const AVOIDED: ReadonlySet<number> = new Set([OPCODE.switchToTriggerIndex]);

export const SYNC_ACTIONS: ReadonlySet<number> = new Set([
  OPCODE.syncReplace, OPCODE.syncDefault, OPCODE.syncMax, OPCODE.syncMin, OPCODE.syncLongest,
]);

export const SYNC_TEXT_LIMIT = 2048;
