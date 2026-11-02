import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './compile.ts';
import { checkHostUses } from '../compiler/host.ts';
import { createNames } from '../compiler/names.ts';

const SOURCE = 'export var score = 0;\nexport var list[];\nvar hidden = 1;\non start { score = hidden; push(list, 5); }\n';

const hostUsing = (...names: string[]): string =>
  `<trigger uid="#host" x="0" y="0" enabled="true" maxcalls="-1" ${names.map((name, index) => `actions_${index + 1}_type="102" actions_${index + 1}_targetA="${name}" actions_${index + 1}_targetB="1"`).join(' ')} />`;

describe('export var', () => {
  it('lists the exported variables with their game names', () => {
    assert.deepEqual(compileSource(SOURCE, 't').exports, [
      { name: 'score', gameName: '~t_score~', lengthName: null },
      { name: 'list', gameName: '~t_list[i]~', lengthName: '~t_list.length~' },
    ]);
  });

  it('warns when the host map uses a variable the program does not export', () => {
    const { exports } = compileSource(SOURCE, 't');
    const warnings = checkHostUses(hostUsing('~t_score~', '~t_list[3]~', '~t_list.length~', '~t_hidden~', '~t:start.t1~', 'own_var'), createNames('t').ownsVariable, exports);
    assert.deepEqual(warnings.map((warning) => warning.split(',')[0]), [
      'The host map uses ~t_hidden~', 'The host map uses ~t:start.t1~',
    ]);
  });

  it('accepts export only before var and function', () => {
    assert.throws(() => compileSource('export const C = 1;', 't'), /expected "function" or "var"/);
  });
});
