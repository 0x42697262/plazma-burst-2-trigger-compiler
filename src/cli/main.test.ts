import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, prefixFromFile } from './main.ts';

const capture = () => {
  const lines = { out: [] as string[], err: [] as string[] };
  return { lines, output: { out: (line: string) => lines.out.push(line), err: (line: string) => lines.err.push(line) } };
};

describe('compile CLI', () => {
  it('derives a prefix from the file name', () => {
    assert.equal(prefixFromFile('dir/my-game_2.pasm'), 'mygame2');
    assert.equal(prefixFromFile('9lives.ptc'), 'lives');
    assert.equal(prefixFromFile('___.ptc'), 'ptc');
  });

  it('writes XML, text, source map and the merged map, and runs the simulator', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ptc-'));
    const source = path.join(folder, 'demo.pasm');
    const map = path.join(folder, 'host.xml');
    fs.writeFileSync(source, 'start:\n    set $x, 2\n    say "x={$x}"\n');
    fs.writeFileSync(map, '<player x="0" y="0" />\n');
    const { lines, output } = capture();
    const code = main([source, '--out', folder, '--into', map, '--run'], output);
    assert.equal(code, 0, lines.err.join('\n'));
    for (const suffix of ['.xml', '.txt', '.map.json', '-map.xml']) assert.ok(fs.existsSync(path.join(folder, `demo${suffix}`)), suffix);
    assert.ok(lines.out.includes('  ~demo_x~ = 2'));
    assert.ok(lines.out.includes('  chat: x=2'));
  });

  it('prints errors and returns 1', () => {
    const { lines, output } = capture();
    assert.equal(main([], output), 1);
    assert.match(lines.err[0] ?? '', /No input file/);
    assert.equal(main(['x.pasm', '--guard', '0'], output), 1);
    assert.equal(main(['x.pasm', '--noguard'], output), 1);
    assert.match(lines.err.at(-1) ?? '', /Unknown option --noguard/);
    assert.equal(main(['a.pasm', 'b.pasm'], output), 1);
    assert.match(lines.err.at(-1) ?? '', /one input file/);
  });

  it('places triggers with --at, checks --frames and notes missing timers in the text', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ptc-'));
    const source = path.join(folder, 'p.pasm');
    fs.writeFileSync(source, 'start:\n    ret\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--at', '1000,-500'], output), 0);
    assert.match(fs.readFileSync(path.join(folder, 'p.xml'), 'utf8'), /x="1000" y="-500"/);
    assert.ok(lines.err.some((line) => line.includes('the trigger text has no timers')));
    assert.equal(main([source, '--run', '--frames', '0'], output), 1);
    assert.match(lines.err.at(-1) ?? '', /--frames needs/);
    assert.equal(main([source, '--at', '5'], output), 1);
  });

  it('removes an old text file when the new program cannot be written as text', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ptc-'));
    const source = path.join(folder, 'c.pasm');
    const { lines, output } = capture();
    fs.writeFileSync(source, 'start:\n    say "v1"\n');
    assert.equal(main([source, '--out', folder], output), 0);
    fs.writeFileSync(source, 'start:\n    say "v2\\nline"\n');
    assert.equal(main([source, '--out', folder], output), 0);
    assert.equal(fs.existsSync(path.join(folder, 'c.txt')), false);
    assert.ok(lines.err.some((line) => line.includes('no trigger text written')));
  });
});
