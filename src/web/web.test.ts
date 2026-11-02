import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from './workspace.ts';
import { build, parseEnvironment, prefixFor, simulate } from './pipeline.ts';
import { collectExamples } from '../tools/build-web/build.ts';
import path from 'node:path';
import fs from 'node:fs';

const examples = collectExamples(path.resolve(import.meta.dirname, '..', '..', 'examples'));
const OPTIONS = { prefix: '', guard: 100000, frames: 300, numberText: true, directIndex: false, target: 'triggers' as const, replace: false };

describe('web page logic', () => {
  it('bundles every example and loads one with its imports', () => {
    assert.ok(examples['/examples/tutorial/11-infix.ptc']);
    assert.ok(examples['/examples/tutorial/lib/tokenizer.ptc']);
    const workspace = new Workspace(null);
    workspace.loadExample(examples, '/examples/tutorial/11-infix.ptc');
    assert.deepEqual(workspace.list(), ['/work/11-infix.ptc', '/work/lib/tokenizer.ptc']);
    assert.equal(workspace.active, '/work/11-infix.ptc');
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
