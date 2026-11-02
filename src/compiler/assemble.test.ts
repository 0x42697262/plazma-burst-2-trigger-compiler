import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileAssembly } from './assemble.ts';
import { Simulation } from '../sim/simulator.ts';
import type { CompileOptions } from './compile.ts';

const run = (source: string, options: Partial<CompileOptions> = {}) => {
  const result = compileAssembly(source, 't', options);
  const simulation = new Simulation(result.program);
  simulation.tick();
  return { ...result, simulation, vars: simulation.variables };
};

describe('assembler', () => {
  it('runs the plan example loop', () => {
    const { vars, simulation } = run(`
start:
    set   $i, 0
loop:
    add   $i, 1
    jgt   $i, 10, @done
    jmp   @loop
done:
    say   "finished {$i}"
`);
    assert.equal(vars['~t_i~'], 11);
    assert.deepEqual(simulation.chat, ['finished 11']);
    assert.deepEqual(simulation.errors, []);
  });

  it('calls and returns, also from a function that spans triggers', () => {
    const { vars, program } = run(`
main:
    set $x, 0
    call @inc
    call @twice
    set $after, $x
    ret
    set $never, 1
inc:
    add $x, 1
    ret
twice:
    call @inc
    jmp @second
second:
    call @inc
`);
    assert.equal(vars['~t_after~'], 3);
    assert.equal(vars['~t_never~'], undefined);
    assert.equal(vars['~t_x~'], 3);
    assert.ok(program.triggers.some((trigger) => trigger.uid === '#t_second'));
  });

  it('chains more than 100 actions over several triggers', () => {
    const body = Array.from({ length: 250 }, () => '    add $x, 1').join('\n');
    const { vars, program } = run(`start:\n    set $x, 0\n${body}\n    set $done, 1\n`, { loopGuard: null });
    assert.equal(vars['~t_x~'], 250);
    assert.equal(vars['~t_done~'], 1);
    assert.equal(program.triggers.length, 3);
    for (const trigger of program.triggers) assert.ok(trigger.actions.length <= 100);
  });

  it('never splits a skip action from the action it skips', () => {
    const filler = Array.from({ length: 98 }, () => '    add $x, 1').join('\n');
    const { vars, program } = run(`start:\n    set $x, 0\n${filler}\n    op361 $x, $x\n    set $wrong, 1\n    set $end, 1\n`, { loopGuard: null });
    assert.equal(vars['~t_wrong~'], undefined);
    assert.equal(vars['~t_end~'], 1);
    for (const trigger of program.triggers) assert.notEqual(trigger.actions.at(-2)?.opcode, 361);
  });

  for (const [condition, left, right, expected] of [
    ['jeq', '5', '5', true], ['jeq', '5', '6', false], ['jne', '5', '6', true], ['jne', '5', '5', false],
    ['jlt', '4', '5', true], ['jlt', '5', '5', false], ['jle', '5', '5', true], ['jle', '6', '5', false],
    ['jgt', '6', '5', true], ['jgt', '5', '5', false], ['jge', '5', '5', true], ['jge', '4', '5', false],
    ['jeq', '"abc"', '"abc"', true], ['jlt', '10', '9', false], ['jgt', '10', '9', true],
  ] as const) {
    it(`${condition} ${left}, ${right} jumps: ${expected}`, () => {
      for (const form of ['vars', 'literal-right', 'literal-left']) {
        const leftOperand = form === 'literal-left' ? left : '$left';
        const rightOperand = form === 'literal-right' ? right : '$right';
        const { vars } = run(`
start:
    set $left, ${left}
    set $right, ${right}
    ${condition} ${leftOperand}, ${rightOperand}, @yes
    set $result, 0
    ret
yes:
    set $result, 1
`);
        assert.equal(vars['~t_result~'], expected ? 1 : 0, `${form}`);
      }
    });
  }

  it('stops an endless loop with the loop guard', () => {
    const { vars, simulation } = run(`
start:
    set $x, 0
loop:
    add $x, 1
    jmp @loop
`, { loopGuard: 500 });
    assert.equal(vars['~t_x~'], 500);
    assert.deepEqual(simulation.errors, []);
  });

  it('resets the guard when a loop jumps back to the entry label', () => {
    const { vars } = run(`
init:
    set $x, 0
    jmp @start
start:
    add $x, 1
    jlt $x, 1000000, @start
`, { loopGuard: 50 });
    assert.equal(vars['~t_x~'], 50);
  });

  it('does not reset the guard when a loop jumps back to the entry label itself', () => {
    const { vars } = run(`
start:
    VarSetValueIfUndefined $x, 0
    add $x, 1
    jlt $x, 1000000, @start
`, { loopGuard: 50 });
    assert.equal(vars['~t_x~'], 50);
  });

  it('replaces a jump to an empty exit trigger with a stop', () => {
    const { program, vars } = run(`
start:
    set $i, 0
loop:
    add $i, 1
    jge $i, 3, @end
    jmp @loop
end:
`, { loopGuard: null });
    assert.equal(vars['~t_i~'], 3);
    assert.deepEqual(program.triggers.map((trigger) => trigger.uid), ['#t_start', '#t_loop']);
    assert.ok(program.triggers[1]?.actions.some((action) => action.opcode === 110));
  });

  it('warns about unreachable code and unknown targets', () => {
    const { warnings } = compileAssembly(`
start:
    jmp @end
    set $dead, 1
end:
    ExecTrigger #somewhere
`, 't');
    assert.ok(warnings.some((warning) => warning.includes('unreachable')));
    assert.ok(warnings.some((warning) => warning.includes('#somewhere')));
  });

  it('accepts declared external uids', () => {
    const { warnings } = compileAssembly('.extern #trigger*5\nstart:\n    ExecTrigger #trigger*5\n', 't');
    assert.deepEqual(warnings, []);
  });

  it('reports errors with line numbers', () => {
    assert.throws(() => compileAssembly('start:\n    jmp nowhere\n', 't'), /line 2: expected @label/);
    assert.throws(() => compileAssembly('start:\n    frobnicate $x\n', 't'), /line 2: unknown instruction/);
    assert.throws(() => compileAssembly('start:\n    say "open\n', 't'), /line 2: unclosed string/);
    assert.throws(() => compileAssembly('start:\n    jmp @nowhere\n', 't'), /Unknown label "nowhere"/);
    assert.throws(() => compileAssembly('a:\na:\n', 't'), /defined twice/);
  });

  it('copies and adds variables with set and add', () => {
    const { vars } = run('start:\n    set $a, "5"\n    set $b, $a\n    set $c, "x"\n    add $c, $a\n');
    assert.equal(vars['~t_b~'], 5);
    assert.ok(Number.isNaN(vars['~t_c~']));
  });

  it('keeps comments out of strings', () => {
    const { simulation } = run('start:\n    say "a; b // c" ; comment\n');
    assert.deepEqual(simulation.chat, ['a; b // c']);
  });

  it('adds timers and entry points', () => {
    const { program, entries } = compileAssembly('.timer tick @onTick 30 -1\nstart:\n    ret\nonTick:\n    add $n, 1\n', 't');
    assert.deepEqual(program.timers.map((timer) => [timer.uid, timer.target, timer.delay, timer.maxCalls]), [
      ['#t_tick', '#t_onTick', 30, -1], ['#t:start-timer', '#t_start', 0, 1],
    ]);
    assert.equal(entries.get('onTick'), '#t_onTick');
  });

  it('runs timers every delay frames', () => {
    const result = compileAssembly('.timer tick @onTick 3 -1\nstart:\n    set $n, 0\n    ret\nonTick:\n    add $n, 1\n', 't');
    const simulation = new Simulation(result.program);
    simulation.tick(9);
    assert.equal(simulation.variables['~t_n~'], 3);
  });
});
