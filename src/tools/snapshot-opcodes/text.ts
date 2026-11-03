export const TEXT = Object.freeze({
  usage: 'Usage: npm run snapshot-opcodes [-- --from <path to plazma-burst-2/data/opcodes.js>] [--editor <path to plazma-burst-2/src/features/map_editor/domain>]',
  missingTable: (file: string): string => `No opcode table found in ${file}`,
  wrote: (count: number, tags: number, file: string): string => `Wrote ${count} actions and ${tags} map element rules to ${file}`,
  lineEnd: '\n',
});
