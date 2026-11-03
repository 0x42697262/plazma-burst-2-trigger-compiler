import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterCommands, optionChips, shortcutLabel } from './commands.ts';
import type { Command } from './commands.ts';

const command = (title: string): Command => ({ title, detail: '', shortcut: '', run: () => undefined });
const DEFAULTS = { prefix: '', guard: 100000, frames: 300, numberText: true, directIndex: false, target: 'triggers' as const, replace: false, nameSeed: '', obfuscate: false, obfuscateSeed: '', tamper: 'off' as const, tamperSeed: '', tamperAnnounce: false };

describe('web commands', () => {
  it('filters commands by words first, then by letters in order', () => {
    const commands = ['Build', 'Run in the simulator', 'Open build settings', 'Show XML'].map(command);
    assert.deepEqual(filterCommands(commands, 'build').map((entry) => entry.title), ['Build', 'Open build settings']);
    assert.deepEqual(filterCommands(commands, 'rits').map((entry) => entry.title), ['Run in the simulator']);
    assert.equal(filterCommands(commands, '').length, 4);
    assert.deepEqual(filterCommands(commands, 'zz'), []);
    const examples = ['Open example: live/lang-math.ptc', 'Open example: syntax/07-map-objects.ptc'].map(command);
    assert.deepEqual(filterCommands(examples, 'Open example: map').map((entry) => entry.title), ['Open example: syntax/07-map-objects.ptc']);
  });

  it('shows a chip for every setting that is not the default', () => {
    assert.deepEqual(optionChips(DEFAULTS, 0), []);
    const chips = optionChips({ ...DEFAULTS, target: 'pcode', obfuscate: true, tamper: 'report', numberText: false, guard: 0, prefix: 'mine' }, 2);
    assert.deepEqual(chips.map((chip) => chip.label), ['pcode', 'obfuscated', 'tamper report', 'raw number text', 'prefix mine', 'no guard', 'env 2']);
    assert.deepEqual(chips.map((chip) => chip.setting), ['target', 'obfuscate', 'tamper-check', 'number-text', 'prefix', 'guard', 'environment']);
  });

  it('shows the announce chip only with enforce', () => {
    assert.deepEqual(optionChips({ ...DEFAULTS, tamper: 'report', tamperAnnounce: true }, 0).map((chip) => chip.label), ['tamper report']);
    assert.deepEqual(optionChips({ ...DEFAULTS, tamper: 'enforce', tamperAnnounce: true }, 0).map((chip) => chip.setting), ['tamper-check', 'tamper-announce']);
  });

  it('writes shortcuts the way the system does', () => {
    assert.equal(shortcutLabel(['mod', 'shift', 'enter'], true), '⌘⇧↩');
    assert.equal(shortcutLabel(['mod', 'shift', 'enter'], false), 'Ctrl+Shift+Enter');
  });
});
