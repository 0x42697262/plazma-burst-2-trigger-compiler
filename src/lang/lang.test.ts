import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import { Simulation } from '../sim/simulator.ts';
import type { SimulationOptions } from '../sim/simulator.ts';
import type { CompileOptions } from '../compiler/compile.ts';

const run = (source: string, frames = 1, options: Partial<CompileOptions> = {}, simulation: Partial<SimulationOptions> = {}) => {
  const result = compileSource(source, 't', options);
  const sim = new Simulation(result.program, simulation);
  sim.tick(frames);
  const get = (name: string) => sim.variables[`~t_${name}~`];
  return { ...result, sim, get };
};

describe('language: expressions', () => {
  it('follows precedence and associativity', () => {
    const { get, sim } = run(`
var a = 1 + 2 * 3;
var b = (1 + 2) * 3;
var c = 10 - 4 - 3;
var d = 7 % 3;
var e = 7 / 2;
var f = -a + 1;
var g = 2 - -3;
`);
    assert.deepEqual([get('a'), get('b'), get('c'), get('d'), get('e'), get('f'), get('g')], [7, 9, 3, 1, 3.5, -6, 5]);
    assert.deepEqual(sim.errors, []);
  });

  it('subtracts and adds variables without string concatenation', () => {
    const { get } = run(`
var x = "5.5";
var y = 2;
var sum = x + y;
var difference = x - y;
var self = 3;
on start { self = self - self * 2; }
`);
    assert.equal(get('sum'), 7.5);
    assert.equal(get('difference'), 3.5);
    assert.equal(get('self'), -3);
  });

  it('concatenates and interpolates', () => {
    const { get } = run(`
var n = 3;
var s = "a" .. n .. "b";
var t = "n={n}, double={n * 2}!";
var u = 1 .. 2;
var v = "x";
on start { v ..= "y"; v = "<" .. v .. ">"; }
`);
    assert.equal(get('s'), 'a3b');
    assert.equal(get('t'), 'n=3, double=6!');
    assert.equal(get('u'), '12');
    assert.equal(get('v'), '<xy>');
  });

  it('turns comparisons and logic into 1 or 0', () => {
    const { get } = run(`
var lt = 3 < 5;
var ge = 3 >= 5;
var eq = "abc" == "abc";
var ne = 4 != 4;
var x = 2;
var self = x == 2;
var both = x > 1 && x < 3;
var either = x > 5 || x == 2;
var not = !(x == 2);
`);
    assert.deepEqual(['lt', 'ge', 'eq', 'ne', 'self', 'both', 'either', 'not'].map(get), [1, 0, 1, 0, 1, 1, 1, 0]);
  });

  it('uses constants and externs', () => {
    const { sim } = run(`
const LIMIT = 4;
extern score;
extern other = "host var";
on start { score = LIMIT * 2; other = "x"; }
`);
    assert.equal(sim.variables.score, 8);
    assert.equal(sim.variables['host var'], 'x');
  });
});

describe('language: control flow', () => {
  it('runs if, else if and else', () => {
    const { get } = run(`
var out = "";
function classify(n) {
  if (n < 0) { return "negative"; } else if (n == 0) { return "zero"; } else { return "positive"; }
}
on start { out = classify(-2) .. "," .. classify(0) .. "," .. classify(5); }
`);
    assert.equal(get('out'), 'negative,zero,positive');
  });

  it('runs while, for, break and continue', () => {
    const { get, sim } = run(`
var sum = 0;
var evens = 0;
var stopped = 0;
on start {
  for (let i = 1; i <= 10; i += 1) { sum += i; }
  let j = 0;
  while (true) {
    j += 1;
    if (j > 100) { break; }
    if (j % 2 == 1) { continue; }
    evens += 1;
  }
  stopped = j;
}
`);
    assert.equal(get('sum'), 55);
    assert.equal(get('evens'), 50);
    assert.equal(get('stopped'), 101);
    assert.deepEqual(sim.errors, []);
  });

  it('short-circuits && and ||', () => {
    const { get } = run(`
var calls = 0;
function touch() { calls += 1; return 1; }
on start {
  if (false && touch()) { }
  if (true || touch()) { }
  if (true && touch()) { }
}
`);
    assert.equal(get('calls'), 1);
  });

  it('treats 0 and the empty text as false', () => {
    const { get } = run(`
var result = "";
on start {
  if (0) { result ..= "a"; }
  if ("") { result ..= "b"; }
  if (1) { result ..= "c"; }
  let x = "word";
  if (x) { result ..= "d"; }
  if (!x) { result ..= "e"; }
}
`);
    assert.equal(get('result'), 'cd');
  });

  it('stops an endless loop with the guard', () => {
    const { get, sim } = run('var n = 0;\non start { while (true) { n += 1; } }', 1, { loopGuard: 300 });
    assert.equal(get('n'), 300);
    assert.deepEqual(sim.errors, []);
  });
});

describe('language: functions', () => {
  it('passes arguments, also swapped, and returns values', () => {
    const { get } = run(`
var out = "";
function pair(a, b) { return a .. b; }
function swap(a, b) { return pair(b, a); }
function selfSwap(a, b) { if (a == "x") { return selfSwap(b, a); } return a .. b; }
on start { out = pair(1, 2) .. "|" .. swap(1, 2) .. "|" .. selfSwap("x", "y"); }
`);
    assert.equal(get('out'), '12|21|yx');
  });

  it('supports recursion with a saved frame', () => {
    const { get, sim } = run(`
var f = 0;
var g = 0;
function factorial(n) { if (n <= 1) { return 1; } return n * factorial(n - 1); }
function fib(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); }
on start { f = factorial(10); g = fib(12); }
`);
    assert.equal(get('f'), 3628800);
    assert.equal(get('g'), 144);
    assert.deepEqual(sim.errors, []);
  });

  it('keeps an argument stable when a later argument changes it', () => {
    const { get } = run(`
var x = 1;
var out = "";
function bump() { x = 5; return 0; }
function pair(a, b) { return a .. b; }
on start { out = pair(x, bump()); }
`);
    assert.equal(get('out'), '10');
  });

  it('exports functions with a stable uid and references them in actions', () => {
    const { entries, program } = run(`
var hits = 0;
export function hit() { hits += 1; }
on start { action(ExecTrigger, @hit); action("VarAddValue", hits, 10); }
`);
    assert.equal(entries.get('hit'), '#t_hit');
    assert.ok(program.triggers.some((trigger) => trigger.uid === '#t_hit'));
  });

  it('runs raw actions and exported functions', () => {
    const { get } = run(`
var hits = 0;
export function hit() { hits += 1; }
on start { action(ExecTrigger, @hit); action("VarAddValue", hits, 10); }
`);
    assert.equal(get('hits'), 11);
  });
});

describe('language: arrays and strings', () => {
  it('pushes, reads, writes and counts array elements', () => {
    const { get } = run(`
var list[];
var total = 0;
var out = "";
on start {
  push(list, 4);
  push(list, 5);
  push(list, "six");
  list[1] += 10;
  list[0] = list[0] * 2;
  for (let i = 0; i < len(list); i += 1) { out = out .. list[i] .. ";"; }
  total = len(list);
}
`);
    assert.equal(get('out'), '8;15;six;');
    assert.equal(get('total'), 3);
  });

  it('measures and searches text', () => {
    const { get } = run(`
var n = 12345;
var length = len(n);
var has = contains("hello world", "o w");
var hasNot = contains("hello", "z");
var word = "lo";
var hasVariable = contains("hello", word);
var asText = text(5) .. "";
var asNumber = number("7.5abc") + 1;
var floored = floor(7.9);
var rounded = round(7.5);
`);
    assert.deepEqual(['length', 'has', 'hasNot', 'hasVariable', 'asText', 'asNumber', 'floored', 'rounded'].map(get), [5, 1, 0, 1, '5', 8.5, 7, 8]);
  });

  it('says text with inline variables', () => {
    const { sim } = run('var n = 2;\non start { say("n is {n}"); say("double {n * 2}", 3); say(n); }');
    assert.deepEqual(sim.chat, ['n is 2', 'double 4', '2']);
  });

  it('shadows a variable in an inner block', () => {
    const { get } = run(`
var out = "";
on start {
  let x = 1;
  { let x = x + 10; out = out .. x; }
  out = out .. "," .. x;
}
`);
    assert.equal(get('out'), '11,1');
  });
});

describe('language: events and timing', () => {
  it('runs every N frames and waits', () => {
    const { get } = run(`
var ticks = 0;
var steps = "";
every 10 { ticks += 1; }
on start {
  steps = "a";
  wait(5);
  steps ..= "b";
  for (let i = 0; i < 2; i += 1) { wait(3); steps ..= i; }
}
`, 30);
    assert.equal(get('ticks'), 3);
    assert.equal(get('steps'), 'ab01');
  });

  it('loops over active player slots', () => {
    const { get } = run(`
var names = "";
on start { for player p { names = names .. name(p) .. ";"; } }
`, 1, {}, { players: [{ slot: 0, name: 'ann', active: true }, { slot: 2, name: 'bob', active: true }, { slot: 3, name: 'cy', active: false }] });
    assert.equal(get('names'), 'ann;bob;');
  });
});

describe('language: errors', () => {
  const error = (source: string, pattern: RegExp) => assert.throws(() => compileSource(source, 't'), pattern);

  it('reports mistakes with line numbers', () => {
    error('on start {\n  x = 1;\n}', /line 2: unknown variable "x"/);
    error('function f(a) {}\non start { f(); }', /"f" takes 1 argument/);
    error('on start { break; }', /"break" outside a loop/);
    error('function f() { wait(5); }', /"wait" works only/);
    error('const C = 1;\non start { C = 2; }', /"C" is a constant/);
    error('var a[];\non start { a = 1; }', /array "a" cannot be used as a value/);
    error('on start { say("x" }', /expected "\)"/);
    error('var s = "open;', /unclosed string/);
    error('on start { nothing(); }', /unknown function "nothing"/);
    error('var x;\nvar x;', /"x" is already defined/);
    error('on start { let y = say("x"); }', /"say" gives no value/);
  });
});
