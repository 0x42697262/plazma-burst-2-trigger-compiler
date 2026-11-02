import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createNames, seededPrefix } from './names.ts';
import { PREFIX_PATTERN } from './keys.ts';

describe('seeded prefix', () => {
  it('is a valid, reproducible, source-independent prefix', () => {
    assert.match(seededPrefix('1'), PREFIX_PATTERN);
    assert.equal(seededPrefix('42'), seededPrefix('42'));
    assert.notEqual(seededPrefix('1'), seededPrefix('2'));
    assert.notEqual(seededPrefix('release-a'), seededPrefix('release-b'));
    assert.doesNotThrow(() => createNames(seededPrefix('anything')));
  });

  it('owns the names it makes under the seeded prefix', () => {
    const names = createNames(seededPrefix('7'));
    assert.ok(names.ownsVariable(names.variable('count')));
    assert.ok(names.ownsUid(names.triggerUid('start')));
    assert.ok(!names.ownsUid('#gate1'));
  });
});
