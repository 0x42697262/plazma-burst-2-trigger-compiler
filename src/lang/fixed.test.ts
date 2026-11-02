import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';

const actions = (source: string) => compileSource(source, 't').program.triggers.flatMap((trigger) => trigger.actions);

describe('fixed variables', () => {
  it('uses the value of a variable that never changes where the game needs a fixed value', () => {
    const shown = actions('var RED = "#FF0000";\non start { let size = 450; say("hi", RED); action(SetCharHP, "#player*0", size); }');
    assert.deepEqual(shown.filter((action) => action.opcode === 42 || action.opcode === 23).map((action) => [action.opcode, action.targetB]), [
      [42, '#FF0000'], [23, '450'],
    ]);
  });

  it('follows a chain of fixed variables and constants', () => {
    const shown = actions('const BASE = "#00FF00";\nvar color = BASE;\non start { let again = color; say("x", again); }');
    assert.equal(shown.find((action) => action.opcode === 42)?.targetB, '#00FF00');
  });

  it('refuses a variable that changes where only a fixed value works', () => {
    assert.throws(() => actions('var size = 450;\non start { size += 1; action(SetCharHP, "#player*0", size); }'),
      /line 2: action 23 takes a fixed int as B, but "size" can change while the map runs/);
    assert.throws(() => actions('var color = 2;\non chat { color = 3; }\non start { say("x", color); }'), /color of say/);
    assert.throws(() => actions('export var color = 2;\non start { say("x", color); }'), /color of say/);
  });

  it('keeps passing variable names where an action reads a variable', () => {
    const used = actions('var hits = 0;\non start { action(VarAddValue, hits, 10); }');
    assert.deepEqual(used.filter((action) => action.opcode === 102).map((action) => [action.targetA, action.targetB]), [['~t_hits~', '10']]);
  });

  it('warns when a changing variable goes to a text parameter that reads as a value', () => {
    const result = compileSource('var nick = "x";\non chat { nick = chatText(); }\non start { action(52, "#player*0", nick); }', 't');
    assert.ok(result.warnings.some((warning) => warning.includes('its variable name is passed instead')));
  });
});
