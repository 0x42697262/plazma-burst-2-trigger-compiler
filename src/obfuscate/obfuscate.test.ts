import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { frontEndFor } from '../cli/frontends.ts';
import { prefixFromFile } from '../cli/main.ts';
import { compileSource } from '../lang/compile.ts';
import { Simulation } from '../sim/simulator.ts';
import { emitXml } from '../emit/xml-emitter.ts';
import { OPCODE } from '../opcodes/constants.ts';
import { EDITOR_SAVED_ACTIONS } from '../program/constants.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import type { Program, Trigger } from '../program/types.ts';
import { TEXT } from './text.ts';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', 'examples');
const FOLDERS = ['live', 'tutorial', 'syntax'];
const TARGETS = ['triggers', 'pcode'] as const;
const PLAYERS = [{ slot: 0, name: 'ann', active: true, team: 1 }, { slot: 1, name: 'bob', active: true, team: 2 }];
const FRAMES = 60;
const MAX_STEPS = 50_000_000;
const SMALL_GUARD = 500;
const SEED = 'test-seed';
const CODED = /^[\uE000-\uF8FF]{2,}$/;

const simulate = (program: Program) => {
  const simulation = new Simulation(program, { players: PLAYERS, maxSteps: MAX_STEPS });
  simulation.tick();
  simulation.playerSays(0, '-help');
  simulation.playerJoins();
  simulation.tick(FRAMES);
  return simulation;
};

const errorText = (error: string): string => error.replace(/^Trigger [^,]+, action [0-9]+: /, '');

const userVariables = (simulation: Simulation, prefix: string, reveal: (name: string) => string): Record<string, unknown> => {
  const own = new RegExp(`[~#]${prefix}[_:][a-z]+(?=[~[0-9]|$)`, 'g');
  const revealText = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replace(own, (name) => reveal(name));
    return Array.isArray(value) ? value.map(revealText) : value;
  };
  return Object.fromEntries(Object.entries(simulation.variables)
    .map(([name, value]) => [reveal(name), revealText(value)] as const)
    .filter(([name]) => name.startsWith(`~${prefix}_`)));
};

const compile = (source: string, options: Partial<CompileOptions> = {}): CompileResult => compileSource(source, 't', { obfuscate: { seed: SEED }, ...options });

const regionOf = (result: CompileResult): Trigger[] =>
  result.program.triggers.filter((trigger) => !result.obfuscation?.machineUids.has(trigger.uid));

describe('obfuscation', () => {
  for (const target of TARGETS) {
    for (const folder of FOLDERS) {
      for (const file of fs.readdirSync(path.join(EXAMPLES, folder)).filter((name) => /\.(ptc|pasm)$/.test(name)).sort()) {
        it(`runs ${folder}/${file} like the plain build (${target})`, () => {
          const fullPath = path.join(EXAMPLES, folder, file);
          const source = fs.readFileSync(fullPath, 'utf8');
          const frontEnd = frontEndFor(fullPath);
          const prefix = frontEnd.prefixOf(source) ?? prefixFromFile(fullPath);
          const options: Partial<CompileOptions> = { target, loopGuard: SMALL_GUARD };
          const plain = simulate(frontEnd.compile(source, prefix, options, fullPath).program);
          const result = frontEnd.compile(source, prefix, { ...options, obfuscate: { seed: SEED } }, fullPath);
          const hidden = simulate(result.program);
          const reveal = result.obfuscation?.reveal ?? ((name: string) => name);
          assert.deepEqual(hidden.chat, plain.chat);
          assert.deepEqual(hidden.errors.map(errorText), plain.errors.map(errorText));
          assert.deepEqual(userVariables(hidden, prefix, reveal), userVariables(plain, prefix, (name) => name));
          for (const trigger of result.program.triggers) assert.ok(trigger.actions.length <= EDITOR_SAVED_ACTIONS, trigger.uid);
        });
      }
    }
  }

  it('gives the same build for the same seed and other names for another seed', () => {
    const source = 'var count = 0;\non start { while (count < 5) { count += 1; } say("done {count}"); }';
    const first = emitXml(compile(source).program);
    assert.equal(emitXml(compile(source).program), first);
    const other = compile(source, { obfuscate: { seed: 'another' } });
    assert.notEqual(emitXml(other.program), first);
    const firstUids = new Set(compile(source).program.triggers.map((trigger) => trigger.uid));
    const shared = other.program.triggers.filter((trigger) => firstUids.has(trigger.uid));
    assert.ok(shared.length < firstUids.size / 2);
  });

  it('keeps names and texts out of the map but keeps exports', () => {
    const source = 'export var score = 0;\nvar secretCounter = 0;\nexport function award(points) { score += points; }\non start { secretCounter += 1; award(5); say("Welcome to the castle"); }';
    const result = compile(source);
    const xml = emitXml(result.program);
    assert.ok(!xml.includes('secretCounter') && !xml.includes('castle') && !xml.includes('Welcome'));
    assert.ok(xml.includes('~t_score~') && xml.includes('"#t_award"') && xml.includes('~t_award.points~'));
    const simulation = simulate(result.program);
    assert.deepEqual(simulation.chat, ['Welcome to the castle']);
    assert.equal(simulation.variables['~t_score~'], 5);
  });

  it('finds its triggers after the host map triggers', () => {
    const result = compile('var x = 1;\non start { while (x < 40) { x += x; } say("x is {x}"); }');
    const host = Array.from({ length: 7 }, (_, index) => ({ uid: `#host${index}`, enabled: true, maxCalls: 1, actions: [] }));
    assert.deepEqual(simulate({ ...result.program, triggers: [...host, ...result.program.triggers] }).chat, ['x is 64']);
  });

  it('keeps every trigger within the editor limit for long code', () => {
    const result = compile(`var x = 0;\non start { ${'x += 1; say("step {x}"); '.repeat(150)} }`);
    for (const trigger of result.program.triggers) assert.ok(trigger.actions.length <= EDITOR_SAVED_ACTIONS, trigger.uid);
    assert.equal(simulate(result.program).chat.at(-1), 'step 150');
  });

  it('still finds a secret written into a text', () => {
    assert.throws(() => compile('secret const KEY = "hunter22";\non start { say(KEY); }'), /hunter22|KEY/);
  });

  it('shows the alarm and stops working when a trigger is removed', () => {
    const source = 'var n = 0;\non start { while (n < 10) { n += 1; } say("credit: made by ann"); say("n is {n}"); }';
    const result = compile(source);
    assert.deepEqual(simulate(result.program).chat, ['credit: made by ann', 'n is 10']);
    const region = regionOf(result);
    const removed = region[Math.floor(region.length / 2)] as Trigger;
    const tampered = simulate({ ...result.program, triggers: result.program.triggers.filter((trigger) => trigger !== removed) });
    assert.deepEqual(tampered.chat, [TEXT.alarm]);
  });

  it('shows the alarm when an encoded text is changed', () => {
    const source = 'on start { say("credit: made by ann"); }';
    const result = compile(source);
    const triggers = result.program.triggers.map((trigger) => ({
      ...trigger,
      actions: trigger.actions.map((action) => (action.opcode === OPCODE.setVariable && CODED.test(action.targetB)
        ? { ...action, targetB: action.targetB.slice(-1) + action.targetB.slice(1) } : action)),
    }));
    assert.deepEqual(simulate({ ...result.program, triggers }).chat, [TEXT.alarm]);
  });

  it('shows the alarm when a p-code handler is removed', () => {
    const result = compile('var n = 0;\non start { while (n < 3) { n += 1; } say("n is {n}"); }', { target: 'pcode' });
    assert.deepEqual(simulate(result.program).chat, ['n is 3']);
    const handler = result.program.triggers.find((trigger) => trigger.actions.some((action) => action.opcode === OPCODE.addValue)) as Trigger;
    const tampered = simulate({ ...result.program, triggers: result.program.triggers.filter((trigger) => trigger !== handler) });
    assert.deepEqual(tampered.chat, [TEXT.alarm]);
  });

  it('works with a trigger added after the program', () => {
    const result = compile('var n = 0;\non start { while (n < 3) { n += 1; } say("n is {n}"); }');
    const added = { uid: '#later', enabled: true, maxCalls: 1, actions: [] };
    assert.deepEqual(simulate({ ...result.program, triggers: [...result.program.triggers, added] }).chat, ['n is 3']);
  });
});
