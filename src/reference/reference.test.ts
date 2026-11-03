import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { breadcrumbs, referenceEntries, referenceEntry, referenceIdFor, searchReference } from './reference.ts';

describe('reference', () => {
  it('starts at a root that leads to every section', () => {
    const root = referenceEntry('root');
    assert.deepEqual(root?.sections[0]?.fields.map((field) => field.link), ['actions', 'objects', 'values', 'marks', 'builtins', 'language', 'kinds']);
    for (const value of referenceEntries()) {
      for (const section of value.sections) for (const field of section.fields) if (field.link !== null) assert.ok(referenceEntry(field.link), `${value.id} → ${field.link}`);
    }
  });

  it('describes an action with its category, colors, parameter kinds and notes', () => {
    const action = referenceEntry('action:0');
    assert.equal(action?.title, 'MovableTo');
    assert.equal(action?.summary, "Force Movable 'A' move to region 'B'");
    assert.equal(action?.signature, 'action(MovableTo, door, region)');
    assert.equal(action?.insert, 'action(MovableTo, , );');
    assert.equal(action?.color, '#5f6887');
    assert.deepEqual(action?.sections[0]?.fields.map((field) => [field.name, field.link]), [['A', 'kind:door'], ['B', 'kind:region']]);
    assert.deepEqual(breadcrumbs('action:0').map((value) => value.id), ['root', 'actions', 'category:Movable', 'action:0']);
    assert.ok(referenceEntry('action:102')?.sections.some((section) => section.title === 'Notes'));
  });

  it('links parameter kinds to objects and value lists, and back to the actions taking them', () => {
    const door = referenceEntry('kind:door');
    assert.ok(door?.sections[0]?.fields.some((field) => field.link === 'object:Door'));
    assert.ok(door?.sections.at(-1)?.fields.some((field) => field.link === 'action:0'));
    assert.ok(referenceEntry('kind:character')?.sections[0]?.fields.some((field) => field.link === 'object:Actor'));
    assert.ok(referenceEntry('kind:botaction')?.sections[0]?.fields.some((field) => field.link === 'values:Behavior'));
  });

  it('lists every property of a map object with its type, default and link', () => {
    const actor = referenceEntry('object:Actor');
    const botaction = actor?.sections[0]?.fields.find((field) => field.name === 'botaction');
    assert.equal(botaction?.link, 'values:Behavior');
    assert.match(botaction?.detail ?? '', /Behavior value.*default 0/);
    assert.equal(referenceEntry('object:Door')?.sections[0]?.fields.find((field) => field.name === 'attach')?.link, 'object:Door');
    assert.equal(referenceEntry('object:Trigger')?.insert, 'Trigger("#") {\n}');
    assert.equal(referenceEntry('object:Wall')?.signature, 'Wall(x, y, w, h, name: value)');
  });

  it('lists values, engine marks, builtins and keywords', () => {
    assert.ok(referenceEntry('values:Behavior')?.sections[0]?.fields.some((field) => field.name === 'DoNothing' && field.detail === '= 4' && field.insert === 'Behavior.DoNothing'));
    assert.equal(referenceEntry('mark:sky')?.sections[0]?.fields[0]?.link, 'values:Sky');
    assert.equal(referenceEntry('mark:nopsi')?.insert, 'EngineMark(nopsi);');
    assert.equal(referenceEntry('builtin:say')?.signature, 'say(text, color?)');
    assert.ok(referenceEntry('keyword:map')?.summary.includes('Trigger'));
  });

  it('searches names first, then descriptions, and finds actions by number', () => {
    assert.equal(searchReference('movableto')[0]?.id, 'action:0');
    assert.equal(searchReference('23')[0]?.id, 'action:23');
    assert.ok(searchReference('teleport').length > 3);
    assert.deepEqual(searchReference('   '), []);
  });

  it('finds the page for a word of the source', () => {
    assert.equal(referenceIdFor('SetCharHP'), 'action:23');
    assert.equal(referenceIdFor('op23'), 'action:23');
    assert.equal(referenceIdFor('Door'), 'object:Door');
    assert.equal(referenceIdFor('NoirLime', 'Color'), 'values:Color');
    assert.equal(referenceIdFor('CharacterModel'), 'values:Skin');
    assert.equal(referenceIdFor('say'), 'builtin:say');
    assert.equal(referenceIdFor('ChangeSky'), 'mark:sky');
    assert.equal(referenceIdFor('nothing_here'), null);
  });
});
