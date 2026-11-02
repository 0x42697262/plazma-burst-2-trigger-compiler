export const TEXT = Object.freeze({
  usage: 'Usage: npm run snapshot-opcodes [-- --from <path to plazma-burst-2/data/opcodes.js>]',
  missingTable: (file: string): string => `No opcode table found in ${file}`,
  wrote: (count: number, file: string): string => `Wrote ${count} actions to ${file}`,
  lineEnd: '\n',
});
