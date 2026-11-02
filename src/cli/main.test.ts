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

  it('derives names from a seed, reproducibly and apart from --prefix', () => {
    const folder = tempFolder();
    const source = path.join(folder, 's.ptc');
    fs.writeFileSync(source, 'var n = 0;\non start { n += 1; say("hi"); }\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--name-seed', '42'], output), 0);
    const first = fs.readFileSync(path.join(folder, 's.xml'), 'utf8');
    assert.match(first, /uid="#z[0-9a-z]+:start"/);
    assert.doesNotMatch(first, /#s[_:]/);
    assert.equal(main([source, '--out', folder, '--name-seed', '42'], output), 0);
    assert.equal(fs.readFileSync(path.join(folder, 's.xml'), 'utf8'), first);
    assert.equal(main([source, '--out', folder, '--name-seed', '99'], output), 0);
    assert.notEqual(fs.readFileSync(path.join(folder, 's.xml'), 'utf8'), first);
    assert.equal(main([source, '--out', folder, '--name-seed', '1', '--prefix', 'p'], output), 1);
    assert.match(lines.err.at(-1) ?? '', /--name-seed and --prefix cannot be used together/);
  });

  it('obfuscates with a seed, writes the name record and updates a map in place', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'o.ptc');
    const host = path.join(folder, 'host.xml');
    fs.writeFileSync(host, '<player x="0" y="0" />\n<door uid="#gate1" x="0" y="0" />\n');
    fs.writeFileSync(source, 'var counter = 0;\non start { while (counter < 3) { counter += 1; } say("counted {counter}"); }\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--obfuscate-seed', 'a', '--into', host, '--run'], output), 0, lines.err.join('\n'));
    const xml = fs.readFileSync(path.join(folder, 'o.xml'), 'utf8');
    assert.ok(!xml.includes('counter') && !xml.includes('counted') && !xml.includes('#o:'));
    assert.ok(lines.out.includes('  chat: counted 3'));
    assert.ok(lines.err.some((line) => line.includes('trigger order')));
    const record = JSON.parse(fs.readFileSync(path.join(folder, 'o.names.json'), 'utf8')) as { prefix: string; names: { game: string; source: string }[] };
    assert.ok(record.names.some((entry) => entry.source === `~${record.prefix}_counter`));
    assert.equal(main([source, '--out', folder, '--obfuscate-seed', 'a'], output), 0);
    assert.equal(fs.readFileSync(path.join(folder, 'o.xml'), 'utf8'), xml);
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'o.build.json'), 'utf8')) as { uids: string[] };
    fs.copyFileSync(path.join(folder, 'o-map.xml'), host);
    assert.equal(main([source, '--out', folder, '--obfuscate-seed', 'b', '--into', host, '--replace'], output), 0);
    const merged = fs.readFileSync(path.join(folder, 'o-map.xml'), 'utf8');
    assert.ok(merged.includes('#gate1'));
    for (const uid of manifest.uids) assert.ok(!merged.includes(`"${uid}"`), `stale ${uid}`);
  });

  it('picks a random seed when asked, prints it and builds the same again with it', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'r.ptc');
    fs.writeFileSync(source, 'var counter = 0;\non start { counter += 1; say("hi {counter}"); }\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--obfuscate-seed', 'random'], output), 0, lines.err.join('\n'));
    const record = JSON.parse(fs.readFileSync(path.join(folder, 'r.names.json'), 'utf8')) as { seed: string };
    assert.notEqual(record.seed, 'random');
    assert.ok(lines.out.some((line) => line.includes(`Obfuscation seed: ${record.seed}`)));
    const first = fs.readFileSync(path.join(folder, 'r.xml'), 'utf8');
    assert.equal(main([source, '--out', folder, '--obfuscate-seed', record.seed], output), 0);
    assert.equal(fs.readFileSync(path.join(folder, 'r.xml'), 'utf8'), first);
    assert.equal(main([source, '--out', folder, '--obfuscate-seed', 'random'], output), 0);
    assert.notEqual(fs.readFileSync(path.join(folder, 'r.xml'), 'utf8'), first);
  });

  it('records a build manifest and replaces across renamed builds', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'm.ptc');
    const host = path.join(folder, 'host.xml');
    fs.writeFileSync(host, '<player x="0" y="0" />\n<door uid="#gate1" x="0" y="0" />\n');
    fs.writeFileSync(source, 'var n = 0;\non start { n += 1; say("v1"); }\n');
    const { output } = capture();
    assert.equal(main([source, '--out', folder, '--name-seed', '1', '--into', host], output), 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'm.build.json'), 'utf8')) as { prefix: string; uids: string[] };
    assert.ok(manifest.uids.length >= 1 && manifest.uids.every((uid) => uid.startsWith(`#${manifest.prefix}`)));
    fs.copyFileSync(path.join(folder, 'm-map.xml'), host);
    fs.writeFileSync(source, 'var n = 0;\nvar tag = "v2";\non start { n += 2; say("v2"); }\n');
    assert.equal(main([source, '--out', folder, '--name-seed', '2', '--into', host, '--replace'], output), 0);
    const merged = fs.readFileSync(path.join(folder, 'm-map.xml'), 'utf8');
    assert.ok(merged.includes('#gate1') && merged.includes('"v2"') && !merged.includes('"v1"'));
    for (const uid of manifest.uids) assert.ok(!merged.includes(uid), `stale ${uid}`);
  });

  it('updates a program already in a map with --replace, keeping other elements', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'p.ptc');
    const host = path.join(folder, 'host.xml');
    fs.writeFileSync(host, '<player x="0" y="0" />\n<door uid="#gate1" x="0" y="0" />\n<trigger uid="#mine" x="0" y="0" enabled="true" maxcalls="1" />\n');
    fs.writeFileSync(source, 'var n = 0;\non start { for (let i = 0; i < 3; i += 1) { n += 1; } say("v1"); }\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--prefix', 'p', '--out', folder, '--into', host], output), 0);
    fs.copyFileSync(path.join(folder, 'p-map.xml'), host);
    assert.equal(main([source, '--prefix', 'p', '--out', folder, '--into', host], output), 1);
    assert.match(lines.err.at(-1) ?? '', /already has an object with uid #p:start/);
    fs.writeFileSync(source, 'var n = 0;\nvar tag = "v2";\non start { for (let i = 0; i < 7; i += 1) { n += 1; } say("v2"); }\n');
    assert.equal(main([source, '--prefix', 'p', '--out', folder, '--into', host, '--replace'], output), 0);
    const merged = fs.readFileSync(path.join(folder, 'p-map.xml'), 'utf8');
    assert.ok(merged.includes('#gate1') && merged.includes('#mine'));
    assert.ok(merged.includes('"v2"') && !merged.includes('"v1"'));
    assert.equal(main([source, '--out', folder, '--replace'], output), 1);
    assert.match(lines.err.at(-1) ?? '', /--replace needs --into/);
  });

  it('builds element names without scanning variables with --direct-index', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'd.ptc');
    fs.writeFileSync(source, 'var list[];\non start { for (let i = 0; i < 3; i += 1) { push(list, i * 2); } say(list[len(list) - 1]); }\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--run'], output), 0);
    assert.match(fs.readFileSync(path.join(folder, 'd.xml'), 'utf8'), /_type="326"/);
    assert.equal(main([source, '--out', folder, '--run', '--direct-index'], output), 0);
    assert.doesNotMatch(fs.readFileSync(path.join(folder, 'd.xml'), 'utf8'), /_type="326"/);
    assert.equal(lines.out.filter((line) => line.includes('chat: 4')).length, 2);
  });

  it('compiles to p-code with --target pcode and refuses unknown targets', () => {
    const folder = tempFolder();
    const source = path.join(folder, 'v.ptc');
    fs.writeFileSync(source, 'var total = 0;\non start { for (let i = 1; i <= 4; i += 1) { total += i; } say("total {total}"); }\n');
    const { lines, output } = capture();
    assert.equal(main([source, '--out', folder, '--run', '--target', 'pcode'], output), 0);
    assert.ok(lines.out.some((line) => line.includes('chat: total 10')));
    assert.match(fs.readFileSync(path.join(folder, 'v.xml'), 'utf8'), /#v:vm\.loop/);
    assert.equal(main([source, '--out', folder, '--target', 'bytecode'], output), 1);
    assert.match(lines.err.at(-1) ?? '', /--target needs triggers or pcode/);
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
