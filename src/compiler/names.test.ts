import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompileError, createNames, describeLegend, seededPrefix } from './names.ts';
import { PREFIX_PATTERN, TOKEN_SPACE } from './keys.ts';

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

describe('shortened names', () => {
  it('makes short, stable, letter-only stems that differ per seed', () => {
    const names = createNames('p', { seed: 's' });
    const count = names.variable('count');
    assert.match(count, /^~p_[a-z]{2,}~$/);
    assert.equal(names.variable('count'), count);
    assert.notEqual(names.variable('total'), count);
    assert.notEqual(createNames('p', { seed: 'other' }).variable('count'), count);
    assert.match(names.triggerUid(':start'), /^#p:[a-z]{2,}$/);
    assert.match(names.triggerUid('jump'), /^#p_[a-z]{2,}$/);
    assert.ok(names.ownsVariable(count) && names.ownsUid(names.triggerUid(':start')));
  });

  it('keeps marked stems and refuses to keep one already shortened', () => {
    const names = createNames('p', { seed: 's' });
    names.keep(TOKEN_SPACE.user, 'score');
    names.keep(TOKEN_SPACE.userUid, 'award');
    assert.equal(names.variable('score'), '~p_score~');
    assert.equal(names.triggerUid('award'), '#p_award');
    names.variable('other');
    assert.throws(() => names.keep(TOKEN_SPACE.user, 'other'), CompileError);
  });

  it('reveals shortened names, elements and uids', () => {
    const names = createNames('p', { seed: 's' });
    const element = `${names.variable('list').slice(0, -1)}[3]~`;
    assert.equal(names.reveal(names.variable('count')), '~p_count~');
    assert.equal(names.reveal(element), '~p_list[3]~');
    assert.equal(names.reveal(names.internalVariable('stack')), '~p:stack~');
    assert.equal(names.reveal(names.triggerUid(':start')), '#p:start');
    assert.equal(names.reveal('~host~'), '~host~');
    const described = describeLegend('p', names.legend());
    assert.ok(described.some((entry) => entry.source === '~p_count' && entry.game === names.variable('count').slice(0, -1)));
    assert.ok(described.some((entry) => entry.source === '#p:start'));
  });

  it('leaves names as they are without a seed', () => {
    const names = createNames('p');
    assert.equal(names.variable('count'), '~p_count~');
    assert.equal(names.reveal('~p_count~'), '~p_count~');
    assert.deepEqual(names.legend(), []);
  });
});
