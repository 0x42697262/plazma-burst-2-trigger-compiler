import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import { checkObjects, objectElement } from '../objects/objects.ts';

const actions = (source: string) => compileSource(source, 't').program.triggers.flatMap((trigger) => trigger.actions);

describe('map object declarations', () => {
  it('passes a declared object as its uid, for every kind', () => {
    const source = `
water pool = "#water*1";
region spawn = "#SPAWN1" at 100, -200;
door gate = "#door*3";
player hero = "#player*0";
character guard = "#enemy*1";
gun rifle = "#gun*2";
trigger hostTrigger = "#trigger*9";
timer clock = "#timer*1";
light lamp = "#light*1";
on start {
  action(395, pool, 10);
  action(MovableTo, gate, spawn);
  action(SetCharHP, hero, 200);
  action(SetCharHP, guard, 50);
  action(SetGunPower, rifle, 3);
  action(ExecTrigger, hostTrigger);
  action(TimerEnable, clock);
  action(LightOn, lamp);
}`;
    const result = compileSource(source, 't');
    assert.deepEqual(result.warnings, []);
    const used = result.program.triggers.flatMap((trigger) => trigger.actions).filter((action) => action.opcode !== 100);
    assert.deepEqual(used.map((action) => [action.opcode, action.targetA, action.targetB]), [
      [395, '#water*1', '10'], [0, '#door*3', '#SPAWN1'], [23, '#player*0', '200'], [23, '#enemy*1', '50'], [64, '#gun*2', '3'], [99, '#trigger*9', '0'], [25, '#timer*1', '0'], [54, '#light*1', '0'],
    ]);
    assert.deepEqual(result.objects.find((object) => object.name === 'spawn'), { keyword: 'region', name: 'spawn', uid: '#SPAWN1', x: 100, y: -200 });
  });

  it('refuses an object of the wrong kind, like a strict cast', () => {
    assert.throws(() => actions('water pool = "#water*1";\nregion spawn = "#S";\non start { action(MovableTo, pool, spawn); }'),
      /line 3: action 0 takes door as A, but "pool" is a water/);
    assert.throws(() => actions('region spawn = "#S";\non start { action(395, spawn, 10); }'), /action 395 takes water as A, but "spawn" is a region/);
  });

  it('refuses a variable where an object is expected, and an object where a value is', () => {
    assert.throws(() => actions('var where = "#door*1";\non start { action(MovableTo, where, "#r"); }'), /action 0 takes door as A: give a declared object/);
    assert.throws(() => actions('door gate = "#door*1";\non start { action(VarSetValue, gate, 1); }'), /action 100 takes string as A, but "gate" is a door/);
    assert.throws(() => actions('door gate = "#door*1";\nvar x = 0;\non start { x = gate; }'), /"gate" is a map object/);
    assert.throws(() => actions('function f() {}\non start { action(MovableTo, @f, "#r"); }'), /takes door as A, not a function's trigger/);
  });

  it('keeps player slots and other characters apart in the map', () => {
    const result = compileSource('player hero = "#player*1";\ncharacter guard = "#enemy*1";\non start { action(SetCharHP, hero, 1); action(SetCharHP, guard, 1); }', 't');
    const spawned = checkObjects(result.objects, '<player x="0" y="0" />\n');
    assert.deepEqual(spawned.missing.map((object) => objectElement(object, { x: 0, y: 0 }, (value) => value).split(' ')[0]), ['<player', '<enemy']);
    const swapped = checkObjects(result.objects, '<enemy uid="#player*1" x="0" y="0" />\n<player uid="#enemy*1" x="0" y="0" />\n');
    assert.match(swapped.problems.join('\n'), /"hero" is declared as player, but #player\*1 in the map is a <enemy>\. Declare it as character\./);
    assert.match(swapped.problems.join('\n'), /"guard" is declared as character, but #enemy\*1 in the map is a <player>\. Declare it as player\./);
    assert.ok(actions('on start { for player p { say("{p}"); } }'));
  });

  it('still accepts uid text, and keeps the kind words usable as names', () => {
    assert.equal(actions('on start { action(MovableTo, "#door*1", "#r"); }')[1]?.targetA, '#door*1');
    assert.ok(actions('var water = 1;\nvar region = water + 1;'));
    assert.throws(() => actions('water pool = "water*1";'), /must start with #/);
  });
});
