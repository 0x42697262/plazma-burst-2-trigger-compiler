import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import { compileAssembly } from '../compiler/assemble.ts';
import { Simulation } from '../sim/simulator.ts';
import { emitXml } from '../emit/xml-emitter.ts';

const SOURCE = `
var score = 0;
var best = 0;
var list[];
extern shared;
on start {
  score = 5;
  sync(score);
  sync(best, "max");
  sync(list[2], "longest");
  sync(shared, "default");
  sync(score, "min");
  after = 1;
}
var after = 0;
`;

describe('variable sync', () => {
  it('compiles sync(x, mode) to actions 223 to 227 on the game name', () => {
    const { program } = compileSource(SOURCE, 't');
    const syncs = program.triggers.flatMap((trigger) => trigger.actions).filter((action) => action.opcode >= 223 && action.opcode <= 227);
    assert.deepEqual(syncs.map((action) => [action.opcode, action.targetA]), [
      [223, '~t_score~'], [225, '~t_best~'], [227, '~t_list[2]~'], [224, 'shared'], [226, '~t_score~'],
    ]);
  });

  it('adds one Var Sync engine mark to the XML when the program syncs', () => {
    const synced = compileSource(SOURCE, 't').program;
    assert.equal(synced.varSyncMark, true);
    assert.equal(emitXml(synced).match(/<inf [^>]*mark="var_sync" forteam="0" \/>/g)?.length, 1);
    const plain = compileSource('var x = 1;', 't').program;
    assert.equal(plain.varSyncMark, false);
    assert.doesNotMatch(emitXml(plain), /var_sync/);
    assert.equal(compileAssembly('start:\n    op225 $x\n', 't').program.varSyncMark, true);
  });

  it('runs on with the mark and stops the trigger without it, like the game', () => {
    const marked = compileSource(SOURCE, 't');
    const withMark = new Simulation(marked.program);
    withMark.tick();
    assert.equal(withMark.variables['~t_after~'], 1);
    assert.deepEqual(withMark.errors, []);
    const unmarked = compileSource(SOURCE, 't', { varSync: 'off' });
    assert.ok(unmarked.warnings.some((warning) => warning.includes('no Var Sync engine mark')));
    const withoutMark = new Simulation(unmarked.program);
    withoutMark.tick();
    assert.notEqual(withoutMark.variables['~t_after~'], 1);
    assert.match(withoutMark.errors[0] ?? '', /without the Var Sync engine mark/);
  });

  it('refuses what cannot be synced', () => {
    assert.throws(() => compileSource('var x;\non start { sync(x, "sum"); }', 't'), /sync mode must be one of replace, default, max, min, longest/);
    assert.throws(() => compileSource('var x;\non start { sync(x, "constructor"); }', 't'), /sync mode/);
    assert.throws(() => compileSource('var l[]; var i = 0;\non start { i += 1; sync(l[i]); }', 't'), /fixed index/);
    assert.throws(() => compileSource('const C = 1;\non start { sync(C); }', 't'), /needs a variable/);
    assert.throws(() => compileSource('var x;\non start { let y = sync(x); }', 't'), /"sync" gives no value/);
  });
});
