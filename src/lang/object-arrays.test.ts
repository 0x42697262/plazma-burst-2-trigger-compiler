import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import { Simulation } from '../sim/simulator.ts';

const HANDLERS = `
var log = "";
export function a() { log ..= "a"; }
export function b() { log ..= "b"; }
export function c() { log ..= "c"; }
export function d() { log ..= "d"; }
trigger flat[] = ["#t_a", "#t_b", "#t_c", "#t_d"];
trigger grid[][] = [["#t_a", "#t_b"], ["#t_c", "#t_d"]];
`;

const run = (body: string) => {
  const result = compileSource(`${HANDLERS}\non start { ${body} }`, 't');
  const simulation = new Simulation(result.program);
  simulation.tick();
  return { result, simulation, log: simulation.variables['~t_log~'] };
};

describe('object arrays', () => {
  it('picks the element with a changing index while the map runs', () => {
    const { log, simulation } = run('for (let i = 3; i >= 0; i -= 1) { action(ExecTrigger, flat[i]); }');
    assert.equal(log, 'dcba');
    assert.deepEqual(simulation.errors, []);
  });

  it('picks from nested arrays with two changing indexes, or one fixed', () => {
    const { log } = run('for (let x = 0; x < 2; x += 1) { for (let y = 0; y < 2; y += 1) { action(ExecTrigger, grid[y][x]); } } let k = 1; action(ExecTrigger, grid[1][k]);');
    assert.equal(log, 'acbdd');
  });

  it('writes a fixed element straight into the action', () => {
    const { result, log } = run('action(ExecTrigger, flat[2]); let fixed = 1; action(ExecTrigger, grid[fixed][0]);');
    assert.equal(log, 'cc');
    const calls = result.program.triggers.flatMap((trigger) => trigger.actions).filter((action) => action.opcode === 99 || action.opcode === 123);
    assert.ok(calls.every((action) => action.opcode === 99));
  });

  it('does nothing for an index outside a changing array', () => {
    const { log } = run('let i = 2; i += 5; action(ExecTrigger, flat[i]);');
    assert.equal(log, '');
  });

  it('knows the lengths when compiling, and lists every element for create-if-missing', () => {
    const { result, simulation } = run('log = len(flat) .. len(grid) .. len(grid[1]);');
    assert.equal(simulation.variables['~t_log~'], '422');
    assert.deepEqual(result.objects.filter((object) => object.name.startsWith('grid')).map((object) => [object.name, object.uid]), [
      ['grid[0][0]', '#t_a'], ['grid[0][1]', '#t_b'], ['grid[1][0]', '#t_c'], ['grid[1][1]', '#t_d'],
    ]);
  });

  it('dispatches over every pair when both parameters are object arrays', () => {
    const result = compileSource('door doors[] = ["#d1", "#d2"];\nregion places[] = ["#p1", "#p2"];\nexport function go(i, j) { action(MovableTo, doors[i], places[j]); }', 't');
    const moves = result.program.triggers.flatMap((trigger) => trigger.actions).filter((action) => action.opcode === 0 || action.opcode === 123);
    assert.deepEqual(moves.map((action) => [action.opcode, action.targetA, action.targetB]).filter(([opcode]) => opcode === 0), [
      [0, '#d1', '#p1'], [0, '#d1', '#p2'], [0, '#d2', '#p1'], [0, '#d2', '#p2'],
    ]);
    assert.deepEqual(moves.filter((action) => action.opcode === 123).map((action) => action.targetB), ['0,0', '0,1', '1,0', '1,1']);
  });

  it('refuses wrong index counts, wrong kinds, fixed indexes outside, and use as a value', () => {
    assert.throws(() => run('action(ExecTrigger, grid[0]);'), /"grid" needs 2 index\(es\), got 1/);
    assert.throws(() => compileSource('region r[] = ["#r1"];\non start { action(ExecTrigger, r[0]); }', 't'), /action 99 takes trigger as A, but "r" is a region/);
    assert.throws(() => run('action(ExecTrigger, flat[7]);'), /"flat" has no element \[7\]/);
    assert.throws(() => run('log = flat;'), /"flat" is a map object/);
    assert.throws(() => compileSource('var list[];\nvar x = list[0][1];', 't'), /"list" is an array of values: it takes one index/);
  });
});
