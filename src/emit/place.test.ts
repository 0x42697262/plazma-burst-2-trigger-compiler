import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { placeObjects, regionsOf } from './place.ts';
import type { MapObject } from '../objects/types.ts';

const STAGING = (index: number): { x: number; y: number } => ({ x: index * 60, y: 600 });
const object = (fields: Partial<MapObject>): MapObject => ({ constructorName: 'Door', tag: 'door', uid: null, mark: null, set: [], initial: [], line: 1, ...fields });

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

  it('gives the simulator the rectangles of created regions', () => {
    assert.deepEqual(regionsOf([object({ constructorName: 'Region', tag: 'region', uid: '#r', set: [['x', '1'], ['y', '2'], ['w', '30']] })]), { '#r': { x: 1, y: 2, w: 30, h: 10 } });
  });
});
