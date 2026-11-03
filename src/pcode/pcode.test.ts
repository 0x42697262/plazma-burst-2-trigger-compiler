import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { frontEndFor } from '../cli/frontends.ts';
import { prefixFromFile } from '../cli/main.ts';
import { compileSource } from '../lang/compile.ts';
import { Simulation } from '../sim/simulator.ts';
import type { Region } from '../sim/simulator.ts';
import { regionsOf, withMapTriggers } from '../emit/place.ts';
import type { CompileOptions } from '../compiler/compile.ts';
import type { Program } from '../program/types.ts';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', 'examples');
const FOLDERS = ['live', 'tutorial', 'syntax'];
const PLAYERS = [{ slot: 0, name: 'ann', active: true, team: 1 }, { slot: 1, name: 'bob', active: true, team: 2 }];
const FRAMES = 60;
const MAX_STEPS = 50_000_000;
const SMALL_GUARD = 500;
const MACHINE_VARIABLE = /^~[A-Za-z0-9]+:(vm\.|left~|right~|stop~)/;

const simulate = (program: Program, frames = FRAMES, regions: Readonly<Record<string, Region>> = {}) => {
  const simulation = new Simulation(program, { players: PLAYERS, maxSteps: MAX_STEPS, regions });
  simulation.tick();
  simulation.playerSays(0, '-help');
  simulation.playerJoins();
  simulation.tick(frames);
  const variables = Object.fromEntries(Object.entries(simulation.variables).filter(([name]) => !MACHINE_VARIABLE.test(name)));
  return { chat: simulation.chat, errors: simulation.errors, variables, steps: simulation.actionCount };
};

const run = (source: string, options: Partial<CompileOptions> = {}) => {
  const result = compileSource(source, 't', { target: 'pcode', ...options });
  return { result, ...simulate(result.program) };
};

describe('p-code target', () => {
  for (const folder of FOLDERS) {
    for (const file of fs.readdirSync(path.join(EXAMPLES, folder)).filter((name) => /\.(ptc|pasm)$/.test(name)).sort()) {
      it(`runs ${folder}/${file} like the trigger target`, () => {
        const fullPath = path.join(EXAMPLES, folder, file);
        const source = fs.readFileSync(fullPath, 'utf8');
        const frontEnd = frontEndFor(fullPath);
        const prefix = frontEnd.prefixOf(source) ?? prefixFromFile(fullPath);
        const compile = (target: CompileOptions['target']) => frontEnd.compile(source, prefix, { target, loopGuard: SMALL_GUARD, directIndex: true, protectNumberText: false }, fullPath);
        const nativeResult = compile('triggers');
        const regions = regionsOf(nativeResult.mapObjects);
        const native = simulate(withMapTriggers(nativeResult.program, nativeResult.mapObjects), FRAMES, regions);
        const machineResult = compile('pcode');
        const machine = simulate(withMapTriggers(machineResult.program, machineResult.mapObjects), FRAMES, regions);
        assert.deepEqual(machine.chat, native.chat);
        assert.deepEqual(machine.errors, native.errors);
        assert.deepEqual(machine.variables, native.variables);
      });
    }
  }

  it('finds its handlers after the host map triggers', () => {
    const { result } = run('var x = 1;\non start { x += 2; say("x is {x}"); }');
    const host = Array.from({ length: 7 }, (_, index) => ({ uid: `#host${index}`, enabled: true, maxCalls: 1, actions: [] }));
    const shifted = simulate({ ...result.program, triggers: [...host, ...result.program.triggers] });
    assert.deepEqual(shifted.chat, ['x is 3']);
  });

  it('returns from the function when the loop guard stops a loop', () => {
    const { chat, variables } = run('var n = 0;\nfunction spin() { while (true) { n += 1; } }\non start { spin(); say("after {n}"); }', { loopGuard: 10 });
    assert.deepEqual(chat, ['after 10']);
    assert.equal(variables['~t_n~'], 10);
  });

  it('keeps one trigger per kind of instruction, however long the program is', () => {
    const short = run('var x = 0;\non start { x += 1; say("{x}"); }').result.program.triggers.length;
    const long = run(`var x = 0;\non start { ${'x += 1; '.repeat(200)}say("{x}"); }`);
    assert.equal(long.result.program.triggers.length, short);
    assert.deepEqual(long.chat, ['200']);
  });

  it('keeps whole numbers as numbers and number-like text as text, like the trigger target', () => {
    const source = 'var a = 5;\nvar b = "007";\nvar c = "";\non start { a += 1; c = b; c ..= a; say("{a} {c}"); }';
    assert.deepEqual(run(source).chat, ['6 0076']);
    assert.deepEqual(simulate(compileSource(source, 't').program).chat, ['6 0076']);
  });

  it('refuses actions that switch the running trigger', () => {
    assert.throws(() => compileSource('on start { action(363, "#elsewhere", 0); }', 't', { target: 'pcode' }), /switches the running trigger/);
  });
});
