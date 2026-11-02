export const TEXT = Object.freeze({
  alarm: 'This map was changed after it was published. Its scripts are turned off.',
  badDecode: 'Internal error: the text decoder does not give back the texts.',
  noSeparator: 'Internal error: every separator character is used by a text of the program.',
  noRunValue: (uid: string): string => `Internal error: trigger ${uid} jumps before its check value is set.`,
  unknownJump: (uid: string, target: string): string => `Internal error: trigger ${uid} jumps to ${target}, which is not in the program.`,
});
