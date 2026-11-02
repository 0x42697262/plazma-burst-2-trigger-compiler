import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import { memberName, valueGroup } from '../opcodes/values.ts';

const actions = (source: string) => compileSource(source, 't').program.triggers.flatMap((trigger) => trigger.actions);

describe('named values', () => {
  it('builds readable names from the editor labels', () => {
    assert.equal(memberName("Main Hero (Player's nickname is displayed)"), 'MainHeroPlayersNicknameIsDisplayed');
    assert.equal(memberName('1 call'), 'N1Call');
    assert.equal(valueGroup('Color')?.members.get('NoirLime'), '2');
    assert.equal(valueGroup('Team')?.members.get('RedTeam'), '12');
    assert.equal(valueGroup('Team')?.members.get('AnyTeam'), '-1');
    assert.equal(valueGroup('GunModel')?.members.get('AssaultRifleC01r'), 'gun_rifle');
  });

  it('writes the value into the action', () => {
    const used = actions('character hero = "#player*0";\non start { say("hi", Color.NoirLime); action(SetCharTeam, hero, Team.BlueTeam); action(507, slot(), Team.RedTeam); }');
    assert.deepEqual(used.filter((action) => [42, 33, 507].includes(action.opcode)).map((action) => [action.opcode, action.targetB]), [
      [42, '2'], [33, '13'], [507, '12'],
    ]);
  });

  it('works in comparisons and match patterns', () => {
    const used = actions('var where = "";\non start { match (team(0)) { Team.RedTeam => where = "red"; Team.BlueTeam => where = "blue"; } }');
    assert.ok(used.some((action) => action.opcode === 123 && action.targetB === '12'));
  });

  it('computes an expression into a variable where an action reads a variable', () => {
    const used = actions('on start { action(507, slot(), Team.RedTeam); }');
    const set = used.find((action) => action.opcode === 507);
    assert.match(set?.targetA ?? '', /^~t::start\.t\d+~$/);
    assert.ok(used.some((action) => action.opcode === 137 && action.targetA === set?.targetA));
  });

  it('refuses a value from the wrong group, like a strict cast', () => {
    assert.throws(() => actions('on start { say("hi", Team.RedTeam); }'), /action 42 takes textmsg as B, not a Team value/);
    assert.throws(() => actions('character hero = "#player*0";\non start { action(SetCharTeam, hero, Color.Proxy); }'), /action 33 takes team as B, not a Color value/);
    assert.throws(() => actions('on start { say("hi", Colour.Proxy); }'), /unknown value group "Colour"/);
    assert.throws(() => actions('on start { say("hi", Color.Purple); }'), /Color has no value "Purple"/);
  });
});
