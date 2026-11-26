import { OPCODES } from '../../opcodes/table.ts';
import type { Opcode } from '../../opcodes/table.ts';
import { VALUE_GROUP_LIST } from '../../opcodes/values.ts';
import { CELL_PIPE, ESCAPED_PIPE, LINE_END, NOTE_SEPARATOR, OP_PREFIX } from './keys.ts';
import { actionNotes, categoryOf, descriptionOf } from '../../reference/reference.ts';
import { REFERENCE_TEXT } from '../../reference/text.ts';
import { TEXT } from './text.ts';

const cell = (text: string): string => text.replace(CELL_PIPE, ESCAPED_PIPE);

export function renderActions(): string {
  const all = [...OPCODES.values()].sort((first, second) => first.number - second.number);
  const kinds = [...new Set(all.flatMap((opcode) => [opcode.paramA, opcode.paramB]))].sort();
  const categories = new Map<string, Opcode[]>();
  for (const opcode of all) categories.set(categoryOf(opcode), [...(categories.get(categoryOf(opcode)) ?? []), opcode]);
  const lines = [TEXT.title, '', TEXT.intro];
  for (const kind of kinds) lines.push(TEXT.kindRow(kind, REFERENCE_TEXT.kinds[kind] ?? cell(kind)));
  for (const [category, opcodes] of [...categories.entries()].sort(([first], [second]) => first.localeCompare(second))) {
    lines.push('', TEXT.category(category, opcodes.length), '', TEXT.tableHead);
    for (const opcode of opcodes) {
      lines.push(TEXT.row(
        opcode.number, cell(opcode.alias ?? `${OP_PREFIX}${opcode.number}`), cell(opcode.paramA), cell(opcode.paramB), cell(descriptionOf(opcode)), actionNotes(opcode).join(NOTE_SEPARATOR),
      ));
    }
  }
  lines.push('', TEXT.valuesTitle);
  for (const group of VALUE_GROUP_LIST) {
    lines.push('', TEXT.valueGroup(group.name, group.paramKind, group.entries.length), '', TEXT.valueHead);
    for (const entry of group.entries) lines.push(TEXT.valueRow(entry.names, cell(entry.value), cell(entry.label)));
  }
  return lines.join(LINE_END) + LINE_END;
}
