import { OPCODES } from '../../opcodes/table.ts';
import type { Opcode } from '../../opcodes/table.ts';
import { SKIPS_NEXT, SYNC_ACTIONS } from '../../opcodes/constants.ts';
import { SIMULATED_ACTIONS } from '../../sim/actions.ts';
import { CATEGORY_SEPARATOR, CELL_PIPE, ESCAPED_PIPE, LINE_END, NOTE_SEPARATOR, OP_PREFIX, UNCATEGORIZED } from './keys.ts';
import { TEXT } from './text.ts';

const cell = (text: string): string => text.replace(CELL_PIPE, ESCAPED_PIPE);

const categoryOf = (opcode: Opcode): string => {
  const at = opcode.description.indexOf(CATEGORY_SEPARATOR);
  return at < 0 ? UNCATEGORIZED : opcode.description.slice(0, at);
};

const descriptionOf = (opcode: Opcode): string => {
  const at = opcode.description.indexOf(CATEGORY_SEPARATOR);
  return at < 0 ? opcode.description : opcode.description.slice(at + CATEGORY_SEPARATOR.length);
};

const notesOf = (opcode: Opcode): string => [
  SIMULATED_ACTIONS.has(opcode.number) ? TEXT.notes.simulated : null,
  SKIPS_NEXT.has(opcode.number) ? TEXT.notes.skips : null,
  opcode.templateReplacedA ? TEXT.notes.replacesA : null,
  opcode.templateReplacedB ? TEXT.notes.replacesB : null,
  opcode.avoided ? TEXT.notes.avoided : null,
  SYNC_ACTIONS.has(opcode.number) ? TEXT.notes.sync : null,
].filter((note) => note !== null).join(NOTE_SEPARATOR);

export function renderActions(): string {
  const all = [...OPCODES.values()].sort((first, second) => first.number - second.number);
  const kinds = [...new Set(all.flatMap((opcode) => [opcode.paramA, opcode.paramB]))].sort();
  const categories = new Map<string, Opcode[]>();
  for (const opcode of all) categories.set(categoryOf(opcode), [...(categories.get(categoryOf(opcode)) ?? []), opcode]);
  const lines = [TEXT.title, '', TEXT.intro];
  for (const kind of kinds) lines.push(TEXT.kindRow(kind, TEXT.kinds[kind] ?? cell(kind)));
  for (const [category, opcodes] of [...categories.entries()].sort(([first], [second]) => first.localeCompare(second))) {
    lines.push('', TEXT.category(category, opcodes.length), '', TEXT.tableHead);
    for (const opcode of opcodes) {
      lines.push(TEXT.row(
        opcode.number, cell(opcode.alias ?? `${OP_PREFIX}${opcode.number}`), cell(opcode.paramA), cell(opcode.paramB), cell(descriptionOf(opcode)), notesOf(opcode),
      ));
    }
  }
  return lines.join(LINE_END) + LINE_END;
}
