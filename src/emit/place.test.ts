import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapTriggers, placeObjects, regionsOf } from './place.ts';
import type { MapObject } from '../objects/types.ts';

const STAGING = (index: number): { x: number; y: number } => ({ x: index * 60, y: 600 });
const object = (fields: Partial<MapObject>): MapObject => ({ constructorName: 'Door', tag: 'door', uid: null, mark: null, set: [], initial: [], actions: null, line: 1, ...fields });

describe('map object placement', () => {
  it('creates elements with the editor defaults, staging the ones without a position', () => {
    const placement = placeObjects([
      object({ uid: '#d', set: [['maxspeed', '50']], initial: [['x', '5']] }),
      object({ constructorName: 'Light', tag: 'lamp', uid: '#l', set: [['x', '1'], ['y', '2'], ['flare', 'false']] }),
    ], { host: null, staging: STAGING, previousWalls: [], replacing: false });
    assert.equal(placement.xml, [
      '<door uid="#d" x="5" y="600" w="10" h="10" moving="false" tarx="0" tary="0" maxspeed="50" vis="true" attach="-1" />',
      '<lamp uid="#l" x="1" y="2" power="0.4" flare="false" />', '',
    ].join('\n'));
  });

  it('lists the walls of a build without a map, so a later --replace can remove them', () => {
    const placement = placeObjects([
      object({ uid: '#d', set: [['x', '0'], ['y', '0']] }),
      object({ constructorName: 'Wall', tag: 'box', set: [['x', '5'], ['y', '5'], ['w', '20'], ['h', '20']] }),
      object({ constructorName: 'EngineMark', tag: 'inf', mark: 'sky', set: [['mark', 'sky'], ['forteam', '4']] }),
    ], { host: null, staging: STAGING, previousWalls: [], replacing: false });
    assert.deepEqual(placement.walls, ['<box x="5" y="5" w="20" h="20" m="0" />']);
  });

  it('rewrites only what the code sets, keeping the other attributes and their order', () => {
    const host = '<door uid="#d" x="9" maxspeed="10" vis="true" foo="bar" />\n<inf mark="sky" forteam="4" />\n';
    const placement = placeObjects([
      object({ uid: '#d', set: [['maxspeed', 'a<b'], ['mute', 'true']], initial: [['x', '0']] }),
      object({ constructorName: 'EngineMark', tag: 'inf', mark: 'sky', set: [['mark', 'sky'], ['forteam', '4']] }),
    ], { host, staging: STAGING, previousWalls: [], replacing: false });
    assert.equal(placement.host, '<door uid="#d" x="9" maxspeed="a&lt;b" vis="true" foo="bar" mute="true" />\n<inf mark="sky" forteam="4" />\n');
    assert.deepEqual(placement.notes, ['#d: maxspeed 10 → a&lt;b, mute (unset) → true']);
    assert.equal(placement.xml, '');
  });

  it('refuses several marks of one kind and replaces recorded walls', () => {
    const host = '<inf mark="sky" forteam="4" />\n<inf mark="sky" forteam="5" />\n<box x="0" y="0" w="10" h="10" m="0" />\n';
    const marks = placeObjects([object({ constructorName: 'EngineMark', tag: 'inf', mark: 'sky', set: [['mark', 'sky']] })], { host, staging: STAGING, previousWalls: [], replacing: false });
    assert.match(marks.problems.join('\n'), /engine mark sky 2 times/);
    const wall = object({ constructorName: 'Wall', tag: 'box', set: [['x', '0'], ['y', '0'], ['w', '10'], ['h', '10']] });
    const placement = placeObjects([wall], { host, staging: STAGING, previousWalls: ['<box x="0" y="0" w="10" h="10" m="0" />'], replacing: true });
    assert.equal(placement.host, '<inf mark="sky" forteam="4" />\n<inf mark="sky" forteam="5" />\n');
    assert.deepEqual(placement.walls, ['<box x="0" y="0" w="10" h="10" m="0" />']);
  });

  it('replaces every image with the same custom id even when the element text differs', () => {
    const host = [
      '<door uid="#d" x="0" y="0" />',
      '<image uid="#old" width="50" id="7" height="80" />',
      '<image id="7" width="100" height="100" />',
      '<image id="9" width="1" height="1" />',
      '',
    ].join('\n');
    const image = object({ constructorName: 'Image', tag: 'image', set: [['id', '7'], ['width', '40']] });
    const kept = placeObjects([image], { host, staging: STAGING, previousWalls: [], replacing: false });
    assert.equal(kept.host, host);
    const placement = placeObjects([image], { host, staging: STAGING, previousWalls: ['<image id="7" width="10" height="10" />'], replacing: true });
    assert.equal(placement.host, '<door uid="#d" x="0" y="0" />\n<image id="9" width="1" height="1" />\n');
    assert.deepEqual(placement.walls, ['<image id="7" width="40" height="100" />']);
    assert.equal(placement.xml, '<image id="7" width="40" height="100" />\n');
  });

  it('stages each added object once in a --replace build, and a second build changes nothing', () => {
    const staged = [object({ uid: '#d' }), object({ constructorName: 'Wall', tag: 'box', set: [['w', '20'], ['h', '20']] })];
    const first = placeObjects(staged, { host: '<lamp uid="#l" x="0" y="0" />\n', staging: STAGING, previousWalls: [], replacing: true });
    assert.match(first.xml, /<door uid="#d" x="0" y="600"/);
    assert.match(first.xml, /<box x="60" y="600" w="20" h="20"/);
    const placed = [object({ uid: '#d' }), object({ constructorName: 'Wall', tag: 'box', set: [['x', '5'], ['y', '5'], ['w', '20'], ['h', '20']] })];
    const built = placeObjects(placed, { host: '<lamp uid="#l" x="0" y="0" />\n', staging: STAGING, previousWalls: [], replacing: true });
    const host = (built.host ?? '') + built.xml;
    const again = placeObjects(placed, { host, staging: STAGING, previousWalls: built.walls, replacing: true });
    assert.equal((again.host ?? '') + again.xml, host);
  });

  it('replaces walls and backgrounds with the same rectangle when the element text differs', () => {
    const host = [
      '<box uid="#old" m="0" h="10" w="200" y="0" x="-1000" />',
      '<box x="5" y="5" w="10" h="10" m="0" />',
      '<bg h="1200" w="2000" y="-1000" x="-1000" m="9" c="" a="-1" u="0" v="0" f="0" s="true" />',
      '<door uid="#d" x="0" y="0" />',
      '',
    ].join('\n');
    const wall = object({ constructorName: 'Wall', tag: 'box', set: [['x', '-1000'], ['y', '0'], ['w', '200'], ['h', '10']] });
    const background = object({ constructorName: 'Background', tag: 'bg', set: [['x', '-1000'], ['y', '-1000'], ['w', '2000'], ['h', '1200']] });
    const kept = placeObjects([wall, background], { host, staging: STAGING, previousWalls: [], replacing: false });
    assert.equal(kept.host, host);
    const placement = placeObjects([wall, background], { host, staging: STAGING, previousWalls: [], replacing: true });
    assert.equal(placement.host, '<box x="5" y="5" w="10" h="10" m="0" />\n<door uid="#d" x="0" y="0" />\n');
    assert.deepEqual(placement.walls, [
      '<box x="-1000" y="0" w="200" h="10" m="0" />',
      '<bg x="-1000" y="-1000" w="2000" h="1200" m="0" c="" a="-1" u="0" v="0" f="0" s="true" />',
    ]);
  });

  it('writes trigger actions, replaces them in place, and keeps them when the code gives none', () => {
    const actions = [{ opcode: 102, targetA: '~n~', targetB: '1' }, { opcode: 99, targetA: '#f', targetB: '0' }];
    const created = placeObjects([object({ constructorName: 'Trigger', tag: 'trigger', uid: '#t', set: [['x', '0'], ['y', '0'], ['maxcalls', '-1']], actions })], {
      host: null, staging: STAGING, previousWalls: [], replacing: false,
    });
    assert.equal(created.xml, '<trigger uid="#t" x="0" y="0" enabled="true" maxcalls="-1" actions_1_type="102" actions_1_targetA="~n~" actions_1_targetB="1" actions_2_type="99" actions_2_targetA="#f" actions_2_targetB="0" />\n');
    const host = '<trigger uid="#t" x="5" y="5" enabled="true" maxcalls="1" actions_1_type="100" actions_1_targetA="a" actions_1_targetB="b" />\n';
    const replaced = placeObjects([object({ constructorName: 'Trigger', tag: 'trigger', uid: '#t', set: [['maxcalls', '-1']], actions })], { host, staging: STAGING, previousWalls: [], replacing: false });
    assert.equal(replaced.host, '<trigger uid="#t" x="5" y="5" enabled="true" maxcalls="-1" actions_1_type="102" actions_1_targetA="~n~" actions_1_targetB="1" actions_2_type="99" actions_2_targetA="#f" actions_2_targetB="0" />\n');
    assert.deepEqual(replaced.notes, ['#t: maxcalls 1 → -1, actions rewritten (1 → 2)']);
    const kept = placeObjects([object({ constructorName: 'Trigger', tag: 'trigger', uid: '#t', set: [] })], { host, staging: STAGING, previousWalls: [], replacing: false });
    assert.equal(kept.host, host);
    assert.deepEqual(mapTriggers([object({ constructorName: 'Timer', tag: 'timer', uid: '#k', set: [['target', '#t']] })]).timers, [{ uid: '#k', target: '#t', enabled: true, maxCalls: 1, delay: 30 }]);
  });

  it('gives the simulator the rectangles of created regions', () => {
    assert.deepEqual(regionsOf([object({ constructorName: 'Region', tag: 'region', uid: '#r', set: [['x', '1'], ['y', '2'], ['w', '30']] })]), { '#r': { x: 1, y: 2, w: 30, h: 10 } });
  });
});
