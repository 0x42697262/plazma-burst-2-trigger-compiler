import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from '../lang/compile.ts';
import { stagingPosition } from '../emit/xml-emitter.ts';
import { fit, hitTest, isMoved, itemsAtLine, sceneOf, snap, toScreen, toWorld, valuesText, withGeometry, zoomAt } from './blueprint-model.ts';

const SOURCE = [
  'map {',
  '  gate = Door("#gate", x: 100, y: -50, w: 200, h: 20);',
  '  for (let i = 0; i < 2; i += 1) { Player("#p{i}", x: i * 100, y: 0); }',
  '  Player("#left", x: 500, y: 0, side: Left);',
  '  Gun("#loose");',
  '  Wall(0, 300, 1000, 50);',
  '}',
].join('\n');

const sceneFor = (host: string | null = null) => {
  const result = compileSource(SOURCE, 't');
  return sceneOf(result.mapObjects, (index) => stagingPosition(index, result.program), host);
};

describe('blueprint model', () => {
  it('places rectangles by their size and points by the editor boxes, facing their side', () => {
    const { items, bounds } = sceneFor();
    const byId = new Map(items.map((item) => [item.id, item]));
    assert.deepEqual(byId.get('#gate')?.box, { x: 100, y: -50, w: 200, h: 20 });
    assert.deepEqual(byId.get('#p1')?.box, { x: 85, y: -82, w: 30, h: 82 });
    assert.deepEqual(byId.get('#left')?.box, { x: 485, y: -82, w: 30, h: 82 });
    assert.equal(byId.get('#gate')?.color, '#ffb347');
    assert.equal(byId.get('#p0')?.line, 3);
    assert.ok(byId.get('#loose')?.geometry.y !== undefined);
    assert.equal(items.find((item) => item.tag === 'box')?.id, 'box@6#0');
    assert.ok(bounds !== null && bounds.w >= 1000);
  });

  it('draws the host map behind and uses its values for objects it already has', () => {
    const host = '<door uid="#gate" x="0" y="0" w="50" h="50" maxspeed="10" />\n<box x="-500" y="-500" w="40" h="40" m="0" />\n<trigger uid="#t" x="9" y="9" enabled="true" maxcalls="1" />\n';
    const { items } = sceneFor(host);
    const gate = items.find((item) => item.id === '#gate');
    assert.deepEqual(gate?.box, { x: 100, y: -50, w: 200, h: 20 });
    assert.equal(gate?.host, false);
    const hosted = items.filter((item) => item.host).map((item) => item.tag);
    assert.deepEqual(hosted, ['box', 'trigger']);
    assert.ok(gate && items.findIndex((item) => item.host) < items.indexOf(gate));
  });

  it('hits program objects before the host map, and the smallest object first', () => {
    const { items } = sceneFor('<bg x="-1000" y="-1000" w="5000" h="5000" m="0" />\n');
    assert.equal(hitTest(items, { x: 150, y: -40 })?.id, '#gate');
    assert.equal(hitTest(items, { x: 100, y: -10 })?.id, '#p1');
    assert.equal(hitTest(items, { x: -900, y: -900 })?.tag, 'bg');
    assert.equal(hitTest(items, { x: 9000, y: 9000 }), null);
  });

  it('converts between screen and world, zooms around the pointer and fits the map', () => {
    const camera = { x: 100, y: 50, scale: 2 };
    assert.deepEqual(toWorld(camera, toScreen(camera, { x: 7, y: -3 })), { x: 7, y: -3 });
    const zoomed = zoomAt(camera, { x: 40, y: 20 }, 2);
    assert.deepEqual(toWorld(zoomed, { x: 40, y: 20 }), toWorld(camera, { x: 40, y: 20 }));
    const fitted = fit({ x: 0, y: 0, w: 1000, h: 500 }, 548, 548);
    assert.equal(fitted.scale, 0.5);
    assert.deepEqual(toScreen(fitted, { x: 500, y: 250 }), { x: 274, y: 274 });
  });

  it('keeps scratch moves apart from the source and writes their values', () => {
    const gate = sceneFor().items.find((item) => item.id === '#gate');
    assert.ok(gate);
    const moved = withGeometry(gate, { x: snap(123, false), y: snap(-47, false), w: 200, h: 20 });
    assert.deepEqual(moved.box, { x: 120, y: -50, w: 200, h: 20 });
    assert.equal(isMoved(moved), true);
    assert.equal(isMoved(gate), false);
    assert.equal(snap(123, true), 123);
    assert.equal(valuesText(moved.geometry), 'x: 120, y: -50, w: 200, h: 20');
    assert.equal(valuesText({ x: 5, y: 6, w: null, h: null }), 'x: 5, y: 6');
  });

  it('finds the objects one source line made', () => {
    const { items } = sceneFor();
    assert.deepEqual(itemsAtLine(items, '/work/main.ptc', 3, '/work/main.ptc').map((item) => item.id), ['#p0', '#p1']);
  });
});
