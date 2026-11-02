import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { emitXml, escapeXml } from './xml-emitter.ts';
import { emitText, emitTriggerText, isWritableAsText, joinTextBlocks } from './trigger-text-emitter.ts';
import { appendToMap } from './merge.ts';
import { EmitError } from './check.ts';
import { action, trigger } from '../program/build.ts';
import { HELLO } from '../samples/hello.fixture.ts';

const HELLO_XML = [
  '<trigger uid="#ptc_hello_main" x="0" y="0" enabled="true" maxcalls="-1"'
    + ' actions_1_type="100" actions_1_targetA="~ptc_hello_count~" actions_1_targetB="0"'
    + ' actions_2_type="99" actions_2_targetA="#ptc_hello_add" actions_2_targetB="0"'
    + ' actions_3_type="99" actions_3_targetA="#ptc_hello_add" actions_3_targetB="0"'
    + ' actions_4_type="363" actions_4_targetA="#ptc_hello_done" actions_4_targetB="0"'
    + ' actions_5_type="100" actions_5_targetA="~ptc_hello_unreachable~" actions_5_targetB="1" />',
  '<trigger uid="#ptc_hello_add" x="60" y="0" enabled="true" maxcalls="-1"'
    + ' actions_1_type="102" actions_1_targetA="~ptc_hello_count~" actions_1_targetB="1" />',
  '<trigger uid="#ptc_hello_done" x="120" y="0" enabled="true" maxcalls="-1"'
    + ' actions_1_type="42" actions_1_targetA="ptc hello: count = ~ptc_hello_count~" actions_1_targetB="0"'
    + ' actions_2_type="100" actions_2_targetA="~ptc_hello_done~" actions_2_targetB="1" />',
  '<timer uid="#ptc_hello_start" x="180" y="0" enabled="true" maxcalls="1" target="#ptc_hello_main" delay="0" />',
  '',
].join('\n');

const HELLO_TEXT = `uid: #ptc_hello_main
enabled: true
maxcalls: -1

VarSetValue( "~ptc_hello_count~", "0" );
ExecTrigger( "#ptc_hello_add", "0" );
ExecTrigger( "#ptc_hello_add", "0" );
op363( "#ptc_hello_done", "0" );
VarSetValue( "~ptc_hello_unreachable~", "1" );

uid: #ptc_hello_add
enabled: true
maxcalls: -1

VarAddValue( "~ptc_hello_count~", "1" );

uid: #ptc_hello_done
enabled: true
maxcalls: -1

ShowText( "ptc hello: count = ~ptc_hello_count~", "0" );
VarSetValue( "~ptc_hello_done~", "1" );
`;

describe('XML emitter', () => {
  it('writes the sample program', () => {
    assert.equal(emitXml(HELLO), HELLO_XML);
  });

  it('escapes attribute values', () => {
    assert.equal(escapeXml('"1" & <b>\n'), '&quot;1&quot; &amp; &lt;b&gt;&#10;');
  });

  it('places triggers on a grid', () => {
    const triggers = Array.from({ length: 12 }, (_, index) => trigger(`#t${index}`, [action(100, 'a', 'b')]));
    const xml = emitXml({ triggers, startTimer: null }, { originX: 1000, originY: -500, spacing: 50, columns: 10 });
    assert.match(xml, /uid="#t9" x="1450" y="-500"/);
    assert.match(xml, /uid="#t10" x="1000" y="-450"/);
  });

  it('refuses more than 100 actions in one trigger', () => {
    const actions = Array.from({ length: 101 }, () => action(100, 'a', 'b'));
    assert.throws(() => emitXml({ triggers: [trigger('#big', actions)], startTimer: null }), EmitError);
  });

  it('refuses unknown actions and duplicate uids', () => {
    assert.throws(() => emitXml({ triggers: [trigger('#a', [action(9999)])], startTimer: null }), /unknown action 9999/);
    assert.throws(() => emitXml({ triggers: [trigger('#a', []), trigger('#a', [])], startTimer: null }), /used twice/);
  });
});

describe('trigger text emitter', () => {
  it('writes the sample program the way the editor shows it', () => {
    assert.equal(joinTextBlocks(emitText(HELLO)), HELLO_TEXT);
  });

  it('keeps aliases exactly, including spaces', () => {
    const text = emitTriggerText(trigger('#a', [action(123, 'x', '1'), action(110, 'x', 'y')]));
    assert.match(text, /^next if VarA == ValueB\( "x", "1" \);$/m);
    assert.match(text, /^continue if VarA > VarB \( "x", "y" \);$/m);
  });

  it('writes quotes without escaping', () => {
    assert.match(emitTriggerText(trigger('#a', [action(100, 'x', '"1"')])), /VarSetValue\( "x", ""1"" \);/);
  });

  it('refuses values the text format cannot hold', () => {
    assert.equal(isWritableAsText('a", "b'), false);
    assert.equal(isWritableAsText('a" );'), false);
    assert.equal(isWritableAsText('two\nlines'), false);
    assert.equal(isWritableAsText('"fine"'), true);
    assert.throws(() => emitTriggerText(trigger('#a', [action(100, 'x', 'a", "b')])), /action 1: the value/);
  });
});

describe('append to map', () => {
  const MAP = '<player x="0" y="0" />\n<trigger uid="#trigger*1" x="0" y="0" enabled="true" maxcalls="1" />\n';

  it('appends compiled elements after the map', () => {
    const merged = appendToMap(MAP, emitXml(HELLO));
    assert.ok(merged.startsWith(MAP));
    assert.ok(merged.endsWith(HELLO_XML));
  });

  it('refuses a uid the map already uses', () => {
    const clashing = emitXml({ triggers: [trigger('#trigger*1', [action(100, 'a', 'b')])], startTimer: null });
    assert.throws(() => appendToMap(MAP, clashing), /already has an object with uid #trigger\*1/);
  });
});
