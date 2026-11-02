import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileSource } from './compile.ts';
import { Simulation } from '../sim/simulator.ts';

const FOLDER = path.resolve(import.meta.dirname, '..', '..', 'examples', 'syntax');
const DOC = path.resolve(import.meta.dirname, '..', '..', 'docs', 'syntax.md');
const DOC_BLOCK = /<!-- file: ([^ ]+) -->\n```ptc\n([\s\S]*?)\n```/g;
const read = (file: string): string => fs.readFileSync(file, 'utf8');

const EXPECTED: Record<string, string[]> = {
  '01-shape.ptc': ['hello', 'from the map'],
  '02-values.ptc': ['3 items, half is 1.5, limit 10, flag 1', 'text and numbers mix: 3 + 1 = 4', 'label is now 42'],
  '03-operators.ptc': [
    '2 + 3 * 4 = 14', '(2 + 3) * 4 = 20', '7 / 2 = 3.5, 7 % 2 = 1', 'the text 4 plus 1 = 5: text is read as a number', 'a joined with 1 = a1',
    '5 equals the text 5: 1; 3 is less than 5: 1', 'true and false: 0; not false: 1', 'total 30, word abc',
  ],
  '04-control.ptc': ['B', 'first power of 3 from 100: 243', 'odd numbers before 7: 1 3 5 ', 'hello!'],
  '05-functions.ptc': ['area 12, 5! = 120', 'hi ann'],
  '06-arrays.ptc': ['3 items: a B c', 'popped c, 2 left', 'after clear: 0', 'bob is 27'],
  '07-map-objects.ptc': ['3 exits'],
  '08-events.ptc': ['ann said hello'],
  '09-files.ptc': ['score 10, lives 3!'],
  '10-mistakes.ptc': ['total 8', 'first 8'],
};

const MISTAKES: [string, RegExp][] = [
  ['on start { total = 1; }', /unknown variable "total"/],
  ['function double(x) { return x * 2; }\non start { let y = double(1, 2); }', /"double" takes 1 argument\(s\), got 2/],
  ['var list[];\non start { list = 5; }', /the array "list" cannot be used as a value; use list\[i\] or len\(list\)/],
  ['on start { let c = 2; c += 1; say("hi", c); }', /the color of say\(\.\.\.\) must be a fixed value/],
  ["on start { say('hi'); }", /unexpected character "'"/],
  ['on start { say("hi") }', /expected ";", got "}"/],
  ['region spawn = "#spawn";\non start { action(SetCharHP, spawn, 100); }', /action 23 takes character as A, but "spawn" is a region/],
  ['on start { say("hi", Team.RedTeam); }', /action 42 takes textmsg as B, not a Team value/],
  ['function f() { wait(30); }', /"wait" works only in "on" and "every" blocks, not in functions/],
];

describe('syntax guide', () => {
  it('has an expected output for every example', () => {
    assert.deepEqual(fs.readdirSync(FOLDER).filter((file) => file.endsWith('.ptc')).sort(), Object.keys(EXPECTED).sort());
  });

  for (const [file, expected] of Object.entries(EXPECTED)) {
    it(file, () => {
      const fullPath = path.join(FOLDER, file);
      const result = compileSource(read(fullPath), 'syn', {}, { file: fullPath, read });
      assert.deepEqual(result.warnings, []);
      const simulation = new Simulation(result.program, { players: [{ slot: 0, name: 'ann', active: true }] });
      simulation.tick();
      simulation.playerSays(0, 'hello');
      simulation.tick(40);
      assert.deepEqual(simulation.chat, expected);
      assert.deepEqual(simulation.errors, []);
      if (file === '08-events.ptc') assert.deepEqual([simulation.variables['~syn_ticks~'], simulation.variables['~syn_steps~']], [3, 'ab']);
    });
  }

  it('quotes the example files exactly and shows the real error messages', () => {
    const blocks = [...read(DOC).matchAll(DOC_BLOCK)];
    assert.ok(blocks.length >= 11);
    for (const [, file, code] of blocks) assert.ok(read(path.join(FOLDER, file ?? '')).includes(code ?? ''), file ?? '');
    for (const [source, message] of MISTAKES) assert.throws(() => compileSource(source, 'p'), message);
  });
});
