import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileSource } from './compile.ts';
import { Simulation } from '../sim/simulator.ts';

const FOLDER = path.resolve(import.meta.dirname, '..', '..', 'examples', 'tutorial');
const PLAYERS = [
  { slot: 0, name: 'ann', active: true, team: 1 },
  { slot: 1, name: 'bob', active: true, team: 1 },
  { slot: 2, name: 'cy', active: true, team: 1 },
  { slot: 3, name: 'dee', active: true, team: 1 },
];
const EXTERNAL = ['#respawn_region', '#SPAWN1', '#SPAWN2', '#SPAWN3', '#SPAWN4', '#door1', '#door1_open'];

type Scenario = { chat?: [number, string][]; uids?: string[]; frames?: number; expect: string[]; variables?: Record<string, unknown> };

const SCENARIOS: Record<string, Scenario> = {
  '01-hello.ptc': { expect: ['count is 1', 'count is 2', 'count is 3', 'done!'] },
  '02-chat-commands.ptc': {
    chat: [[1, '-help'], [1, '-skin 2'], [1, '-skin 9'], [1, 'hello'], [1, '-dance']],
    expect: ['commands: -skin 1-3, -roll', 'bob got skin 2', 'there is no skin 9', 'unknown command -dance, try -help'],
    variables: { lastSkin: 'c48386' },
  },
  '03-random-respawn.ptc': { uids: ['#tut_respawn'], expect: [] },
  '04-god-mode.ptc': { uids: ['#tut_becomeGod', '#tut_becomeGod'], expect: ['bob has 450 lifepoints', 'bob is already the god'] },
  '05-shared-doors.ptc': { uids: ['#tut_openDoor'], frames: 60, expect: ['the door is open'] },
  '06-players.ptc': { expect: ['cy is it!'], variables: { found: '1' } },
  '07-arithmetic.ptc': { expect: ['17 / 5 = 3 remainder 2', 'price 50.97, 2^10 = 1024, average 18', 'kg12 is not a number'] },
  '08-chat-calculator.ptc': {
    chat: [[0, '= 7 / 2'], [0, '=10%4'], [0, '= 1 / 0'], [0, '= 2 ^ 3'], [0, 'not for me']],
    expect: ['12 * 3 = 36', ' 7 / 2 = 3.5', '10%4 = 2', ' 1 / 0 = cannot divide by zero', ' 2 ^ 3 = unknown operator ^'],
  },
  '09-postfix.ptc': { expect: ['3 4 + 2 * = 14', '5 1 2 + 4 * + 3 - = 14', '2 3 ^ = 8', '1 + = error: + needs two numbers'] },
  '10-prefix.ptc': { expect: ['* + 3 4 2 = 14', '- 10 / 6 3 = 8', '* + 3 4 2 = 14 (recursive)', '+ * 2 3 ^ 2 4 = 22 (recursive)'] },
  '11-infix.ptc': {
    chat: [[0, '=(1+2)*3']],
    expect: ['3 4 2 * + = 11', '3 4 + 2 * = 14', '2 3 2 ^ ^ = 512', '3 4 2 * 1 5 - 2 3 ^ ^ / + = 3.0001220703125', 'error: ( without )', '1 2 + 3 * = 9'],
  },
  '12-recursive-descent.ptc': { expect: ['2 * (3 + 4) - -5 = 19', '10 / 4 - 1 = 1.5', '-(2 + 3) * 4 = -20'] },
  '13-dsa-basics.ptc': {
    expect: [
      'sum 25, average 5, biggest 9, 9 is at 2', 'reversed: 7,1,9,3,5', '1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz ',
      'gcd(48, 18) = 6', 'primes: 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 ',
    ],
  },
  '14-dsa-sorting.ptc': { expect: ['bubble sort: 3,4,8,15,17,23,29,42', 'insertion sort: 3,4,8,15,17,23,29,42', '23 at 5 in 2 steps', '5 not found'] },
  '15-dsa-stack-queue.ptc': { expect: ['([]) balanced: 1, ([)] balanced: 0', 'level: 1, lever: 0', 'queue order: abcdef, accepted g: 0'] },
  '16-dsa-quicksort.ptc': { expect: ['before: 11,48,35,22,9,46,33,20,7,44,31,18', 'after: 7,9,11,18,20,22,31,33,35,44,46,48 (17 calls)'] },
  '17-dsa-dictionary.ptc': { expect: ['the=4 cat=2 saw=2 dog=2 and=1 '] },
  '18-dsa-maze.ptc': { expect: ['shortest path: 9 steps'] },
  '19-dsa-heap.ptc': { expect: ['heap sort: 2 4 5 6 9 15 31 53 '] },
  '20-dsa-union-find.ptc': { expect: ['4 groups; 0 and 2 together: 1; 4 and 5 together: 0'] },
  '21-dsa-linked-list.ptc': { expect: ['list: a → b → c → d → e → end, middle c', 'without a and c: b → d → e → end', 'reversed: e → d → b → end'] },
  '22-dsa-binary-tree.ptc': {
    expect: ['in order: 20 30 35 40 50 60 70 80 ', 'pre order: 50 30 20 40 35 70 60 80 ', 'height 4, has 35: 1, has 36: 0', 'mirrored, in order: 80 70 60 50 40 35 30 20 '],
  },
  '23-dsa-more-sorting.ptc': {
    expect: ['input:     529156380742', 'selection: 012234556789', 'merge:     012234556789', 'counting:  012234556789', 'shell:     012234556789'],
  },
};

const DOC = path.resolve(import.meta.dirname, '..', '..', 'docs', 'tutorial.md');
const DOC_BLOCK = /<!-- file: ([^ ]+) -->\n```ptc\n([\s\S]*?)\n```/g;
const ELLIPSIS_LINE = /^\/\/ \.\.\. .* \.\.\.$/m;

describe('tutorial document', () => {
  it('quotes the example files exactly', () => {
    const blocks = [...fs.readFileSync(DOC, 'utf8').matchAll(DOC_BLOCK)];
    assert.ok(blocks.length >= 20);
    for (const [, file, code] of blocks) {
      const source = fs.readFileSync(path.join(FOLDER, file ?? ''), 'utf8');
      for (const piece of (code ?? '').split(ELLIPSIS_LINE)) assert.ok(source.includes(piece.trim()), `${file}: ${piece.slice(0, 60)}`);
    }
  });
});

describe('tutorial programs', () => {
  it('has a scenario for every program', () => {
    assert.deepEqual(fs.readdirSync(FOLDER).filter((file) => file.endsWith('.ptc')).sort(), Object.keys(SCENARIOS).sort());
  });

  for (const [file, scenario] of Object.entries(SCENARIOS)) {
    it(file, () => {
      const result = compileSource(fs.readFileSync(path.join(FOLDER, file), 'utf8'), 'tut', { externalUids: EXTERNAL });
      assert.deepEqual(result.warnings, []);
      const simulation = new Simulation(result.program, { players: PLAYERS, initiatorSlot: 1 });
      simulation.tick();
      for (const [slot, text] of scenario.chat ?? []) simulation.playerSays(slot, text);
      for (const uid of scenario.uids ?? []) simulation.runUid(uid);
      simulation.tick(scenario.frames ?? 1);
      assert.deepEqual(simulation.chat, scenario.expect);
      assert.deepEqual(simulation.errors, []);
      for (const [name, value] of Object.entries(scenario.variables ?? {})) assert.equal(simulation.variables[`~tut_${name}~`], value, name);
    });
  }
});
