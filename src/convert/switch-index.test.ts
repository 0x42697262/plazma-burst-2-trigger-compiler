import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMap } from './map-file.ts';
import { unprovenSwitches } from './switch-index.ts';

const trigger = (uid: string, ...actions: [number, string, string][]): string =>
  `<trigger uid="${uid}" enabled="true" maxcalls="-1" ${actions.map(([type, targetA, targetB], index) => `actions_${index + 1}_type="${type}" actions_${index + 1}_targetA="${targetA}" actions_${index + 1}_targetB="${targetB}"`).join(' ')} />`;
const unproven = (...elements: string[]): number => unprovenSwitches(parseMap(elements.join('\n'))).length;
const TARGETS = [trigger('#a', [42, 'a', '0']), trigger('#b', [42, 'b', '0'])];
const LIST = trigger('#list', [354, 'ids', '0'], [352, 'ids', '#a'], [352, 'ids', '#b']);

describe('action 362 that reads a trigger uid', () => {
  it('proves a variable set from a trigger uid right before the jump', () => {
    assert.equal(unproven(...TARGETS, trigger('#go', [100, 'next', '#a'], [362, 'next', '0'])), 0);
  });

  it('proves an element of a list of trigger uids, also when the variable holds text elsewhere', () => {
    const chooser = trigger('#choose', [125, 'pick', 'ids'], [350, 'pick', 'choice'], [362, 'pick', '0']);
    const text = trigger('#text', [100, 'pick', '-skin 2'], [123, 'pick', '-skin 2']);
    assert.equal(unproven(...TARGETS, LIST, chooser, text), 0);
  });

  it('does not prove a number, a uid that is not a trigger, an unknown uid or a skipped set', () => {
    assert.equal(unproven(...TARGETS, trigger('#go', [100, 'next', '1'], [362, 'next', '0'])), 1);
    assert.equal(unproven(...TARGETS, '<door uid="#d" />', trigger('#go', [100, 'next', '#d'], [362, 'next', '0'])), 1);
    assert.equal(unproven(...TARGETS, trigger('#go', [100, 'next', '#nothing'], [362, 'next', '0'])), 1);
    assert.equal(unproven(...TARGETS, trigger('#go', [100, 'next', '#a'], [123, 'x', '1'], [100, 'next', '#b'], [362, 'next', '0'])), 1);
    assert.equal(unproven(...TARGETS, trigger('#go', [100, 'next', '#a'], [42, 'gap', '0'], [362, 'next', '0'])), 1);
    assert.equal(unproven(...TARGETS, trigger('#go', [362, 'next', '0'])), 1);
  });

  it('does not prove a list that something else writes, or a single uid read as a list', () => {
    const chooser = trigger('#choose', [125, 'pick', 'ids'], [350, 'pick', 'choice'], [362, 'pick', '0']);
    assert.equal(unproven(...TARGETS, LIST, chooser, trigger('#spoil', [102, 'ids', '1'])), 1);
    assert.equal(unproven(...TARGETS, LIST, chooser, trigger('#spoil', [352, 'ids', 'text'])), 1);
    assert.equal(unproven(...TARGETS, trigger('#one', [100, 'ids', '#a']), chooser), 1);
    assert.equal(unproven(...TARGETS, trigger('#go', [100, 'next', '#a'], [350, 'next', '0'], [362, 'next', '0'])), 1);
  });

  it('does not prove anything in a map that stores into variables by a computed name', () => {
    assert.equal(unproven(...TARGETS, trigger('#go', [100, 'next', '#a'], [362, 'next', '0']), trigger('#store', [342, 'name', 'value'])), 1);
  });
});
