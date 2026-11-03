import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import type { MapObject } from '../objects/types.ts';

const objects = (source: string): readonly MapObject[] => compileSource(source, 't').mapObjects;
const attributes = (object: MapObject | undefined): Record<string, string> => Object.fromEntries(object?.set ?? []);
const fails = (source: string, pattern: RegExp): void => {
  assert.throws(() => compileSource(source, 't'), pattern);
};

describe('map blocks', () => {
  it('builds objects with loops, functions, constants and arrays while compiling', () => {
    const result = compileSource([
      'const N = 3;',
      'function spot(i) { return i * 40; }',
      'map {',
      '  slots = [];',
      '  for (let i = 1; i <= N; i += 1) { push(slots, Player("#player*{i}", x: spot(i), y: 0)); }',
      '  gate = Door("#door*1", maxspeed: 9999);',
      '  gate.x ?= 0;',
      '}',
      'on start { action(SetCharHP, slots[2], 50); action(MovableTo, gate, "#r"); }',
    ].join('\n'), 't');
    assert.deepEqual(result.mapObjects.map((object) => object.uid), ['#player*1', '#player*2', '#player*3', '#door*1']);
    assert.deepEqual(attributes(result.mapObjects[2]), { x: '120', y: '0' });
    assert.deepEqual(result.mapObjects[3]?.initial, [['x', '0']]);
    const used = result.program.triggers.flatMap((trigger) => trigger.actions).map((action) => [action.opcode, action.targetA]);
    assert.ok(used.some(([opcode, target]) => opcode === 23 && target === '#player*3'));
    assert.ok(!result.warnings.some((warning) => warning.includes('spot')));
    assert.deepEqual(result.objects.filter((object) => object.built).map((object) => object.name), ['slots[0]', 'slots[1]', 'slots[2]', 'gate']);
  });

  it('keeps map usable as a name and allows ?= only on properties', () => {
    assert.ok(compileSource('var map = 1;\non start { map += 1; say("{map}"); }', 't'));
    fails('on start { let x = 1; x ?= 2; }', /\?= sets a property only when the object is created/);
    fails('map { gate = Door("#d"); gate.x += 1; }', /a property takes = or \?=/);
  });

  it('takes short, qualified and raw values, and custom values for model lists', () => {
    const [guard] = objects('map { guard = Actor("#enemy*1", botaction: DoNothing, team: Team.RedTeam, side: -1, char: c53013); }');
    assert.deepEqual(attributes(guard), { botaction: '4', team: '12', side: '-1', char: 'c53013' });
    const [decor] = objects('map { Decor("#d", model: c12345, f: YesAndGlow, text: "hi"); }');
    assert.deepEqual(attributes(decor), { model: 'c12345', f: '2', text: 'hi' });
    fails('map { Actor("#e", botaction: 7); }', /line 1: Actor botaction takes a Behavior value .*got "7"/);
    fails('map { Actor("#e", char: hero); }', /Actor char takes a Skin value .*or a custom one such as c12345, got "hero"/);
    fails('map { Decor("#d", model: "c1x"); }', /Decor model takes a DecorModel value/);
    assert.equal(attributes(objects('map { Background(0, 0, 10, 10, m: c77); }')[0]).m, 'c77');
    fails('map { Actor("#e", botaction: Team.RedTeam); }', /not a Team value/);
    fails('var DoNothing = 1;\nmap { Actor("#e", botaction: DoNothing); }', /"DoNothing" is a value of this property and also a name in the program/);
    fails('map { Door("#d", maxSpeed: 5); }', /Door has no property "maxSpeed"; it has x, y, w, h, moving/);
    fails('map { Door("#d", maxspeed: -5); }', /Door maxspeed takes a number of 0 or more, got "-5"/);
    fails('map { Player("#p", hea: 2.5); }', /Player hea takes a whole number/);
    fails('map { Door("#d", vis: 2); }', /Door vis takes true or false/);
  });

  it('writes references: doors, vehicles, functions and none', () => {
    const result = compileSource([
      'function died() { }',
      'map {',
      '  gate = Door("#gate");',
      '  car = Vehicle("#car");',
      '  Region("#zone", attach: gate, use_target: @died);',
      '  Actor("#e", incar: car, ondeath: NoTrigger);',
      '  Water("#w", attach: None);',
      '}',
    ].join('\n'), 't');
    const [, , zone, actor, water] = result.mapObjects;
    assert.equal(attributes(zone).attach, '#gate');
    assert.equal(attributes(zone).use_target, result.entries.get('died'));
    assert.ok(result.program.triggers.some((trigger) => trigger.uid === result.entries.get('died')));
    assert.deepEqual(attributes(actor), { incar: '#car', ondeath: '-1' });
    assert.equal(attributes(water).attach, '-1');
    fails('map { r = Region("#r"); Door("#d", attach: r); }', /Door attach takes a Door, its uid or No, None, got a Region/);
    fails('map { Region("#r", use_target: @missing); }', /unknown function "missing"/);
  });

  it('checks engine mark values by mark', () => {
    const marks = objects('map { EngineMark(var_sync); EngineMark(sky, forteam: Space); EngineMark(gamescale, forteam: 1.5); EngineMark(ChangeSky); }'.replace('EngineMark(ChangeSky); ', ''));
    assert.deepEqual(marks.map((mark) => attributes(mark)), [{ mark: 'var_sync' }, { mark: 'sky', forteam: '5' }, { mark: 'gamescale', forteam: '1.5' }]);
    assert.equal(objects('map { EngineMark(EnableVarSyncTriggerActions); }')[0]?.mark, 'var_sync');
    fails('map { EngineMark(nopsi, forteam: 3); }', /the engine mark nopsi takes no value/);
    assert.equal(attributes(objects('map { EngineMark(hero1_guns, forteam: Team.RedTeam); }')[0]).forteam, '12');
    fails('map { EngineMark(he_nades_count, forteam: 1.5); }', /EngineMark forteam takes a whole number of 0 or more/);
    fails('map { EngineMark(sky); EngineMark(sky, forteam: 4); }', /line 1: sky is created twice/);
    fails('map { EngineMark(); }', /EngineMark\(\.\.\.\) needs the mark as its first argument/);
  });

  it('refuses arrays of several kinds and things that act on the game', () => {
    fails('map {\n  list = [Door("#d"), Region("#r")];\n}', /line 2: "list" holds door objects, but element 1 is a region/);
    fails('map {\n  list = [Player("#p"), Actor("#e")];\n}', /holds player objects, but element 1 is a actor/);
    fails('map { say("hi"); }', /say\(\.\.\.\) does not work in a map block/);
    fails('map { let n = random(3); }', /random\(\.\.\.\) does not work in a map block/);
    fails('map { wait(3); }', /"wait" does not work in a map block/);
    fails('map { Door("#d"); Door("#d"); }', /#d is created twice/);
    fails('map { Door("d"); }', /needs a uid that starts with #/);
    fails('map { d = Door("#d"); x = d.x; }', /properties can be set in a map block, not read/);
    fails('var count = 0;\nmap { count = 2; }', /"count" belongs to the program/);
    fails('function f() { return Door("#d"); }', /Door\(\.\.\.\) creates a map object: write it in a map \{ \} block/);
  });

  it('refuses properties of host objects and while the map runs, naming the action', () => {
    fails('door gate = "#d";\nmap { gate.x = 5; }', /"gate" is declared outside a map block/);
    fails('door gate = "#d";\non start { gate.x = 5; }', /line 2: gate\.x is set while compiling, in a map block; while the map runs, change it with an action, such as action\(MovableTo, gate, \.\.\.\)/);
    fails('map { gate = Door("#d"); }\non start { say("{gate.maxspeed}"); }', /gate\.maxspeed is set while compiling.*SetMovableSpeed/);
    fails('on start { say(Colr.Red); }', /unknown value group "Colr"/);
  });

  it('uses host objects as references and runs blocks of imported files first', () => {
    const files: Record<string, string> = {
      '/w/lib.ptc': 'map { base = Door("#base"); }\n',
      '/w/main.ptc': 'import "lib.ptc";\ndoor host = "#host";\nmap { Door("#top", attach: host); Door("#second", attach: base); }\n',
    };
    const result = compileSource(files['/w/main.ptc'] ?? '', 't', {}, { file: '/w/main.ptc', read: (name) => files[name] ?? '' });
    assert.deepEqual(result.mapObjects.map((object) => [object.uid, attributes(object).attach]), [['#base', undefined], ['#top', '#host'], ['#second', '#base']]);
  });

  it('warns about text the game or the editor would change, and finds secrets', () => {
    const result = compileSource('map { Decor("#d", text: "a<b"); Song("#s", url: "007"); }', 't');
    assert.ok(result.warnings.some((warning) => warning.includes('#d text') && warning.includes('XML entities')));
    assert.ok(result.warnings.some((warning) => warning.includes('#s url') && warning.includes('into the number 7')));
    fails('secret const KEY = "abcdef";\nmap { Decor("#d", text: KEY); }', /the secret KEY would be written into the map \(the text of the map object #d/);
  });

  it('makes triggers with raw actions, worked out while compiling, and timers', () => {
    const result = compileSource([
      'var opened = 0;',
      'var log[];',
      'extern score = "score";',
      'region exit = "#exit";',
      'function hello() { }',
      'map {',
      '  gate = Door("#gate");',
      '  bump = Trigger("#bump", maxcalls: Infinite) {',
      '    action(VarAddValue, opened, 1);',
      '    for (let i = 1; i <= 2; i += 1) { action(VarAddValue, score, i); }',
      '    action(MovableTo, gate, exit);',
      '    action(SetAIBehavior, "#enemy*1", DoNothing);',
      '    action(ExecTrigger, @hello);',
      '    action(VarSetValue, log[2], "n {opened}");',
      '  }',
      '  Timer("#tick", target: bump, delay: 0, maxcalls: 2);',
      '  Trigger("#empty") { }',
      '  Trigger("#kept");',
      '}',
      'on start { action(ExecTrigger, bump); action(TimerEnable, "#tick"); }',
    ].join('\n'), 't');
    const [, bump, tick, empty, kept] = result.mapObjects;
    assert.deepEqual(bump?.actions?.map((action) => [action.opcode, action.targetA, action.targetB]), [
      [102, '~t_opened~', '1'], [102, 'score', '1'], [102, 'score', '2'], [0, '#gate', '#exit'], [32, '#enemy*1', '4'], [99, result.entries.get('hello'), '0'],
      [100, '~t_log[2]~', 'n ~t_opened~'],
    ]);
    assert.deepEqual(attributes(bump), { maxcalls: '-1' });
    assert.deepEqual(attributes(tick), { target: '#bump', delay: '0', maxcalls: '2' });
    assert.deepEqual(empty?.actions, []);
    assert.equal(kept?.actions, null);
    assert.ok(result.program.triggers.some((trigger) => trigger.actions.some((action) => action.opcode === 99 && action.targetA === '#bump')));
  });

  it('counts a variable a map trigger writes as changing', () => {
    const result = compileSource('var n = 0;\nvar list[];\nmap { Trigger("#t") { action(VarAddValue, n, 1); } }\non start { list[n] = 1; }', 't');
    assert.ok(result.program.triggers.flatMap((trigger) => trigger.actions).every((action) => action.targetA !== '~t_list[0]~'));
  });

  it('refuses wrong actions in map triggers', () => {
    fails('map { action(VarAddValue, "x", 1); }', /action\(\.\.\.\) in a map block adds an action to a trigger/);
    fails('map { Trigger("#t") { action(Nope, 1, 2); } }', /unknown action "Nope"/);
    fails('map { r = Region("#r"); Trigger("#t") { action(MovableTo, r, r); } }', /action 0 takes door as A, not a region/);
    fails('function f() { }\nmap { Trigger("#t") { action(MovableTo, @f, "#r"); } }', /takes door as A, not a function's trigger/);
    fails('map { Trigger("#t") { for (let i = 0; i < 101; i += 1) { action(VarAddValue, "x", i); } } }', /trigger #t has 101 actions; the game loads at most 100/);
    fails('map { list = []; push(list, Trigger("#t") { }); }', /must stand alone or be assigned to a name/);
    fails('map { Trigger("#t:start") { } }\non start { }', /#t:start is created in a map block, but the program already uses that uid/);
    fails('map { Timer("#t", target: Region("#r")); }', /Timer target takes @function, a trigger uid or NoTrigger/);
  });

  it('warns about map trigger actions like compiled ones', () => {
    const result = compileSource('map { Trigger("#t") { for (let i = 0; i < 99; i += 1) { action(VarAddValue, "x", i); } action(MovableTo, "#nowhere", "#r"); } }', 't');
    assert.ok(result.warnings.some((warning) => warning.includes('Trigger #t has an action 100')));
  });
});

