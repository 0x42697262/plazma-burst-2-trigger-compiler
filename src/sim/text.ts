export const TEXT = Object.freeze({
  stackOverflow: 'Too many frames on the trigger stack.',
  missingTrigger: (index: unknown): string => `No trigger with index ${String(index)}.`,
  missingTimer: (index: unknown): string => `No timer with index ${String(index)}.`,
  noVarSync: 'Sync action without the Var Sync engine mark in the map.',
  syncNameTooLong: 'Sync action: the variable name is longer than 2048 characters.',
  syncValueTooLong: 'Sync action: the value is longer than 2048 characters.',
  noCharacter: (slot: string): string => `No character in slot ${slot}.`,
  stepLimit: (steps: number): string => `Stopped after ${steps} actions: endless loop?`,
  noSuchUid: (uid: string): string => `No trigger with uid ${uid}.`,
  actionError: (uid: string, position: number, message: string): string => `Trigger ${uid}, action ${position}: ${message}`,
});
