import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readOpcodeTable, toSnapshot } from './snapshot.ts';

const SAMPLE = `globalThis.PB2_OPCODES = {
  "source": "lib_params.js", "fetched": "2026-11-01",
  "aliases": { "ExecTrigger": 99 },
  "actions": {
    "363": { "desc": "Switch", "a": "trigger", "b": "nochange" },
    "99": { "desc": "Execute", "a": "trigger", "b": "nochange", "alias": "ExecTrigger" },
    "-1": { "desc": "Nothing", "a": "nochange", "b": "nochange" }
  }
};`;

describe('snapshot-opcodes', () => {
  it('reads the table without touching the real global object', () => {
    const table = readOpcodeTable(SAMPLE);
    assert.equal(table?.source, 'lib_params.js');
    assert.equal(Reflect.get(globalThis, 'PB2_OPCODES'), undefined);
  });

  it('returns null when the file holds no table', () => {
    assert.equal(readOpcodeTable('var unrelated = 1;'), null);
  });

  it('keeps only actions, with alias first and no empty alias', () => {
    const table = readOpcodeTable(SAMPLE);
    assert.ok(table);
    assert.deepEqual(toSnapshot(table), {
      source: 'lib_params.js',
      fetched: '2026-11-01',
      actions: {
        '-1': { a: 'nochange', b: 'nochange', desc: 'Nothing' },
        99: { alias: 'ExecTrigger', a: 'trigger', b: 'nochange', desc: 'Execute' },
        363: { a: 'trigger', b: 'nochange', desc: 'Switch' },
      },
      values: {},
    });
  });
});
