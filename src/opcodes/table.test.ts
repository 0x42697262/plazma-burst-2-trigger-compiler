import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OPCODES, opcodeByName, opcodeByNumber, textName } from './table.ts';
import { ACTION_COUNT } from './constants.ts';

describe('opcode table', () => {
  it('has every action of the editor', () => {
    assert.equal(OPCODES.size, ACTION_COUNT);
  });

  it('keeps the client numbers, aliases and param kinds', () => {
    assert.deepEqual(
      { alias: opcodeByNumber(99)?.alias, paramA: opcodeByNumber(99)?.paramA, paramB: opcodeByNumber(99)?.paramB },
      { alias: 'ExecTrigger', paramA: 'trigger', paramB: 'nochange' },
    );
    assert.equal(opcodeByNumber(363)?.alias, null);
    assert.equal(opcodeByNumber(123)?.alias, 'next if VarA == ValueB');
  });

  it('finds an action by alias or by op<N>', () => {
    assert.equal(opcodeByName('VarSetValue')?.number, 100);
    assert.equal(opcodeByName('op363')?.number, 363);
    assert.equal(opcodeByName('op-1')?.number, -1);
    assert.equal(opcodeByName('op'), null);
    assert.equal(opcodeByName('op07'), null);
    assert.equal(opcodeByName('NoSuchAction'), null);
  });

  it('marks the actions whose B is template-replaced', () => {
    const marked = [...OPCODES.values()].filter((opcode) => opcode.templateReplacedB).map((opcode) => opcode.number);
    assert.deepEqual(marked.sort((first, second) => first - second), [295, 325, 326, 350, 352]);
  });

  it('marks the actions whose A is template-replaced', () => {
    const marked = [...OPCODES.values()].filter((opcode) => opcode.templateReplacedA).map((opcode) => opcode.number);
    assert.deepEqual(marked, [42]);
  });

  it('marks how the skip actions compare', () => {
    assert.equal(opcodeByNumber(361)?.comparison, 'string');
    assert.equal(opcodeByNumber(123)?.comparison, 'string');
    assert.equal(opcodeByNumber(364)?.comparison, 'number');
    assert.equal(opcodeByNumber(365)?.comparison, 'number');
    assert.equal(opcodeByNumber(100)?.comparison, null);
  });

  it('marks switch-by-index as avoided', () => {
    assert.equal(opcodeByNumber(362)?.avoided, true);
    assert.equal(opcodeByNumber(363)?.avoided, false);
  });

  it('writes every action as op<N> in trigger text', () => {
    const opcode = opcodeByNumber(100);
    assert.ok(opcode);
    assert.equal(textName(opcode), 'op100');
  });
});
