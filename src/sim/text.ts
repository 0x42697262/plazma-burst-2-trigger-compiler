export const TEXT = Object.freeze({
  stackOverflow: 'Too many frames on the trigger stack.',
  missingTrigger: (index: unknown): string => `No trigger with index ${String(index)}.`,
  missingTimer: (index: unknown): string => `No timer with index ${String(index)}.`,
  unsupported: (opcode: number): string => `Action ${opcode} is not simulated; it was skipped.`,
  noCharacter: (slot: string): string => `No character in slot ${slot}.`,
  stepLimit: (steps: number): string => `Stopped after ${steps} actions: endless loop?`,
  noSuchUid: (uid: string): string => `No trigger with uid ${uid}.`,
  actionError: (uid: string, position: number, message: string): string => `Trigger ${uid}, action ${position}: ${message}`,
});
