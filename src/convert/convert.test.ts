import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { convertMap } from './convert.ts';
import type { Conversion } from './convert.ts';
import { checkConversion } from './check.ts';
import { main } from './main.ts';
import { parseMap } from './map-file.ts';

const MAPS = path.join(os.homedir(), 'Projects', 'plazma-burst-2', 'data', 'maps');

const convert = (xml: string, raw = false): Conversion => convertMap(xml, { style: raw ? 'raw' : 'functions', label: 'test.xml' });
const roundTrip = (xml: string, raw = false): Conversion => {
  const conversion = convert(xml, raw);
  const { report } = checkConversion(conversion, 'test');
  assert.equal(report.compileError, null, conversion.source);
  assert.deepEqual(report.unexpected, [], conversion.source);
  return conversion;
};
const lines = (...elements: string[]): string => elements.join('\n');

describe('map conversion', () => {
  it('reads elements, actions in slot order and XML entities', () => {
    const [trigger] = parseMap('<trigger uid="#t" actions_2_type="42" actions_2_targetA="a &quot;b&quot; &amp;lt;" actions_2_targetB="0" actions_1_type="9" actions_1_targetA="x" actions_1_targetB="y" actions_3_type="-1" actions_3_targetA="0" actions_3_targetB="0" />');
    assert.deepEqual(trigger?.actions, [{ type: 9, targetA: 'x', targetB: 'y' }, { type: 42, targetA: 'a "b" &lt;', targetB: '0' }]);
  });

  it('turns triggers into functions with call guards, and start and repeating timers into on start and every', () => {
    const conversion = roundTrip(lines(
      '<region uid="#region*1" x="0" y="0" w="100" h="100" use_target="#trigger*1" use_on="1" />',
      '<trigger uid="#trigger*1" x="0" y="0" enabled="true" maxcalls="1" actions_1_type="42" actions_1_targetA="Hello {x}" actions_1_targetB="#FF0000" />',
      '<trigger uid="#trigger*2" x="0" y="0" enabled="true" maxcalls="3" actions_1_type="42" actions_1_targetA="Twice" actions_1_targetB="0" />',
      '<trigger uid="#trigger*tick" x="0" y="0" enabled="true" maxcalls="-1" actions_1_type="99" actions_1_targetA="#trigger*2" actions_1_targetB="0" />',
      '<timer uid="#timer*1" x="0" y="0" enabled="true" maxcalls="1" target="#trigger*2" delay="30" />',
      '<timer uid="#timer*2" x="0" y="0" enabled="true" maxcalls="-1" target="#trigger*tick" delay="15" />',
    ));
    assert.match(conversion.source, /Region\("#region\*1", x: 0, y: 0, w: 100, h: 100, use_target: @trigger1/);
    assert.match(conversion.source, /function trigger1\(\) \{\n {2}if \(trigger1Done == 1\) \{ return; \}/);
    assert.match(conversion.source, /say\("Hello \\\{x\\\}", "#FF0000"\);/);
    assert.match(conversion.source, /if \(trigger2Calls == 3\) \{ return; \}/);
    assert.match(conversion.source, /on start \{\n {2}wait\(30\);\n {2}trigger2\(\);\n\}/);
    assert.match(conversion.source, /every 15 \{ tick\(\); \}/);
    assert.match(conversion.source, /action\(ExecTrigger, @trigger2, 0\);/);
  });

  it('keeps triggers raw when other triggers switch them, when disabled, and when a map picks triggers by position', () => {
    const switched = roundTrip(lines(
      '<trigger uid="#trigger*1" enabled="true" maxcalls="-1" actions_1_type="19" actions_1_targetA="#trigger*2" actions_1_targetB="0" />',
      '<trigger uid="#trigger*2" enabled="false" maxcalls="1" actions_1_type="42" actions_1_targetA="off" actions_1_targetB="0" />',
      '<trigger uid="#trigger*3" enabled="true" maxcalls="1" actions_1_type="42" actions_1_targetA="#trigger*1" actions_1_targetB="0" />',
    ));
    assert.deepEqual(switched.plans.map((plan) => plan.kind), ['rawTrigger', 'rawTrigger', 'function']);
    assert.match(switched.source, /Trigger\("#trigger\*2", enabled: false\) \{\n {4}action\(ShowText, "off", 0\);/);
    const positional = roundTrip(lines(
      '<trigger uid="#trigger*1" enabled="true" maxcalls="-1" actions_1_type="362" actions_1_targetA="1" actions_1_targetB="0" />',
      '<trigger uid="#trigger*2" enabled="true" maxcalls="1" actions_1_type="42" actions_1_targetA="two" actions_1_targetB="0" />',
      '<timer uid="#timer*1" enabled="true" maxcalls="1" target="#trigger*2" delay="1" />',
    ));
    assert.deepEqual(positional.plans.map((plan) => plan.kind), ['rawTrigger', 'rawTrigger', 'rawTimer']);
    assert.deepEqual(roundTrip('<trigger uid="#trigger*1" maxcalls="-1" actions_1_type="42" actions_1_targetA="a" actions_1_targetB="0" />', true).plans.map((plan) => plan.kind), ['rawTrigger']);
  });

  it('adds missing uids, renames repeated ones and keeps the last engine mark of a kind', () => {
    const conversion = roundTrip(lines(
      '<door x="0" y="0" w="10" h="10" />',
      '<door uid="#door*1" x="0" y="0" w="10" h="10" />',
      '<door uid="#door*2" x="0" y="0" w="10" h="10" />',
      '<door uid="#door*2" x="5" y="0" w="10" h="10" />',
      '<inf mark="sky" forteam="1" />',
      '<inf mark="sky" forteam="4" />',
    ));
    assert.match(conversion.source, /Door\("#door\*3", x: 0/);
    assert.match(conversion.source, /Door\("#door\*2\*1", x: 5/);
    assert.match(conversion.source, /\/\/ <inf> left out: repeated engine mark/);
    assert.match(conversion.source, /EngineMark\(sky, forteam: "4"\)|EngineMark\(sky, forteam: [A-Za-z.]+\)/);
  });

  it('writes odd values as they are, drops what the game never reads and leaves out unknown tags', () => {
    const conversion = roundTrip(lines(
      '<box x="0" y="0" w="0" h="-20" />',
      '<gun uid="#gun*1" x="0" y="0" upg="10" />',
      '<decor uid="#decor*1" x="0" y="0" model="text" at="1" addx="3" text="a &lt;b&gt; &quot;c&quot;" />',
      '<lamp uid="#light*1" x="0" y="0" flare="0" />',
      '<widget uid="#w" />',
      '<trigger uid="#trigger*1" enabled="true" maxcalls="1" actions_1_type="424" actions_1_targetA="1" actions_1_targetB="2" />',
    ));
    assert.match(conversion.source, /Wall\(0, 0, "0", "-20"\);/);
    assert.match(conversion.source, /upg: "10"/);
    assert.match(conversion.source, /text: "a <b> \\"c\\""/);
    assert.doesNotMatch(conversion.source, /addx/);
    assert.match(conversion.source, /f: "1"/);
    assert.match(conversion.source, /flare: "0"/);
    assert.match(conversion.source, /\/\/ <widget> left out/);
    assert.match(conversion.source, /Trigger\("#trigger\*1"\) \{\n {4}action\(424, 1, 2\);/);
  });

  it('reports differences the source does not explain', () => {
    const conversion = convert('<door uid="#door*1" x="0" y="0" w="10" h="10" />');
    const broken = { ...conversion, source: conversion.source.replace('w: 10', 'w: 11') };
    const { report } = checkConversion(broken, 'test');
    assert.deepEqual(report.unexpected, ['<door #door*1> w: 10 → 11']);
    assert.match(checkConversion({ ...conversion, source: 'map { Door(); }' }, 'test').report.compileError ?? '', /Door/);
  });

  it('writes the source and checks it from the command line', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
    const map = path.join(folder, 'tiny.xml');
    fs.writeFileSync(map, '<door uid="#door*1" x="0" y="0" w="10" h="10" />\n<region uid="#region*1" x="0" y="0" w="10" h="10" use_target="#trigger*1" />\n<trigger uid="#trigger*1" maxcalls="1" actions_1_type="0" actions_1_targetA="#door*1" actions_1_targetB="#region*1" />');
    const out: string[] = [];
    const err: string[] = [];
    const output = { out: (line: string) => out.push(line), err: (line: string) => err.push(line) };
    assert.equal(main([map, '--out', folder, '--check'], output), 0);
    assert.ok(fs.readFileSync(path.join(folder, 'tiny.ptc'), 'utf8').includes('function trigger1()'));
    assert.ok(out.includes('Check passed: the source rebuilds the map.'));
    assert.equal(main(['--nope'], output), 1);
    assert.equal(main([], output), 1);
    assert.equal(main(['--help'], output), 0);
    fs.rmSync(folder, { recursive: true });
  });

  it('writes the live example from its map', () => {
    const xml = fs.readFileSync('examples/convert/convert-map.xml', 'utf8');
    const conversion = convertMap(xml, { style: 'functions', label: 'convert-map.xml' });
    assert.equal(conversion.source, fs.readFileSync('examples/live/convert-map.ptc', 'utf8'));
  });

  it('rebuilds every map in the game repository', { skip: !fs.existsSync(MAPS) }, () => {
    for (const file of fs.readdirSync(MAPS).filter((name) => name.endsWith('.xml'))) {
      const xml = fs.readFileSync(path.join(MAPS, file), 'utf8');
      const { report } = checkConversion(convert(xml), 'test');
      assert.equal(report.compileError, null, file);
      assert.deepEqual(report.unexpected, [], file);
    }
  });
});
