export const TEXT = Object.freeze({
  stopsTrigger: (opcode: number, line: number): string => `line ${line}: action ${opcode} stops or switches the running trigger, which --target pcode cannot do; use --target triggers`,
  separatorInText: (line: number): string => `line ${line}: text contains the character U+241F, which --target pcode uses to separate its code`,
  unknownLabel: (label: string): string => `Unknown label ${label}.`,
});
