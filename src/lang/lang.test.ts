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
on start { v ..= "y"; v = "[" .. v .. "]"; }
`);
    assert.equal(get('s'), 'a3b');
    assert.equal(get('t'), 'n=3, double=6!');
    assert.equal(get('u'), '12');
    assert.equal(get('v'), '[xy]');
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

  it('takes characters and drops text', () => {
    const { get } = run(`
var word = "hello";
var i = 4;
var first = charAt(word, 0);
var last = charAt(word, i);
var outside = charAt(word, 9);
var tail = drop(word, 2);
var head = drop(word, -2);
var digits = drop(12345, 1);
`);
    assert.deepEqual(['first', 'last', 'outside', 'tail', 'head', 'digits'].map(get), ['h', 'o', undefined, 'llo', 'hel', '2345']);
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

describe('language: review fixes', () => {
  it('keeps the loop guard when a loop calls an exported function', () => {
    const { get, sim } = run('var n = 0;\nexport function tick() { n += 1; }\non start { while (true) { tick(); } }', 1, { loopGuard: 300 });
    assert.equal(get('n'), 300);
    assert.deepEqual(sim.errors, []);
  });

  it('evaluates an element index once, before the value', () => {
    const { sim } = run(`
var list[]; var i = 0; var calls = 0;
function next() { calls += 1; i += 1; return i; }
function bump() { i = 2; return 1; }
on start {
  list[1] = 100; list[2] = 200; i = 0;
  list[next()] += 5;
  i = 1;
  list[i] += bump();
}
`);
    assert.equal(sim.variables['~t_calls~'], 1);
    assert.equal(sim.variables['~t_list[1]~'], 106);
    assert.equal(sim.variables['~t_list[2]~'], 200);
  });

  it('reads text as numbers with parseFloat in every arithmetic operator', () => {
    const { get } = run(`
var s = "4x"; var e = "";
var plus = s + 1; var minus = s - 1; var times = s * 2; var divided = s / 2;
var rminus = 10 - s; var neg = -s; var minusEmptyVar = 10 - e; var minusEmptyLit = 10 - "";
var list[];
on start { list[0] = "4x"; let k = 0; list[k] *= 2; }
`);
    assert.deepEqual(['plus', 'minus', 'times', 'divided', 'rminus', 'neg'].map(get), [5, 3, 8, 2, 6, -4]);
    assert.ok(Number.isNaN(get('minusEmptyVar')));
    assert.ok(Number.isNaN(get('minusEmptyLit')));
    assert.equal(get('list[0]'), 8);
  });

  it('runs every on start block, each with its own scope and return', () => {
    const { get, sim } = run('var r = 0;\non start { r = 1; if (r == 1) { return; } r = 2; }\non start { say("second"); r = 3; }');
    assert.equal(get('r'), 3);
    assert.deepEqual(sim.chat, ['second']);
    assert.throws(() => compileSource('on start { let x = 1; }\non start { say("{x}"); }', 't'), /unknown variable "x"/);
  });

  it('writes number literals in their shortest form', () => {
    const { get } = run('var a = -0 == 0; var b = 5.0 == 5; var c = 2.50 .. ""; var d = 0;\non start { if (0.0) { d = 1; } }');
    assert.deepEqual(['a', 'b', 'c', 'd'].map(get), [1, 1, '2.5', 0]);
  });

  it('gives empty text when a function ends without a value', () => {
    const { get } = run('var out = "";\nfunction f(x) { if (x) { return 7; } }\non start { out = f(1) .. "," .. f(0) .. ","; }');
    assert.equal(get('out'), '7,,');
  });

  it('accepts constants as say color and drop count', () => {
    const { sim, get } = run('const RED = 2; const N = 1;\nvar t = drop("abc", N);\non start { say("x", RED); }');
    assert.equal(get('t'), 'bc');
    assert.equal(sim.chat[0], 'x');
  });
});

describe('language: review round 2', () => {
  it('does not write a fixed element before reading it through a variable index', () => {
    const { get } = run(`
var list[]; var k = 0; var a = ""; var b = ""; var d = "";
on start {
  list[0] = 10; list[0] = 1 - list[k]; a = list[0];
  list[0] = "p"; list[0] = "a" .. list[k]; b = list[0];
  list[0] = 3; list[0] = 2 * list[k] + list[k]; d = list[0];
}
`);
    assert.deepEqual(['a', 'b', 'd'].map(get), [-9, 'ap', 9]);
  });

  it('runs a call at the start of a join before clearing the destination', () => {
    const { get } = run(`
var x = "old"; var y = "old"; var list[]; var c = "";
function fx() { return x; }
function fy() { return y; }
function g() { return list[0]; }
on start { x = "{fx()}"; y = fy() .. 1 .. 2; list[0] = "q"; list[0] = g() .. "!"; c = list[0]; }
`);
    assert.deepEqual(['x', 'y', 'c'].map(get), ['old', 'old12', 'q!']);
  });

  it('reads text like parseFloat in floor and round, and uses constant indexes directly', () => {
    const { get, program } = run('const I = 1;\nvar list[];\nvar f = floor("4.7x");\nvar r = round("2.5y");\non start { list[I] = 5; }');
    assert.deepEqual(['f', 'r', 'list[1]'].map(get), [4, 3, 5]);
    assert.ok(!program.triggers.some((trigger) => trigger.actions.some((action) => action.opcode === 326)));
  });
});

describe('language: review round 3', () => {
  it('indexes an array by its own element', () => {
    const { sim } = run('var p[]; var r = 0;\non start { push(p, 0); push(p, 1); r = p[p[1]]; p[p[0]] = 9; }');
    assert.equal(sim.variables['~t_r~'], 1);
    assert.equal(sim.variables['~t_p[0]~'], 9);
    assert.equal(sim.variables['0'], undefined);
  });

  it('subtracts text literals like parseFloat', () => {
    const { get } = run('var a = 0 - " 2"; var b = 10 - "4x"; var c = 1 - -1;');
    assert.deepEqual(['a', 'b', 'c'].map(get), [-2, 6, 2]);
  });

  it('keeps a text index as text', () => {
    const { get } = run('var a[]; var r = 0; var s = 0;\non start { a[0] = 5; a["0.0"] = 7; r = a[0]; s = a["0.0"]; }');
    assert.deepEqual(['r', 's'].map(get), [5, 7]);
  });

  it('leaves out functions nobody calls, with a warning', () => {
    const { warnings, program } = compileSource('function unused() { say("x"); }\nfunction used() { }\non start { used(); }', 't');
    assert.deepEqual(warnings, ['line 1: the function "unused" is never called; it was left out']);
    assert.ok(!program.triggers.some((trigger) => trigger.uid === '#t_unused'));
  });
});

describe('language: chat, teams and stacks', () => {
  it('answers chat lines and reads teams', () => {
    const result = compileSource('var log = "";\non chat { log ..= talkerName() .. ":" .. chatText() .. "@" .. team(talker()) .. ";"; }', 't');
    const sim = new Simulation(result.program, { players: [{ slot: 2, name: 'cy', active: true, team: 13 }] });
    sim.tick();
    sim.playerSays(2, 'hi');
    assert.equal(sim.variables['~t_log~'], 'cy:hi@13;');
  });

  it('pops, clears and treats while (true) without break as an end', () => {
    const { get, warnings } = run(`
var list[]; var out = "";
function spin() { while (true) { return 1; } }
on start { push(list, 1); push(list, 2); out = pop(list) .. pop(list) .. len(list); push(list, 3); clear(list); out ..= len(list) .. spin(); }
`);
    assert.equal(get('out'), '21001');
    assert.deepEqual(warnings, []);
  });
});

describe('language: number-like text', () => {
  const NUMBER_LIKE = ['0123456789.', '007', '1.50', '1e3', ' 5', '0x10'];

  it('keeps text that the website editor would turn into a number', () => {
    const source = `var digits = "0123456789.";
var code = "007";
var found = 0;
var matched = "";
on start {
  if (contains("0123456789.", "0")) { found = 1; }
  if (code == "007") { found += 1; }
  match (code) { "007" => { matched = "yes"; } _ => { matched = "no"; } }
}`;
    const { get, program, warnings } = run(source);
    assert.equal(get('digits'), '0123456789.');
    assert.equal(get('code'), '007');
    assert.equal(get('found'), 2);
    assert.equal(get('matched'), 'yes');
    assert.deepEqual(warnings, []);
    const values = program.triggers.flatMap((trigger) => trigger.actions.flatMap((action) => [action.targetA, action.targetB]));
    for (const text of NUMBER_LIKE.slice(0, 2)) assert.ok(!values.includes(text));
  });

  it('protects every number-like text that is not the number itself', () => {
    for (const text of NUMBER_LIKE) {
      const { get, program } = run(`var value = "${text}";\non start { say(value); }`);
      assert.equal(get('value'), text);
      assert.ok(!program.triggers.some((trigger) => trigger.actions.some((action) => action.targetB === text)));
    }
    const raw = run('var value = "007";\non start { say(value); }', 1, { protectNumberText: false });
    assert.equal(raw.get('value'), '007');
    assert.ok(raw.program.triggers.some((trigger) => trigger.actions.some((action) => action.targetB === '007')));
    assert.ok(raw.warnings.some((warning) => warning.includes('--no-number-text')));
    const { program } = run('var value = "12";\non start { say(value); }');
    assert.ok(program.triggers.some((trigger) => trigger.actions.some((action) => action.targetB === '12')));
  });
});

describe('language: match and math builtins', () => {
  it('reads the killer, the match and the map, and computes angles', () => {
    const { get } = run('var k = 0; var mp = 0; var map = ""; var s = 0; var c = 0; var a = 0;\non start { k = killer(); mp = multiplayer(); map = mapId(); s = sin(0); c = cos(0); a = atan2(1, 1); }', 1, {}, { killerSlot: 2, multiplayer: true, mapId: 'castle' });
    assert.deepEqual([get('k'), get('mp'), get('map'), get('s'), get('c'), get('a')], [2, 1, 'castle', 0, 1, Math.PI / 4]);
  });

  it('works out trigonometry while compiling', () => {
    const { get, program } = run('const RIGHT = acos(0) * 2;\nvar right = RIGHT;\non start { }');
    assert.equal(get('right'), String(Math.PI));
    assert.ok(!program.triggers.some((trigger) => trigger.actions.some((action) => action.opcode === 205)));
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
    error('var n = 2;\nvar s = drop("abc", n);\non start { n += 1; }', /drop\(\.\.\.\) must be a whole number/);
    error('function len(x) { return 1; }', /"len" is a builtin/);
    error('on start { wait(0); }', /"wait" needs a whole number/);
    error('every 5 { return 1; }', /only functions return a value/);
    error('on start { 1 = 2; }', /only a variable or an array element can be assigned/);
    error('on foo { }', /unknown event "foo"/);
  });
});
