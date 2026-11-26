import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareSnapshots, encodeValue, encodeVariables } from './compare.ts';

describe('live-check comparison', () => {
  it('encodes values with their type', () => {
    assert.deepEqual(encodeValue(5), ['number', '5']);
    assert.deepEqual(encodeValue('5'), ['string', '5']);
    assert.deepEqual(encodeValue(NaN), ['number', 'NaN']);
    assert.deepEqual(encodeValue(['a', 1]), ['array', '["a","1"]']);
  });

  it('reports values that differ or are missing, only for owned names', () => {
    const simulated = encodeVariables({ '~a_x~': 1, '~a_y~': 'two', '~b_z~': 3 });
    const game = encodeVariables({ '~a_x~': '1', '~a_w~': 4, '~b_z~': 9 });
    const mismatches = compareSnapshots(simulated, game, (name) => name.startsWith('~a'));
    assert.deepEqual(mismatches.map((entry) => entry.name), ['~a_w~', '~a_x~', '~a_y~']);
  });
});
