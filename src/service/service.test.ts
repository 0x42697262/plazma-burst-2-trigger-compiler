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

  it('knows map blocks: symbols, constructors, properties and their values', () => {
    const source = ['map {', '  gate = Door("#d", maxspeed: 5);', '  let local = 1;', '  gate.', '  Actor("#e", botaction: Do', '  gate.vis = ', '}'].join('\n');
    assert.deepEqual(symbols(source).map((entry) => [entry.name, entry.kind]), [['gate', 'object']]);
    const properties = complete(source, { line: 3, column: 7 }, MAIN, read);
    assert.ok(properties.some((item) => item.label === 'maxspeed' && item.kind === 'property'));
    const values = complete(source, { line: 4, column: 28 }, MAIN, read).map((item) => item.label);
    assert.ok(values.includes('DoNothing'));
    const bools = complete(source, { line: 5, column: 13 }, MAIN, read).map((item) => item.label);
    assert.ok(bools.includes('true'));
    const named = complete('map { Door("#d", ', { line: 0, column: 17 }, MAIN, read);
    assert.ok(named.some((item) => item.insertText === 'maxspeed: '));
    assert.ok(complete('', { line: 0, column: 0 }, MAIN, read).some((item) => item.label === 'EngineMark'));
    assert.match(hover(source, { line: 1, column: 10 }, MAIN, read) ?? '', /Door\(uid, \.\.\.\)\*\* creates a `<door>`/);
    assert.match(hover(source, { line: 1, column: 22 }, MAIN, read) ?? '', /\*\*maxspeed\*\* \(Speed\): a number of 0 or more, editor default `10`/);
    assert.match(hover(source, { line: 5, column: 8 }, MAIN, read) ?? '', /\*\*vis\*\* \(Visible\)/);
  });
});

