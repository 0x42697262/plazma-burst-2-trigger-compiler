import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, prefixFromFile } from './main.ts';

const folders: string[] = [];
const tempFolder = (): string => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ptc-test-'));
  folders.push(folder);
  return folder;
};
after(() => {
  for (const folder of folders) fs.rmSync(folder, { recursive: true, force: true });
});

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
    const folder = tempFolder();
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
    const folder = tempFolder();
    const source = path.join(folder, 'p.pasm');
    fs.writeFileSync(source, 'start:\n    ret\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--at', '1000,-500'], output), 0);
    assert.match(fs.readFileSync(path.join(folder, 'p.xml'), 'utf8'), /x="1000" y="-500"/);
    assert.ok(lines.err.some((line) => line.includes('the trigger text has no timers')));
    const empty = tempFolder();
    assert.equal(main([source, '--out', empty, '--run', '--frames', '0'], output), 1);
    assert.match(lines.err.at(-1) ?? '', /--frames needs/);
    assert.equal(main([source, '--out', empty, '--at', '5'], output), 1);
    assert.deepEqual(fs.readdirSync(empty), []);
  });

  it('adds the Var Sync mark unless the host map has one or --no-sync-mark is given', () => {
    const folder = tempFolder();
    const source = path.join(folder, 's.ptc');
    const host = path.join(folder, 'host.xml');
    fs.writeFileSync(source, 'var x = 1;\non start { sync(x); }\n');
    fs.writeFileSync(host, '<player x="0" y="0" />\n<inf x="0" y="0" mark="var_sync" forteam="0" />\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder], output), 0);
    assert.match(fs.readFileSync(path.join(folder, 's.xml'), 'utf8'), /mark="var_sync"/);
    assert.ok(lines.err.some((line) => line.includes('add a Var Sync engine mark')));
    assert.equal(main([source, '--out', folder, '--into', host], output), 0);
    assert.doesNotMatch(fs.readFileSync(path.join(folder, 's.xml'), 'utf8'), /var_sync/);
    assert.equal(fs.readFileSync(path.join(folder, 's-map.xml'), 'utf8').match(/var_sync/g)?.length, 1);
    assert.equal(main([source, '--out', folder, '--no-sync-mark'], output), 0);
    assert.doesNotMatch(fs.readFileSync(path.join(folder, 's.xml'), 'utf8'), /var_sync/);
    assert.ok(lines.err.some((line) => line.includes('no Var Sync engine mark is added')));
  });

  it('writes number-like text as it is with --no-number-text', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'n.ptc');
    fs.writeFileSync(source, 'var code = "007";\non start { say(code); }\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder], output), 0);
    assert.match(fs.readFileSync(path.join(folder, 'n.xml'), 'utf8'), /"_007"/);
    assert.equal(main([source, '--out', folder, '--no-number-text'], output), 0);
    assert.match(fs.readFileSync(path.join(folder, 'n.xml'), 'utf8'), /"007"/);
    assert.ok(lines.err.some((line) => line.includes('website editor turns the value "007"')));
  });

  it('adds declared objects the host map lacks, and only those', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'o.ptc');
    const host = path.join(folder, 'host.xml');
    fs.writeFileSync(source, [
      'water pool = "#water*1";', 'region spawn = "#SPAWN1";', 'door gate = "#door*7" at 50, -60;', 'gun rifle = "#gun*9";',
      'on start { action(MovableTo, gate, spawn); action(395, pool, 5); action(SetGunPower, rifle, 2); }', '',
    ].join('\n'));
    fs.writeFileSync(host, '<player x="0" y="0" />\n<water uid="#water*1" x="0" y="0" w="10" h="10" damage="0" friction="true" />\n<region uid="#SPAWN1" x="0" y="0" w="10" h="10" use_target="-1" use_on="0" attach="-1" />\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--into', host], output), 0, lines.err.join('\n'));
    const merged = fs.readFileSync(path.join(folder, 'o-map.xml'), 'utf8');
    assert.match(merged, /<door uid="#door\*7" x="50" y="-60" w="10" h="10" moving="false" tarx="0" tary="0" maxspeed="10" vis="true" attach="-1" \/>/);
    assert.match(merged, /<gun uid="#gun\*9" x="\d+" y="\d+" model="gun_rifle" command="-1" upg="0" \/>/);
    assert.equal(merged.match(/uid="#water\*1"/g)?.length, 1);
    assert.equal(merged.match(/uid="#SPAWN1"/g)?.length, 1);
    assert.ok(lines.out.some((line) => line.startsWith('Added door #door*7 at 50, -60')));
    assert.deepEqual(lines.err, ['warning: the trigger text has no timers; in the editor, add timers for: #o:start-timer -> #o:start']);
  });

  it('refuses an object whose uid is another kind in the map, and can skip creating', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'k.ptc');
    const host = path.join(folder, 'host.xml');
    fs.writeFileSync(source, 'water pool = "#water*1";\ndoor gate = "#door*2";\non start { action(395, pool, 5); action(MovableTo, gate, "#r"); }\n');
    fs.writeFileSync(host, '<door uid="#water*1" x="0" y="0" />\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--into', host], output), 1);
    assert.match(lines.err.at(-1) ?? '', /"pool" is declared as water, but #water\*1 in the map is a <door>/);
    fs.writeFileSync(host, '<player x="0" y="0" />\n');
    assert.equal(main([source, '--out', folder, '--into', host, '--no-create'], output), 0);
    assert.doesNotMatch(fs.readFileSync(path.join(folder, 'k-map.xml'), 'utf8'), /<water|<door/);
    assert.ok(lines.err.some((line) => line.includes('the map has no #door*2 for "gate"')));
  });

  it('prints the exported variables and warns about unexported ones the host map uses', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'e.ptc');
    const host = path.join(folder, 'host.xml');
    fs.writeFileSync(source, 'export var score = 0;\nvar hidden = 0;\non start { score = 1; hidden = 2; }\n');
    fs.writeFileSync(host, '<trigger uid="#h" x="0" y="0" enabled="true" maxcalls="-1" actions_1_type="125" actions_1_targetA="~e_hidden~" actions_1_targetB="0" />\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--into', host], output), 0);
    assert.ok(lines.out.includes('Exported variables: score = ~e_score~'));
    assert.ok(lines.err.some((line) => line.includes('The host map uses ~e_hidden~, which the program does not export')));
  });

  it('removes an old text file when the new program cannot be written as text', () => {
    const folder = tempFolder();
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
