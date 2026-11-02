export const TEXT = Object.freeze({
  badPrefix: (prefix: string): string => `The prefix "${prefix}" must start with a letter and hold only letters and digits.`,
  noStartLabel: 'The program must start with a label.',
  unknownLabel: (label: string): string => `Unknown label "${label}".`,
  duplicateLabel: (label: string): string => `The label "${label}" is defined twice.`,
  unreachable: (label: string, count: number): string => `${count} unreachable action(s) after a jump or return in "${label}" were dropped.`,
  skipBeforeBranch: (line: number): string => `line ${line}: a skip action cannot come right before a conditional jump; it would skip only part of it.`,
  skipBeforeLabel: (label: string): string => `A skip action comes right before the label "${label}"; it cannot skip into another trigger.`,
  skipAtEnd: (uid: string): string => `Trigger ${uid} ends with a skip action; it skips nothing.`,
  unknownTarget: (uid: string, target: string): string => `Trigger ${uid} targets ${target}, which is not in the program. Declare it as external if the map has it.`,
  switchByIndex: (uid: string): string => `Trigger ${uid} uses action 362 (switch by trigger index); indexes depend on the host map.`,
  notText: (uid: string): string => `Trigger ${uid} has a value that cannot be written as trigger text; use the XML output.`,
  hashValue: (uid: string, value: string): string => `Trigger ${uid}: the value "${value}" starts with "#"; the game replaces it with an object index if a uid matches.`,
});
