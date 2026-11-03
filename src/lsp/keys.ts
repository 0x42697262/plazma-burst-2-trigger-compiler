export const ASSEMBLY_EXTENSION = '.pasm';
export const FILE_ENCODING = 'utf8';
export const TRIGGER_CHARACTERS: string[] = ['.', '(', '"'];
export const SERVER_NAME = 'ptc-lsp';
export const WORD_AT = (line: string, character: number): number => {
  const before = /[A-Za-z0-9_]*$/.exec(line.slice(0, character))?.[0] ?? '';
  const after = /^[A-Za-z0-9_]*/.exec(line.slice(character))?.[0] ?? '';
  return before.length + after.length;
};
