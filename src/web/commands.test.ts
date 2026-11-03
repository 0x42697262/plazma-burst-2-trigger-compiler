import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterCommands, optionChips, shortcutLabel } from './commands.ts';
import type { Command } from './commands.ts';

const command = (title: string): Command => ({ title, detail: '', shortcut: '', run: () => undefined });
const DEFAULTS = { prefix: '', guard: 100000, frames: 300, numberText: true, directIndex: false, target: 'triggers' as const, replace: false, nameSeed: '', obfuscate: false, obfuscateSeed: '' };

describe('web commands', () => {
  it('filters commands by words first, then by letters in order', () => {
    const commands = ['Build', 'Run in the simulator', 'Open build settings', 'Show XML'].map(command);
    assert.deepEqual(filterCommands(commands, 'build').map((entry) => entry.title), ['Build', 'Open build settings']);
    assert.deepEqual(filterCommands(commands, 'rits').map((entry) => entry.title), ['Run in the simulator']);
    assert.equal(filterCommands(commands, '').length, 4);
    assert.deepEqual(filterCommands(commands, 'zz'), []);
  });

  it('shows a chip for every setting that is not the default', () => {
    assert.deepEqual(optionChips(DEFAULTS, 0), []);
    assert.deepEqual(optionChips({ ...DEFAULTS, target: 'pcode', obfuscate: true, numberText: false, guard: 0, prefix: 'mine' }, 2),
      ['pcode', 'obfuscated', 'raw number text', 'prefix mine', 'no guard', 'env 2']);
  });

  it('writes shortcuts the way the system does', () => {
    assert.equal(shortcutLabel(['mod', 'shift', 'enter'], true), '⌘⇧↩');
    assert.equal(shortcutLabel(['mod', 'shift', 'enter'], false), 'Ctrl+Shift+Enter');
  });
});
