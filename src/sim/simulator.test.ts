import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, StepLimitError } from './simulator.ts';
import { loadValue, replaceVariables } from './values.ts';
import { action, startTimer, trigger } from '../program/build.ts';
import type { Program } from '../program/types.ts';
import { HELLO, HELLO_EXPECTED } from '../samples/hello.fixture.ts';

const program = (...triggers: Program['triggers']): Program => ({ triggers, timers: [] });

describe('load-time values', () => {
  const registry = { uids: ['#a', '#b'], ids: [0, 7] };
  it('turns known uids into indexes and whole numbers into numbers', () => {
    assert.equal(loadValue('#b', registry), 7);
    assert.equal(loadValue('#missing', registry), '#missing');
    assert.equal(loadValue('42', registry), 42);
    assert.equal(loadValue('-3', registry), -3);
    assert.equal(loadValue('1.5', registry), '1.5');
    assert.equal(loadValue('007', registry), '007');
    assert.equal(loadValue('', registry), '');
  });
});

describe('variable replacement', () => {
  it('replaces longer names first', () => {
    assert.equal(replaceVariables('~ab~ ~a~', { '~a~': 1, '~ab~': 2 }), '2 1');
    assert.equal(replaceVariables('xay', { a: 'b', ab: 'c' }), 'xby');
  });
});

describe('simulator', () => {
  it('runs the hello sample like the game did', () => {
    const simulation = new Simulation(HELLO);
    simulation.tick();
    for (const [name, value] of Object.entries(HELLO_EXPECTED.variables)) assert.equal(simulation.variables[name], value);
    for (const name of HELLO_EXPECTED.missing) assert.equal(simulation.variables[name], undefined);
    assert.deepEqual(simulation.chat, [HELLO_EXPECTED.chat]);
  });

  it('concatenates when adding a variable to a string', () => {
    const simulation = new Simulation(program(trigger('#a', [action(100, 'x', '5.5'), action(100, 'y', '1'), action(104, 'x', 'y')])));
    simulation.run(0);
    assert.equal(simulation.variables.x, '5.51');
  });

  it('runs an unresolved uid in ExecTrigger as trigger 0', () => {
    const simulation = new Simulation(program(
      trigger('#first', [action(102, 'count', '1')]),
      trigger('#second', [action(100, 'count', '0'), action(99, '#nowhere')]),
    ));
    simulation.run(1);
    assert.equal(simulation.variables.count, 1);
  });

  it('drops a switch to an unknown uid with an error', () => {
    const simulation = new Simulation(program(trigger('#a', [action(363, '#nowhere'), action(100, 'x', '1')])));
    simulation.run(0);
    assert.equal(simulation.variables.x, undefined);
    assert.equal(simulation.errors.length, 1);
  });

  it('skips calls deeper than 2048 frames and keeps going', () => {
    const simulation = new Simulation(program(trigger('#r', [action(102, 'depth', '1'), action(99, '#r')])));
    simulation.variables.depth = 0;
    simulation.run(0);
    assert.equal(simulation.variables.depth, 2048);
    assert.equal(simulation.errors.length, 1);
  });

  it('does not start disabled triggers or triggers without calls left', () => {
    const simulation = new Simulation(program(
      { uid: '#off', enabled: false, maxCalls: -1, actions: [action(100, 'off', '1')] },
      { uid: '#once', enabled: true, maxCalls: 1, actions: [action(102, 'once', '1')] },
      trigger('#main', [action(100, 'once', '0'), action(99, '#off'), action(99, '#once'), action(99, '#once')]),
    ));
    simulation.run(2);
    assert.equal(simulation.variables.off, undefined);
    assert.equal(simulation.variables.once, 1);
  });

  it('stops a trigger when a continue-if fails', () => {
    const simulation = new Simulation(program(trigger('#a', [action(110, 'x', 'x'), action(100, 'after', '1')])));
    simulation.run(0);
    assert.equal(simulation.variables.after, undefined);
  });

  it('builds the active slot list as a string', () => {
    const simulation = new Simulation(program(trigger('#a', [action(508, 'slots')])), {
      players: [{ slot: 0, name: 'a', active: true }, { slot: 3, name: 'b', active: true }, { slot: 5, name: 'c', active: false }],
    });
    simulation.run(0);
    assert.equal(simulation.variables.slots, '03');
  });

  it('throws when the step limit is hit', () => {
    const simulation = new Simulation(program(trigger('#loop', [action(363, '#loop')])), { maxSteps: 100 });
    assert.throws(() => simulation.run(0), StepLimitError);
  });

  it('fires a start timer once', () => {
    const simulation = new Simulation({ triggers: [trigger('#a', [action(102, 'n', '1')])], timers: [startTimer('#go', '#a')] });
    simulation.variables.n = 0;
    simulation.tick(5);
    assert.equal(simulation.variables.n, 1);
  });

  it('runs the join trigger when a player joins', () => {
    const simulation = new Simulation(program(trigger('#setup', [action(228, '#joined')]), trigger('#joined', [action(102, 'joins', '1')])));
    simulation.variables.joins = 0;
    simulation.playerJoins();
    simulation.run(0);
    simulation.playerJoins();
    simulation.playerJoins();
    assert.equal(simulation.variables.joins, 2);
  });

  it('skips actions it does not simulate and records them', () => {
    const simulation = new Simulation(program(trigger('#a', [action(0, '1', '2'), action(100, 'after', '1')])));
    simulation.run(0);
    assert.deepEqual([...simulation.unsimulated], [0]);
    assert.equal(simulation.variables.after, 1);
  });

  it('sees XML-escaped text like the game, and shows < > " decoded', () => {
    const simulation = new Simulation(program(trigger('#a', [action(100, 'x', 'a<b & "c"'), action(42, 'say <"hi"> & bye', '0')])));
    simulation.run(0);
    assert.equal(simulation.variables.x, 'a&lt;b &amp; &quot;c&quot;');
    assert.deepEqual(simulation.chat, ['say <"hi"> &amp; bye']);
  });

  it('resolves uids with special characters like the game', () => {
    const simulation = new Simulation(program(trigger('#main', [action(99, '#b&c')]), trigger('#b&c', [action(100, 'called', '1')])));
    simulation.run(0);
    assert.equal(simulation.variables.called, 1);
  });

  it('reads a timer target without # as a trigger index', () => {
    const simulation = new Simulation({ triggers: [trigger('#a', []), trigger('#b', [action(100, 'hit', '1')])], timers: [{ uid: '#t', target: '1.7', enabled: true, maxCalls: 1, delay: 0 }] });
    simulation.tick();
    assert.equal(simulation.variables.hit, 1);
  });

  it('names players like the game: Empty for an inactive slot, and no active check by variable', () => {
    const players = [{ slot: 0, name: 'ann', active: true }, { slot: 1, name: 'old', active: false }];
    const simulation = new Simulation(program(trigger('#a', [
      action(185, 'inactive', '1'), action(100, 's', '1'), action(188, 'byVariable', 's'), action(100, 'bad', '0.0'), action(188, 'never', 'bad'),
    ])), { players });
    simulation.run(0);
    assert.equal(simulation.variables.inactive, 'Empty');
    assert.equal(simulation.variables.byVariable, 'old');
    assert.equal(simulation.variables.never, undefined);
    assert.equal(simulation.errors.length, 1);
  });
});
