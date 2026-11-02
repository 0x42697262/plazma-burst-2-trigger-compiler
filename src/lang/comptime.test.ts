import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import { Simulation } from '../sim/simulator.ts';
import { readSourceFile } from '../cli/sources.ts';
import type { CompileOptions } from '../compiler/compile.ts';
import fs from 'node:fs';
import path from 'node:path';

const MAIN = '/virtual/main.ptc';
const PLAYERS = [{ slot: 0, name: 'ann', active: true }];

const compile = (source: string, options: Partial<CompileOptions> = {}) =>
  compileSource(source, 't', options, { file: MAIN, read: (file) => (file === MAIN ? source : readSourceFile(file)) });

const run = (source: string, options: Partial<CompileOptions> = {}, chat: string[] = []) => {
  const result = compile(source, options);
  const simulation = new Simulation(result.program, { players: PLAYERS });
  simulation.tick();
  for (const line of chat) simulation.playerSays(0, line);
  return { result, chat: simulation.chat, errors: simulation.errors, map: JSON.stringify(result.program) };
};

describe('compile-time constants', () => {
  it('computes a constant with functions while compiling and writes only the result', () => {
    const source = 'function square(n) { return n * n; }\nconst AREA = square(7);\nconst LABEL = "area {AREA} of {square(3)}";\non start { say(LABEL); }';
    const { chat, result, map } = run(source);
    assert.deepEqual(chat, ['area 49 of 9']);
    assert.deepEqual(result.warnings.filter((warning) => !warning.includes('timers')), []);
    assert.ok(!map.includes('square'));
  });

  it('lets a constant use the constants before it and the starting values of variables', () => {
    const { chat } = run('var base = 10;\nconst A = base + 1;\nconst B = A * 2;\nvar later = B;\non start { say("{A} {B} {later}"); }');
    assert.deepEqual(chat, ['11 22 22']);
  });

  it('refuses a constant that acts on the game or never finishes', () => {
    assert.throws(() => compile('const R = random(5);\non start { say("{R}"); }'), /cannot compute R while compiling: .*action 107 acts on the game/);
    assert.throws(() => compile('function show() { say("hi"); return 1; }\nconst X = show();\non start { say("{X}"); }'), /cannot compute X/);
    assert.throws(() => compile('function spin() { while (true) { } }\nconst X = spin();\non start { say("{X}"); }'), /cannot compute X while compiling: Stopped after/);
  });
});

describe('secrets and env', () => {
  const PASSWORD_PROGRAM = 'import "std/hash.ptc";\nsecret const PASSWORD = env("MAP_PASSWORD");\nconst PASSWORD_HASH = hash(PASSWORD);\n'
    + 'on chat { if (hash(chatText()) == PASSWORD_HASH) { say("welcome"); } else { say("no"); } }';
  const ENVIRONMENT = { environment: { MAP_PASSWORD: 'hunter2' } };

  it('checks a password whose text is nowhere in the map', () => {
    for (const target of ['triggers', 'pcode'] as const) {
      const { chat, errors, map } = run(PASSWORD_PROGRAM, { ...ENVIRONMENT, target }, ['hunter2', 'hunter3', '']);
      assert.deepEqual(chat, ['welcome', 'no', 'no']);
      assert.deepEqual(errors, []);
      assert.ok(!map.includes('hunter2'));
    }
  });

  it('fails when a secret would be written into the map', () => {
    const leaks = [
      'on chat { if (chatText() == PASSWORD) { say("in"); } }',
      'var copy = PASSWORD;\non start { say(copy); }',
      'const COPY = PASSWORD;\non start { say(COPY); }',
      'function same(text) { return text; }\nvar copy = same(PASSWORD);\non start { say(copy); }',
    ];
    for (const leak of leaks) {
      assert.throws(() => compile(`secret const PASSWORD = "hunter2";\n${leak}`), /the secret PASSWORD would be written into the map/, leak);
    }
  });

  it('works out an expression with a secret while compiling, also outside constants', () => {
    const source = 'function shout(text) { return "{text}!"; }\nsecret const WORD = "quiet";\nvar loud = shout(drop(WORD, 1));\non start { say(loud); }';
    const { chat, map } = run(source);
    assert.deepEqual(chat, ['uiet!']);
    assert.ok(!map.includes('quiet'));
  });

  it('explains env and secret mistakes', () => {
    assert.throws(() => compile('const P = env("NOT_SET_ANYWHERE");\non start { }'), /the environment variable NOT_SET_ANYWHERE is not set/);
    assert.throws(() => compile('on start { say(env("HOME")); }', { environment: { HOME: '/home' } }), /env\(\) works only in a const/);
    assert.throws(() => compile('secret const P = "abc";\non start { }'), /the secret P needs at least 4 characters/);
  });

  it('keeps secret as an ordinary name outside "secret const"', () => {
    const { chat } = run('var secret = 5;\non start { secret += 1; say("{secret}"); }');
    assert.deepEqual(chat, ['6']);
  });
});

describe('passwords guide', () => {
  it('runs the program in docs/passwords.md', () => {
    const guide = fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'docs', 'passwords.md'), 'utf8');
    const program = /```\n(import "std\/hash\.ptc";[\s\S]*?)```/.exec(guide)?.[1] ?? '';
    const { chat, map } = run(program, { environment: { MAP_PASSWORD: 'open sesame' } }, ['open sesame', 'open sesame!']);
    assert.deepEqual(chat, ['ann knows the password']);
    assert.ok(!map.includes('open sesame'));
  });
});

describe('standard library', () => {
  it('imports std/hash.ptc and gives the same hash at run time and while compiling', () => {
    const source = 'import "std/hash.ptc";\nconst EARLY = hash("Open Sesame 42!");\non start { say("{EARLY} {hash("Open Sesame 42!") == EARLY} {hash("Open Sesame 43!") == EARLY}"); }';
    const { chat } = run(source);
    assert.match(chat[0] ?? '', /^\d+-\d+-\d+ 1 0$/);
  });
});
