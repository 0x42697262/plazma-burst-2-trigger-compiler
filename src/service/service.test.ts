import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { complete, definition, diagnose, hover, symbols } from './service.ts';

const FILES: Record<string, string> = {
  '/w/lib/tools.ptc': 'function shout(text) {\n  return text .. "!";\n}\nfunction broken() {\n  missing = 1;\n}\n',
};
const read = (file: string): string | null => FILES[file] ?? null;
const MAIN = '/w/main.ptc';

const SOURCE = [
  'import "lib/tools.ptc";',
  'var score = 0;',
  'region spawn = "#spawn";',
  'function add(points) {',
  '  score += points;',
  '}',
  'on start {',
  '  add(5);',
  '  say(shout("x"), Color.NoirLime);',
  '  action(SetCharHP, "#player*0", 100);',
  '}',
].join('\n');

describe('language service', () => {
  it('reports errors and warnings on their lines', () => {
    assert.deepEqual(diagnose('var x = 1;\non start {\n  y = 2;\n}', MAIN, read), [{ line: 2, message: 'unknown variable "y"', severity: 'error' }]);
    const warnings = diagnose('function unused() { }\non start { }', MAIN, read);
    assert.deepEqual(warnings, [{ line: 0, message: 'the function "unused" is never called; it was left out', severity: 'warning' }]);
  });

  it('puts an error in an imported file on the import line', () => {
    const errors = diagnose('import "lib/tools.ptc";\non start { broken(); }', MAIN, read);
    assert.deepEqual(errors, [{ line: 0, message: 'lib/tools.ptc line 5: unknown variable "missing"', severity: 'error' }]);
  });

  it('completes value members, actions, and declared names', () => {
    const members = complete('say("x", Color.No', { line: 0, column: 17 }, MAIN, read);
    assert.ok(members.some((item) => item.label === 'NoirLime' && item.detail === '2'));
    const actions = complete('action(SetCh', { line: 0, column: 12 }, MAIN, read);
    assert.ok(actions.some((item) => item.label === 'SetCharHP' && item.detail === 'action 23'));
    const names = complete(SOURCE, { line: 7, column: 2 }, MAIN, read).map((item) => item.label);
    for (const expected of ['add', 'score', 'spawn', 'shout', 'match', 'say', 'Color', 'region']) assert.ok(names.includes(expected), expected);
  });

  it('explains builtins, values, actions and declarations on hover', () => {
    assert.match(hover(SOURCE, { line: 8, column: 3 }, MAIN, read) ?? '', /say\(text, color\?\)/);
    assert.match(hover(SOURCE, { line: 8, column: 25 }, MAIN, read) ?? '', /Color\.NoirLime\*\* = `2`/);
    assert.match(hover(SOURCE, { line: 9, column: 12 }, MAIN, read) ?? '', /action 23/);
    assert.match(hover(SOURCE, { line: 7, column: 3 }, MAIN, read) ?? '', /function add\(points\)/);
    assert.match(hover(SOURCE, { line: 8, column: 8 }, MAIN, read) ?? '', /function shout\(text\)/);
  });

  it('goes to definitions, also in imported files', () => {
    assert.deepEqual(definition(SOURCE, { line: 7, column: 3 }, MAIN, read), { file: MAIN, line: 3, column: 9 });
    assert.deepEqual(definition(SOURCE, { line: 4, column: 13 }, MAIN, read), { file: MAIN, line: 3, column: 13 });
    assert.deepEqual(definition(SOURCE, { line: 8, column: 8 }, MAIN, read), { file: '/w/lib/tools.ptc', line: 0, column: 9 });
  });

  it('lists the top-level symbols', () => {
    assert.deepEqual(symbols(SOURCE).map((entry) => [entry.name, entry.kind, entry.line]), [
      ['score', 'variable', 1], ['spawn', 'object', 2], ['add', 'function', 3], ['on start', 'event', 6],
    ]);
  });
});
