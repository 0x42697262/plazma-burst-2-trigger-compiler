export const ACTION_COUNT = 531;

export const OPCODE = Object.freeze({
  executeTrigger: 99,
  switchToTrigger: 363,
  switchToTriggerIndex: 362,
  setVariable: 100,
  skipIfNotEqualValue: 123,
  skipIfEqual: 361,
  skipIfGreater: 364,
  skipIfLess: 365,
  replaceInVariable: 325,
  replaceInValue: 326,
  arrayGetIndex: 350,
  arrayPush: 352,
  showText: 42,
});

export const TEMPLATE_REPLACED_B: ReadonlySet<number> = new Set([
  OPCODE.replaceInVariable, OPCODE.replaceInValue, OPCODE.arrayGetIndex, OPCODE.arrayPush,
]);

export const TEMPLATE_REPLACED_A: ReadonlySet<number> = new Set([OPCODE.showText]);

export const AVOIDED: ReadonlySet<number> = new Set([OPCODE.switchToTriggerIndex]);
