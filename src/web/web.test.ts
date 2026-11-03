import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from './workspace.ts';
import { build, parseEnvironment, prefixFor, simulate } from './pipeline.ts';
import { collectExamples } from '../tools/build-web/build.ts';
import path from 'node:path';
import fs from 'node:fs';

const examples = collectExamples(path.resolve(import.meta.dirname, '..', '..', 'examples'));
const OPTIONS = { prefix: '', guard: 100000, frames: 300, numberText: true, directIndex: false, target: 'triggers' as const, replace: false, nameSeed: '', obfuscate: false, obfuscateSeed: '', tamper: 'off' as const, tamperSeed: '', tamperAnnounce: false };

describe('web page logic', () => {
  it('bundles every example and loads one with its imports', () => {
    assert.ok(examples['/examples/tutorial/11-infix.ptc']);
    assert.ok(examples['/examples/tutorial/lib/tokenizer.ptc']);
    const workspace = new Workspace(null);
    workspace.loadExample(examples, '/examples/tutorial/11-infix.ptc');
    assert.deepEqual(workspace.list(), ['/work/11-infix.ptc', '/work/lib/tokenizer.ptc']);
    assert.equal(workspace.active, '/work/11-infix.ptc');
  });

  it('opens examples next to the open files and never overwrites a changed file', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'on start { say("mine"); }\n');
    workspace.loadExample(examples, '/examples/tutorial/11-infix.ptc');
    workspace.loadExample(examples, '/examples/tutorial/01-hello.ptc');
    assert.deepEqual(workspace.list(), ['/work/01-hello.ptc', '/work/11-infix.ptc', '/work/lib/tokenizer.ptc', '/work/main.ptc']);
    assert.equal(workspace.active, '/work/01-hello.ptc');
    workspace.loadExample(examples, '/examples/tutorial/11-infix.ptc');
    assert.equal(workspace.list().length, 4);
    assert.equal(workspace.active, '/work/11-infix.ptc');
    workspace.set('/work/11-infix.ptc', '// my changes\n');
    workspace.loadExample(examples, '/examples/tutorial/11-infix.ptc');
    assert.equal(workspace.get('/work/11-infix.ptc'), '// my changes\n');
    assert.equal(workspace.active, '/work/11-infix/11-infix.ptc');
    assert.ok(workspace.get('/work/11-infix/lib/tokenizer.ptc'));
    workspace.set('/work/11-infix/11-infix.ptc', '// more changes\n');
    workspace.loadExample(examples, '/examples/tutorial/11-infix.ptc');
    assert.equal(workspace.active, '/work/11-infix-2/11-infix.ptc');
    assert.equal(workspace.get('/work/main.ptc'), 'on start { say("mine"); }\n');
  });

  it('compiles, runs and appends to a map in the browser pipeline', () => {
    const workspace = new Workspace(null);
    workspace.loadExample(examples, '/examples/tutorial/11-infix.ptc');
    const result = build(workspace, workspace.active, OPTIONS, '<player x="0" y="0" />\n');
    assert.deepEqual(result.problems, []);
    assert.match(result.xml, /^<trigger uid="#infix:start"/);
    assert.match(result.map, /^<player x="0" y="0" \/>\n<trigger/);
    assert.equal(simulate(result.result!, 1)[0], 'chat: 3 4 2 * + = 11');
    assert.equal(prefixFor('/work/11-infix.ptc'), 'infix');
  });

  it('derives names from a seed and replaces across renamed builds with the recorded uids', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'var n = 0;\non start { n += 1; say("v1"); }\n');
    workspace.activate('/work/main.ptc');
    const host = '<player x="0" y="0" />\n<door uid="#gate1" x="0" y="0" />\n';
    const first = build(workspace, '/work/main.ptc', { ...OPTIONS, nameSeed: '1' }, host);
    assert.match(first.map, /uid="#z[0-9a-z]+:start"/);
    assert.ok(first.uids.length >= 1);
    const withBuild = first.map;
    workspace.set('/work/main.ptc', 'var n = 0;\nvar tag = "v2";\non start { n += 2; say("v2"); }\n');
    const second = build(workspace, '/work/main.ptc', { ...OPTIONS, nameSeed: '2', replace: true }, withBuild, {}, { uids: first.uids, walls: first.walls });
    assert.ok(second.map.includes('#gate1') && second.map.includes('"v2"') && !second.map.includes('"v1"'));
    for (const uid of first.uids) assert.ok(!second.map.includes(uid), `stale ${uid}`);
  });

  it('obfuscates with a seed and updates the map in place across seeds', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'var n = 0;\non start { while (n < 3) { n += 1; } say("count {n}"); }\n');
    workspace.activate('/work/main.ptc');
    const host = '<player x="0" y="0" />\n<door uid="#gate1" x="0" y="0" />\n';
    const first = build(workspace, '/work/main.ptc', { ...OPTIONS, obfuscate: true, obfuscateSeed: 'a' }, host);
    assert.deepEqual(first.problems, []);
    assert.equal(simulate(first.result!, 1)[0], 'chat: count 3');
    assert.ok(!first.xml.includes('count'));
    const second = build(workspace, '/work/main.ptc', { ...OPTIONS, obfuscate: true, obfuscateSeed: 'b', replace: true }, first.map, {}, { uids: first.uids, walls: first.walls });
    assert.equal(simulate(second.result!, 1)[0], 'chat: count 3');
    for (const uid of first.uids) assert.ok(!second.map.includes(`"${uid}"`), `stale ${uid}`);
    const order = [...second.map.matchAll(/<trigger uid="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(order, second.result!.program.triggers.map((trigger) => trigger.uid));
    assert.ok(second.notes.some((note) => note.includes('trigger order')));
  });

  it('adds the tamper check and checks protected values in the editor', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'protected var gold = 1;\non start { gold += 1; say("gold {gold}"); }\n');
    workspace.activate('/work/main.ptc');
    const plain = build(workspace, '/work/main.ptc', OPTIONS, null);
    assert.ok(plain.problems.some((problem) => problem.message.includes('nothing checks it')));
    const checked = build(workspace, '/work/main.ptc', { ...OPTIONS, tamper: 'enforce' }, null);
    assert.deepEqual(checked.problems, []);
    assert.notEqual(checked.result?.tamper, null);
    assert.equal(simulate(checked.result!, 1)[0], 'chat: gold 2');
    assert.equal(build(workspace, '/work/main.ptc', { ...OPTIONS, tamper: 'enforce' }, null).xml, checked.xml);
  });

  it('picks a random seed when asked and shows it', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'var n = 0;\non start { n += 1; say("n {n}"); }\n');
    workspace.activate('/work/main.ptc');
    const first = build(workspace, '/work/main.ptc', { ...OPTIONS, obfuscate: true, obfuscateSeed: 'random' }, null);
    const second = build(workspace, '/work/main.ptc', { ...OPTIONS, obfuscate: true, obfuscateSeed: 'Random' }, null);
    const seed = /Obfuscation seed: (\S+)\./.exec(first.notes.join('\n'))?.[1] ?? '';
    assert.notEqual(seed, '');
    assert.notEqual(first.xml, second.xml);
    assert.equal(build(workspace, '/work/main.ptc', { ...OPTIONS, obfuscate: true, obfuscateSeed: seed }, null).xml, first.xml);
    assert.equal(simulate(first.result!, 1)[0], 'chat: n 1');
  });

  it('writes map block objects, and updates the host map in place', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'map {\n  slots = [];\n  for (let i = 1; i <= 16; i += 1) { push(slots, Player("#player*{i}", x: i * 10, y: 0)); }\n  gate = Door("#gate", maxspeed: 50);\n  gate.x ?= 5;\n  Wall(0, 100, 50, 10);\n}\non start { action(SetCharHP, slots[0], 50); action(MovableTo, gate, "#r"); }\n');
    workspace.activate('/work/main.ptc');
    const fresh = build(workspace, '/work/main.ptc', OPTIONS, null);
    assert.deepEqual(fresh.problems.filter((problem) => problem.severity === 'error'), []);
    assert.equal((fresh.xml.match(/<player uid="#player\*/g) ?? []).length, 16);
    assert.ok(fresh.xml.includes('<door uid="#gate" x="5" y="'));
    assert.ok(fresh.xml.includes('<box x="0" y="100" w="50" h="10" m="0" />'));
    assert.ok(fresh.notes.some((note) => note.includes('#player*16')));
    const host = '<player uid="#player*1" x="7" y="0" />\n<door uid="#gate" x="300" y="0" w="10" h="10" maxspeed="10" />\n';
    const merged = build(workspace, '/work/main.ptc', { ...OPTIONS, replace: true }, host);
    assert.equal((merged.map.match(/uid="#player\*1"/g) ?? []).length, 1);
    assert.ok(merged.map.includes('<player uid="#player*1" x="10" y="0" />'));
    assert.ok(merged.map.includes('<door uid="#gate" x="300" y="0" w="10" h="10" maxspeed="50" />'));
    assert.ok(merged.notes.includes('#gate: maxspeed 10 → 50'));
    const again = build(workspace, '/work/main.ptc', { ...OPTIONS, replace: true }, merged.map, {}, { uids: merged.uids, walls: merged.walls });
    assert.equal((again.map.match(/<box /g) ?? []).length, 1);
    const lines = (map: string): string[] => map.split('\n').sort();
    assert.deepEqual(lines(again.map), lines(merged.map));
    assert.deepEqual(again.notes.filter((note) => note.includes('→')), []);
  });

  it('refuses a host object the map lacks, naming the map block line to write', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'door gate = "#gate";\non start { action(MovableTo, gate, "#r"); }\n');
    workspace.activate('/work/main.ptc');
    const result = build(workspace, '/work/main.ptc', OPTIONS, '<player x="0" y="0" />\n');
    assert.equal(result.map, '');
    assert.match(result.notes.join('\n'), /map \{ gate = Door\("#gate"\); \}/);
  });

  it('replaces an older build of the program in the host map when asked', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'var n = 0;\non start { n += 1; say("later"); }\n');
    workspace.activate('/work/main.ptc');
    const host = '<player x="0" y="0" />\n<door uid="#gate1" x="0" y="0" />\n<trigger uid="#main:start" x="0" y="0" enabled="true" maxcalls="-1" actions_1_type="100" actions_1_targetA="~main_n~" actions_1_targetB="9" />\n';
    const clash = build(workspace, '/work/main.ptc', OPTIONS, host);
    assert.match(clash.notes.join('\n'), /already has an object with uid #main:start/);
    const replaced = build(workspace, '/work/main.ptc', { ...OPTIONS, replace: true }, host);
    assert.ok(replaced.map.includes('#gate1'));
    assert.ok(replaced.map.includes('"later"') && !replaced.map.includes('actions_1_targetB="9"'));
    assert.equal((replaced.map.match(/uid="#main:start"/g) ?? []).length, 1);
  });

  it('writes number-like text as it is when the site editor option is off', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'var code = "007";\non start { say(code); }\n');
    const kept = build(workspace, '/work/main.ptc', OPTIONS, null);
    assert.match(kept.xml, /"_007"/);
    assert.deepEqual(kept.result?.warnings, []);
    const raw = build(workspace, '/work/main.ptc', { ...OPTIONS, numberText: false }, null);
    assert.match(raw.xml, /"007"/);
    assert.doesNotMatch(raw.xml, /_007/);
    assert.ok(raw.result?.warnings.some((warning) => warning.includes('website editor')));
  });

  it('reads the standard library from the bundle', () => {
    const workspace = new Workspace(null, { 'std:hash.ptc': fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'std', 'hash.ptc'), 'utf8') });
    workspace.set('/work/main.ptc', 'import "std/hash.ptc";\nconst H = hash("abcd");\non start { say(H); }\n');
    const result = build(workspace, '/work/main.ptc', OPTIONS, null);
    assert.deepEqual(result.problems.filter((problem) => problem.severity === 'error'), []);
    assert.match(simulate(result.result!, 1)[0] ?? '', /^chat: \d+-\d+-\d+$/);
  });

  it('reads env() values from the environment box', () => {
    assert.deepEqual(parseEnvironment('MAP_PASSWORD=open sesame\n# a note\n\n EXTRA = a=b\nbroken'), { MAP_PASSWORD: 'open sesame', EXTRA: ' a=b' });
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'secret const PASSWORD = env("MAP_PASSWORD");\nconst SIZE = len(PASSWORD);\non start { say("{SIZE}"); }\n');
    const missing = build(workspace, '/work/main.ptc', OPTIONS, null);
    assert.match(missing.problems[0]?.message ?? '', /MAP_PASSWORD is not set/);
    const given = build(workspace, '/work/main.ptc', OPTIONS, null, parseEnvironment('MAP_PASSWORD=open sesame'));
    assert.equal(simulate(given.result!, 1)[0], 'chat: 11');
    assert.doesNotMatch(given.xml, /open sesame/);
  });

  it('reports problems instead of output', () => {
    const workspace = new Workspace(null);
    workspace.set('/work/main.ptc', 'on start {\n  oops = 1;\n}\n');
    workspace.activate('/work/main.ptc');
    const result = build(workspace, '/work/main.ptc', OPTIONS, null);
    assert.equal(result.result, null);
    assert.deepEqual(result.problems, [{ file: '/work/main.ptc', line: 1, message: 'unknown variable "oops"', severity: 'error' }]);
  });
});
