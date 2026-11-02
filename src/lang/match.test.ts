import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import { Simulation } from '../sim/simulator.ts';

const run = (source: string) => {
  const result = compileSource(source, 't');
  const simulation = new Simulation(result.program);
  simulation.tick();
  return { result, simulation, get: (name: string) => simulation.variables[`~t_${name}~`] };
};

describe('match', () => {
  it('runs the first arm whose pattern equals the value, as text', () => {
    const { get, simulation } = run(`
const QUIT = "-quit";
var log = "";
function describe(command) {
  match (command) {
    "-help", "-h" => { return "help"; }
    QUIT => return "bye";
    5 => return "five";
    _ => return "unknown {command}";
  }
}
on start { log = describe("-h") .. "," .. describe("-quit") .. "," .. describe("5") .. "," .. describe(5) .. "," .. describe("-x"); }
`);
    assert.equal(get('log'), 'help,bye,five,five,unknown -x');
    assert.deepEqual(simulation.errors, []);
  });

  it('does nothing when no arm matches and there is no default', () => {
    const { get } = run('var hit = 0;\non start { match (3) { 1 => hit = 1; 2 => hit = 2; } }');
    assert.equal(get('hit'), 0);
  });

  it('evaluates the value once, and lets break leave the surrounding loop', () => {
    const { get } = run(`
var calls = 0;
var seen = "";
function next() { calls += 1; return calls; }
on start {
  match (next()) { 1 => seen ..= "one"; 2 => seen ..= "two"; }
  for (let i = 0; i < 10; i += 1) {
    match (i) {
      3 => break;
      _ => seen ..= i;
    }
  }
}
`);
    assert.equal(get('calls'), 1);
    assert.equal(get('seen'), 'one012');
  });

  it('refuses a default arm that is not last, repeated patterns and changing patterns', () => {
    assert.throws(() => compileSource('on start { match (1) { _ => say("a"); 1 => say("b"); } }', 't'), /"_" arm must be the last/);
    assert.throws(() => compileSource('on start { match (1) { 1, 1 => say("a"); } }', 't'), /appears twice/);
    assert.throws(() => compileSource('var x = 1;\non start { x += 1; match (1) { x => say("a"); } }', 't'), /match pattern must be a fixed value/);
  });
});
