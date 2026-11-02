export const TEXT = Object.freeze({
  built: (folder: string, examples: number, kilobytes: number): string => `Built ${folder}: ${examples} example files, app.js ${kilobytes} KB\n`,
  empty: '',
});
