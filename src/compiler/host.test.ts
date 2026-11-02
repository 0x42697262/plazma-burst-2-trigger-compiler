import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkHostNames, hostVariableNames } from './host.ts';
import { compileSource } from '../lang/compile.ts';

const HOST = [
  '<trigger uid="#trigger*1" x="0" y="0" enabled="true" maxcalls="-1" actions_1_type="100" actions_1_targetA="level" actions_1_targetB="1"'
    + ' actions_2_type="42" actions_2_targetA="Welcome to the level" actions_2_targetB="0" actions_3_type="102" actions_3_targetA="var_score" actions_3_targetB="1" />',
].join('\n');

describe('host map variable names', () => {
  it('reads the variables the host map sets, not its chat text', () => {
    assert.deepEqual([...hostVariableNames(HOST)].sort(), ['level', 'var_score']);
  });

  it('warns when a host name appears inside text the game replaces', () => {
    const clashing = compileSource('var level = 3;\non start { say("level {level}"); }', 'p');
    const warnings = checkHostNames(clashing.program, HOST);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /"level" appears inside/);
    const clean = compileSource('var stage = 3;\non start { say("now {stage}"); }', 'p');
    assert.deepEqual(checkHostNames(clean.program, HOST), []);
  });
});
