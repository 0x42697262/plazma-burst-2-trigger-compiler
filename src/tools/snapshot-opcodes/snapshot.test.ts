import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readOpcodeTable, toSnapshot } from './snapshot.ts';
import type { EditorRules } from './snapshot.ts';

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

  it('keeps the parameter table, the mark pairs and the editor rules of each map element', () => {
    const table = readOpcodeTable(SAMPLE.replace('"actions": {', '"params": [{ "cls": "door", "name": "maxspeed", "kind": "value>=0", "title": "Speed", "desc": "Speed", "extra": 1 }],\n  "markPairs": { "sky": "sky_model" },\n  "actions": {'));
    assert.ok(table);
    const editor: EditorRules = {
      tags: ['door', 'inf'], shapeOf: (tag) => (tag === 'door' ? 'rect' : 'point'),
      defaults: { door: { maxspeed: '10' }, inf: { mark: 'hero1_guns', forteam: '0' } },
      gameOnly: { door: { mute: { kind: 'bool', title: 'Mute', desc: 'No sound', value: 'false' } } },
      noUid: new Set(['inf']), noPlace: new Set(),
    };
    const snapshot = toSnapshot(table, editor);
    assert.deepEqual(snapshot.params, [{ cls: 'door', name: 'maxspeed', kind: 'value>=0', title: 'Speed', desc: 'Speed' }]);
    assert.deepEqual(snapshot.markPairs, { sky: 'sky_model' });
    assert.deepEqual(snapshot.tags, {
      door: { uid: true, place: true, rect: true, defaults: { maxspeed: '10' }, gameOnly: { mute: { kind: 'bool', title: 'Mute', desc: 'No sound', value: 'false' } } },
      inf: { uid: false, place: true, rect: false, defaults: { mark: 'hero1_guns', forteam: '0' }, gameOnly: {} },
    });
  });
});
