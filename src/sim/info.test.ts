import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, newSession } from './simulator.ts';
import type { SimulationOptions } from './simulator.ts';
import { action, trigger } from '../program/build.ts';
import type { Action } from '../program/types.ts';

const PLAYERS = [
  { slot: 0, name: 'Ann', login: 'ann', active: true, hitpoints: 80, x: 10, y: 10 },
  { slot: 1, name: 'Bob', login: 'bob', active: true, dying: true, hitpoints: 0, x: 20, y: 20 },
  { slot: 2, name: 'Cy', login: 'cy', active: true, x: 500, y: 500 },
];

const run = (actions: Action[], options: Partial<SimulationOptions> = {}) => {
  const simulation = new Simulation({ triggers: [trigger('#t', actions)], timers: [] }, { players: PLAYERS, ...options });
  simulation.run(0);
  return simulation;
};

describe('player information actions', () => {
  it('reads the initiator, the killer and their state', () => {
    const { variables } = run([
      action(146, 'initLogin'), action(147, 'initName'), action(181, 'killer'), action(182, 'killerLogin'), action(183, 'killerName'),
      action(315, 'initDying'), action(316, 'killerDying'), action(314, 'bobDying', '1'), action(100, 'slot', '0'), action(544, 'annDying', 'slot'),
      action(122, 'annHitpoints', '0'),
    ], { initiatorSlot: 0, killerSlot: 1 });
    assert.deepEqual(
      [variables.initLogin, variables.initName, variables.killer, variables.killerLogin, variables.killerName, variables.initDying, variables.killerDying, variables.bobDying, variables.annDying, variables.annHitpoints],
      ['ann', 'Ann', 1, 'bob', 'Bob', 0, 1, 1, 0, 80],
    );
  });

  it('gives the game texts when nobody is there', () => {
    const { variables } = run([action(181, 'killer'), action(182, 'login'), action(183, 'name'), action(316, 'dying'), action(157, 'talker')]);
    assert.deepEqual([variables.killer, variables.login, variables.name, variables.dying, variables.talker], [-1, '.nobody', 'Empty', 0, '.nobody']);
  });
});

describe('match information actions', () => {
  it('reads the match settings from the options', () => {
    const options = { multiplayer: true, spectator: true, lowPhysics: true, matchName: 'Arena', matchMode: 3, mapId: 'castle', gameplayModifications: 'x2', chatStatus: 2, frameRate: 60 };
    const { variables } = run([
      action(138, 'mp'), action(139, 'spectator'), action(140, 'low'), action(148, 'match'), action(177, 'mode'), action(436, 'map'), action(331, 'mods'),
      action(463, 'chat'), action(510, 'fps'), action(155, 'frame'),
    ], options);
    assert.deepEqual(
      [variables.mp, variables.spectator, variables.low, variables.match, variables.mode, variables.map, variables.mods, variables.chat, variables.fps, variables.frame],
      [1, 1, 1, 'Arena', 3, 'castle', 'x2', 2, 60, 1],
    );
    assert.equal(run([action(177, 'mode')], { matchMode: 3 }).variables.mode, 0);
  });

  it('keeps the AI difficulty that 174 sets', () => {
    const { variables } = run([action(266, 'before'), action(174, '1'), action(266, 'easy'), action(174, '9'), action(266, 'hard')]);
    assert.deepEqual([variables.before, variables.easy, variables.hard], [2, 1, 3]);
  });
});

describe('math and comparison actions', () => {
  it('computes trigonometry, 1 - A and random whole numbers like the game', () => {
    const { variables } = run([
      action(100, 'zero', '0'), action(100, 'one', '1'), action(135, 'sin', 'zero'), action(136, 'cos', 'zero'), action(204, 'asin', 'one'),
      action(205, 'acos', 'one'), action(100, 'angle', '1'), action(206, 'angle', 'one'), action(100, 'flip', '3'), action(153, 'flip'),
      action(100, 'range', '2'), action(328, 'random', 'range'),
    ]);
    assert.deepEqual([variables.sin, variables.cos, variables.asin, variables.acos, variables.angle, variables.flip, variables.random], [0, 1, Math.PI / 2, 0, Math.PI / 4, -2, 0]);
  });

  it('continues only while a condition holds', () => {
    const check = (opcode: number, left: string, right: string): boolean => run([action(100, 'a', left), action(100, 'b', right), action(opcode, 'a', 'b'), action(100, 'went', '1')]).variables.went === 1;
    const checkValue = (opcode: number, left: string, right: string): boolean => run([action(100, 'a', left), action(opcode, 'a', right), action(100, 'went', '1')]).variables.went === 1;
    assert.deepEqual([check(111, '1', '2'), check(111, '2', '1'), check(112, '5', '5'), check(112, '5', 'x'), check(113, '5', 'x'), check(113, '5', '5')], [true, false, true, false, true, false]);
    assert.deepEqual([checkValue(114, '3', '2'), checkValue(114, '2', '3'), checkValue(116, '5', '5'), checkValue(116, '007', '7'), checkValue(117, '5', '6'), checkValue(117, '5', '5')], [true, false, true, false, true, false]);
  });

  it('turns year, month and day into milliseconds', () => {
    const { variables } = run([action(100, 'day', '2024, 0, 2'), action(394, 'ms', 'day'), action(393, 'now')]);
    assert.equal(variables.ms, new Date(2024, 0, 2).getTime());
    assert.equal(typeof variables.now, 'number');
  });
});

describe('session variables', () => {
  it('keep values between maps and know which map set them', () => {
    const session = newSession();
    run([action(100, 'score', '42'), action(162, 'saved', 'score')], { session, mapId: 'first' });
    const next = run([action(163, 'saved', 'loaded'), action(230, 'saved', 'zero,FIRST'), action(100, 'trusted', '1')], { session, mapId: 'second' });
    assert.deepEqual([next.variables.loaded, next.variables.trusted], [42, 1]);
    assert.equal(run([action(230, 'saved', 'other,list'), action(100, 'trusted', '1')], { session }).variables.trusted, undefined);
    assert.match(run([action(230, 'saved', '5')], { session }).errors[0] ?? '', /toLowerCase/);
    run([action(161)], { session });
    assert.deepEqual(session, { values: {}, maps: {} });
  });
});

describe('region actions', () => {
  it('reads and moves regions and counts the living players inside', () => {
    const regions = { '#zone': { x: 0, y: 0, w: 100, h: 100 } };
    const { variables } = run([
      action(118, 'x', '#zone'), action(145, 'alive', '#zone'), action(100, 'far', '450'), action(120, '#zone', 'far'), action(121, '#zone', 'far'),
      action(119, 'y', '#zone'), action(145, 'moved', '#zone'),
    ], { regions });
    assert.deepEqual([variables.x, variables.alive, variables.y, variables.moved], [0, 1, 450, 1]);
    assert.deepEqual(regions['#zone'], { x: 0, y: 0, w: 100, h: 100 });
  });
});
