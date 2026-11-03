import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { frontEndFor } from '../cli/frontends.ts';
import { main, prefixFromFile } from '../cli/main.ts';
import { compileSource } from '../lang/compile.ts';
import { CompileError } from '../compiler/names.ts';
import { Simulation } from '../sim/simulator.ts';
import type { Region, SimulationOptions } from '../sim/simulator.ts';
import { regionsOf, withMapTriggers } from '../emit/place.ts';
import { emitXml } from '../emit/xml-emitter.ts';
import { OPCODE } from '../opcodes/constants.ts';
import { EDITOR_SAVED_ACTIONS } from '../program/constants.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import type { Program } from '../program/types.ts';
import { ALL_LAYERS, FINDING, STATE } from './keys.ts';
import type { ActiveMode, TamperLayer } from './keys.ts';
import type { TamperCheck } from './tamper.ts';
import { tamperCheckOf } from './options.ts';
import { TEXT } from './text.ts';
import { REACTION_DELAY, WATCHDOG_DELAY } from './constants.ts';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', 'examples');
const FOLDERS = ['live', 'tutorial', 'syntax'];
const PLAYERS = [{ slot: 0, name: 'ann', active: true, team: 1 }, { slot: 1, name: 'bob', active: true, team: 2 }];
const FRAMES = 330;
const MAX_STEPS = 80_000_000;
const SMALL_GUARD = 500;
const SEED = 'tamper-seed';
const MODES: readonly ActiveMode[] = ['report', 'enforce'];
const FRAME_SPEEDS = [0.4, 2];
const REACTION_FRAMES = Math.ceil(((REACTION_DELAY.high + 10_000) / 1000) * 30);
const PROTECTABLE = /^var ([A-Za-z_][A-Za-z0-9_]*)(\s*(=|;))/gm;

const check = (mode: ActiveMode, layers: readonly TamperLayer[] = ALL_LAYERS): TamperCheck => ({ mode, seed: SEED, layers });

const simulate = (program: Program, regions: Readonly<Record<string, Region>> = {}, options: Partial<SimulationOptions> = {}) => {
  const simulation = new Simulation(program, { players: PLAYERS, maxSteps: MAX_STEPS, regions, ...options });
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

const findings = (simulation: Simulation, result: CompileResult): unknown => simulation.variables[result.tamper?.variables.findings ?? ''];

const protectAll = (source: string, compile: (text: string) => CompileResult): { source: string; result: CompileResult } => {
  const skipped = new Set<string>();
  for (;;) {
    const text = source.replace(PROTECTABLE, (whole, name: string, rest: string) => (skipped.has(name) ? whole : `protected var ${name}${rest}`));
    try {
      return { source: text, result: compile(text) };
    } catch (error) {
      const refused = error instanceof CompileError ? /line [0-9]+: ([A-Za-z_][A-Za-z0-9_]*) (is protected|cannot be protected)/.exec(error.message) : null;
      if (refused === null || skipped.has(refused[1] ?? '')) throw error;
      skipped.add(refused[1] ?? '');
    }
  }
};

const compile = (source: string, options: Partial<CompileOptions> = {}): CompileResult => compileSource(source, 't', { tamper: check('report'), ...options });

const uidOf = (result: CompileResult, part: string): string => {
  const trigger = result.program.triggers.find((entry) => entry.uid.includes(part));
  assert.ok(trigger, part);
  return trigger.uid;
};

describe('tamper check: honest runs give no finding', () => {
  for (const folder of FOLDERS) {
    for (const file of fs.readdirSync(path.join(EXAMPLES, folder)).filter((name) => /\.(ptc|pasm)$/.test(name)).sort()) {
      it(`runs ${folder}/${file} like the plain build in every mode`, () => {
        const fullPath = path.join(EXAMPLES, folder, file);
        const plainSource = fs.readFileSync(fullPath, 'utf8');
        const frontEnd = frontEndFor(fullPath);
        const prefix = frontEnd.prefixOf(plainSource) ?? prefixFromFile(fullPath);
        const base: Partial<CompileOptions> = { loopGuard: SMALL_GUARD };
        const plainResult = frontEnd.compile(plainSource, prefix, base, fullPath);
        const regions = regionsOf(plainResult.mapObjects);
        const plain = simulate(withMapTriggers(plainResult.program, plainResult.mapObjects), regions);
        for (const mode of MODES) {
          for (const obfuscate of [null, { seed: SEED }]) {
            const options = { ...base, obfuscate, tamper: check(mode) };
            const built = file.endsWith('.ptc')
              ? protectAll(plainSource, (text) => frontEnd.compile(text, prefix, options, fullPath))
              : { source: plainSource, result: frontEnd.compile(plainSource, prefix, options, fullPath) };
            const result = built.result;
            const label = `${mode}${obfuscate === null ? '' : ', obfuscated'}`;
            const checked = simulate(withMapTriggers(result.program, result.mapObjects), regions);
            const reveal = result.obfuscation?.reveal ?? ((name: string) => name);
            assert.equal(findings(checked, result), undefined, label);
            assert.deepEqual(checked.chat, plain.chat, label);
            assert.deepEqual(checked.errors.map(errorText), plain.errors.map(errorText), label);
            assert.deepEqual(userVariables(checked, prefix, reveal), userVariables(plain, prefix, (name) => name), label);
            for (const trigger of result.program.triggers) assert.ok(trigger.actions.length <= EDITOR_SAVED_ACTIONS, trigger.uid);
          }
        }
        for (const frameSpeed of FRAME_SPEEDS) {
          const result = frontEnd.compile(plainSource, prefix, { ...base, tamper: check('enforce') }, fullPath);
          const slow = simulate(withMapTriggers(result.program, result.mapObjects), regions, { frameSpeed });
          assert.equal(findings(slow, result), undefined, `frame speed ${frameSpeed}`);
        }
      });
    }
  }
});

describe('tamper check', () => {
  it('changes nothing when off', () => {
    const source = 'var n = 0;\nfunction add(x) { n += x; }\non start { while (n < 5) { add(1); } say("n {n}"); wait(3); }\nevery 30 { n += 1; }';
    const plain = emitXml(compileSource(source, 't').program);
    assert.equal(emitXml(compileSource(source, 't', { tamper: null }).program), plain);
    assert.equal(tamperCheckOf({ mode: 'off', seed: null, layers: null, fallbackSeed: () => SEED }), null);
    const unchecked = compileSource(`protected ${source}`, 't');
    assert.equal(emitXml(unchecked.program), plain);
    assert.ok(unchecked.warnings.some((warning) => warning.includes(TEXT.protectedUnchecked('n'))));
    const event = compileSource(`${source}\non tamper { say("x"); }`, 't');
    assert.equal(emitXml(event.program), plain);
    assert.ok(event.warnings.some((warning) => warning.includes(TEXT.tamperUnused)));
  });

  it('gives the same build for the same seed and other values for another seed', () => {
    const source = 'var n = 0;\non start { while (n < 5) { n += 1; } }';
    const first = emitXml(compile(source).program);
    assert.equal(emitXml(compile(source).program), first);
    assert.notEqual(emitXml(compile(source, { tamper: { ...check('report'), seed: 'other' } }).program), first);
  });

  it('adds each layer only when asked', () => {
    const source = 'protected var gold = 1;\nfunction add(x) { gold += x; }\non start { add(2); }\nevery 30 { add(1); }\non chat { add(3); }';
    const opcodesOf = (layers: readonly TamperLayer[]): Set<number> => new Set(compile(source, { tamper: check('report', layers) }).program.triggers
      .filter((trigger) => !trigger.uid.includes(':tc-')).flatMap((trigger) => trigger.actions.map((action) => action.opcode)));
    assert.ok(!opcodesOf([]).has(OPCODE.skipIfEqual));
    assert.ok(opcodesOf(['flow']).has(OPCODE.skipIfEqual));
    assert.ok(opcodesOf(['entry']).has(OPCODE.timerElapsed));
    assert.ok(!opcodesOf(['flow']).has(OPCODE.timerElapsed));
    assert.ok(opcodesOf(['value']).has(OPCODE.addVariable));
    assert.ok(!opcodesOf(['entry']).has(OPCODE.timeSinceStart));
    assert.ok(opcodesOf(['watchdog']).has(OPCODE.timeSinceStart));
  });

  it('refuses the p-code target and protected values it cannot follow', () => {
    assert.throws(() => compile('on start { }', { target: 'pcode' }), new RegExp(TEXT.pcode.slice(0, 20)));
    assert.throws(() => compile('protected var list[];\non start { }'), /not on the array list/);
    assert.throws(() => compile('protected export var score = 0;\non start { }'), /cannot be protected and exported/);
    assert.throws(() => compile('protected var score = 0;\non start { sync(score); }'), /cannot be synced/);
    assert.throws(() => compile('protected var score = 0;\non start { action(VarAddValue, score, 1); }'), /cannot be passed to action/);
    assert.throws(() => compile('protected var score = 0;\nmap { Trigger("#t") { action(VarAddValue, score, 1); } }\non start { }'), /map block trigger/);
    assert.throws(() => compile('on tamper { wait(3); }\non start { }'), /wait\(\) does not work in on tamper/);
    assert.throws(() => tamperCheckOf({ mode: 'loud', seed: null, layers: null, fallbackSeed: () => SEED }), /Unknown --tamper-check mode/);
    assert.throws(() => tamperCheckOf({ mode: 'report', seed: null, layers: 'flow,speed', fallbackSeed: () => SEED }), /Unknown --tamper-layers entry "speed"/);
  });

  it('finds a helper tool running an internal trigger, and enforce turns the program off after the delay', () => {
    const source = 'var n = 0;\nfunction step() { n += 1; }\non start { while (n < 3) { step(); } say("start {n}"); }\non chat { step(); say("chat {n}"); }\non tamper { say("tamper {tamperFinding()}"); }';
    for (const mode of MODES) {
      const result = compile(source, { tamper: check(mode) });
      const simulation = simulate(result.program);
      assert.equal(findings(simulation, result), undefined);
      simulation.runUid(uidOf(result, '_step'));
      assert.equal(findings(simulation, result), 1);
      assert.equal(simulation.variables[result.tamper?.variables.last ?? ''], FINDING.flow);
      simulation.tick(REACTION_FRAMES);
      simulation.playerSays(0, 'again');
      if (mode === 'report') {
        assert.deepEqual(simulation.chat.slice(-2), [`tamper ${FINDING.flow}`, 'chat 6']);
        assert.equal(simulation.variables['~t_n~'], 6);
      } else {
        assert.equal(simulation.chat.at(-1), `tamper ${FINDING.flow}`);
        assert.equal(simulation.variables['~t_n~'], 0);
        assert.equal(simulation.variables[result.tamper?.variables.state ?? ''], Number(STATE.done));
      }
    }
  });

  it('finds a protected value set from outside, also when obfuscated', () => {
    const source = 'protected var gold = 5;\non chat { gold += 1; say("gold {gold}"); }';
    for (const obfuscate of [null, { seed: SEED }]) {
      const result = compile(source, { obfuscate });
      const simulation = simulate(result.program);
      const name = Object.keys(simulation.variables).find((entry) => (result.obfuscation?.reveal ?? ((text: string) => text))(entry) === '~t_gold~') ?? '';
      assert.equal(findings(simulation, result), undefined);
      simulation.variables[name] = 500;
      simulation.playerSays(0, 'x');
      assert.equal(findings(simulation, result), 1);
      assert.equal(simulation.variables[result.tamper?.variables.last ?? ''], FINDING.value);
    }
  });

  it('finds timer entries run early, a second start and a wait continuation run directly', () => {
    const source = 'var n = 0;\non start { n = 1; wait(200); n = 2; }\nevery 40 { n += 0; }';
    const result = compile(source);
    const fresh = (): Simulation => {
      const simulation = new Simulation(result.program);
      simulation.tick(50);
      return simulation;
    };
    const cases: [string, number][] = [[':every', FINDING.timer], [':start', FINDING.start], [':wait', FINDING.timer], [':tc-watchdog', FINDING.timer]];
    for (const [part, kind] of cases) {
      const simulation = fresh();
      simulation.runUid(uidOf(result, part));
      assert.equal(simulation.variables[result.tamper?.variables.last ?? ''], kind, part);
    }
    const waited = fresh();
    waited.tick(250);
    assert.equal(waited.variables['~t_n~'], 2);
    assert.equal(findings(waited, result), undefined);
    waited.runUid(uidOf(result, ':wait'));
    assert.equal(waited.variables[result.tamper?.variables.last ?? ''], FINDING.wait);
  });

  it('finds a stopped watchdog or a stopped partner timer as soft findings, and three of them are proof', () => {
    const source = 'var n = 0;\nevery 10 { n += 1; }';
    const result = compile(source, { tamper: check('enforce') });
    const timerOf = (simulation: Simulation, part: string) => simulation.timers.find((timer) => timer.uid.includes(part));
    const watchdogOff = new Simulation(result.program);
    watchdogOff.tick(WATCHDOG_DELAY + 5);
    const watchdog = timerOf(watchdogOff, ':tc-watchdog-timer');
    assert.ok(watchdog);
    watchdog.enabled = false;
    watchdogOff.tick(WATCHDOG_DELAY * 2);
    assert.equal(watchdogOff.variables[result.tamper?.variables.last ?? ''], FINDING.stalled);
    watchdogOff.tick(REACTION_FRAMES);
    assert.equal(watchdogOff.variables[result.tamper?.variables.state ?? ''], Number(STATE.done));
    const partnerOff = new Simulation(result.program);
    partnerOff.tick(5);
    const partner = partnerOff.timers.find((timer) => timer.delay === 10);
    assert.ok(partner);
    partner.calls = 0;
    partnerOff.tick(WATCHDOG_DELAY * 2);
    assert.equal(partnerOff.variables[result.tamper?.variables.last ?? ''], FINDING.idle);
    assert.equal(partnerOff.variables[result.tamper?.variables.state ?? ''], undefined);
  });

  it('finds a late heartbeat at an event once per minute, and report never resets', () => {
    const source = 'var n = 0;\non chat { n += 1; }';
    const result = compile(source);
    const simulation = simulate(result.program);
    const watchdog = simulation.timers.find((timer) => timer.uid.includes(':tc-watchdog-timer'));
    assert.ok(watchdog);
    watchdog.enabled = false;
    simulation.tick(3000);
    for (let line = 0; line < 5; line++) simulation.playerSays(0, 'x');
    assert.equal(findings(simulation, result), 1);
    assert.equal(simulation.variables[result.tamper?.variables.last ?? ''], FINDING.late);
    assert.equal(simulation.variables['~t_n~'], 6);
  });

  it('gives no finding when the loop guard stops a loop', () => {
    const source = 'var n = 0;\nfunction spin() { while (1) { n += 1; } }\non start { spin(); say("after {n}"); }\nevery 20 { spin(); }';
    const result = compile(source, { loopGuard: SMALL_GUARD, tamper: check('enforce') });
    const simulation = simulate(result.program);
    assert.equal(findings(simulation, result), undefined);
    assert.deepEqual(simulation.chat, [`after ${SMALL_GUARD}`]);
  });

  it('offers the options on the command line', () => {
    const lines: string[] = [];
    main(['--help'], { out: (line) => lines.push(line), err: (line) => lines.push(line) });
    const help = lines.join('\n');
    for (const flag of ['--tamper-check', '--tamper-seed', '--tamper-layers']) assert.ok(help.includes(flag), flag);
  });
});
