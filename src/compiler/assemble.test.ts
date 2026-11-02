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

  for (const [name, source] of [
    ['a call to an entry', '.entry f\nstart:\n    set $i, 0\nloop:\n    add $i, 1\n    call @f\n    jmp @loop\nf:\n    ret\n'],
    ['a fallthrough into an entry', '.entry e\nstart:\n    set $i, 0\nloop:\n    add $i, 1\ne:\n    jmp @loop\n'],
    ['a pass-through label before an entry', '.entry e\nstart:\n    set $i, 0\np:\ne:\n    add $i, 1\n    jmp @p\n'],
  ] as const) {
    it(`keeps the loop guard through ${name}`, () => {
      const { vars, simulation } = run(source, { loopGuard: 200 });
      assert.ok((vars['~t_i~'] as number) <= 201, String(vars['~t_i~']));
      assert.deepEqual(simulation.errors, []);
    });
  }

  it('runs the start code before any other timer on the first frame', () => {
    const { simulation } = run('.timer tick @onTick 1 -1\nstart:\n    set $n, 5\n    ret\nonTick:\n    say "n={$n}"\n');
    assert.equal(simulation.chat[0], 'n=5');
  });

  it('does not fall through after a raw switch to an empty trigger', () => {
    const { simulation } = run('start:\n    op363 @done, 0\nnext:\n    say "should not run"\n    ret\ndone:\n    ret\nother:\n    jmp @next\n');
    assert.deepEqual(simulation.chat, []);
  });

  it('lets a raw skip skip a jump, with and without the loop guard', () => {
    const source = 'start:\n    set $i, 0\n    set $five, 5\nloop:\n    add $i, 1\n    op361 $i, $five\n    jmp @loop\n    say "done {$i}"\n';
    for (const loopGuard of [null, 100000]) {
      const { simulation, warnings } = run(source, { loopGuard });
      assert.deepEqual(simulation.chat, ['done 5'], String(loopGuard));
      assert.deepEqual(warnings, []);
    }
  });

  it('lets a raw skip skip a return', () => {
    const { vars } = run('start:\n    set $a, 1\n    op361 $a, $a\n    ret\n    set $after, 1\n');
    assert.equal(vars['~t_after~'], 1);
  });

  it('refuses a raw skip right before a label or a conditional jump', () => {
    assert.throws(() => compileAssembly('start:\n    op361 $a, $a\nnext:\n    set $x, 1\nother:\n    jmp @next\n', 't'), /before the label "next"/);
    assert.throws(() => compileAssembly('start:\n    op361 $a, $a\n    jeq $a, 1, @start\n', 't'), /line 3: a skip action cannot come right before a conditional jump/);
  });

  it('reads timer options in any order and checks directive labels', () => {
    const { program } = compileAssembly('.timer t @go 30 disabled\n.timer u @go 30 -1\nstart:\n    ret\ngo:\n    ret\n', 't');
    assert.deepEqual(program.timers.slice(1).map((timer) => [timer.enabled, timer.maxCalls]), [[false, 1], [true, -1]]);
    assert.throws(() => compileAssembly('.entry mian\nmain:\n    ret\n', 't'), /"mian" is used by a directive but never defined/);
    assert.throws(() => compileAssembly('.timer tick @tick 1\ntick:\n    ret\n', 't'), /same name as a label/);
    assert.throws(() => compileAssembly('start:\n    op361 $a, $a\n    add $x, $y\n', 't'), /line 3: "add" here becomes several actions/);
  });

  it('keeps the fallthrough after a conditional jump to an empty exit', () => {
    for (const loopGuard of [null, 100000]) {
      const { simulation } = run('start:\n    set $a, 1\n    set $b, 1\n    jeq $a, 7, @next\n    jne $a, $b, @done\nnext:\n    say "equal"\n    ret\ndone:\n    ret\n', { loopGuard });
      assert.deepEqual(simulation.chat, ['equal'], String(loopGuard));
    }
    const { vars } = run('start:\n    set $a, 1\n    op361 $a, $a\n    ret\nnext:\n    set $after, 1\nother:\n    jmp @next\n');
    assert.equal(vars['~t_after~'], 1);
  });

  it('keeps a chain of raw skips before a back edge together', () => {
    for (const loopGuard of [null, 100000]) {
      const { simulation } = run('start:\n    set $i, 0\n    set $one, 1\nloop:\n    add $i, 1\n    op361 $i, $one\n    op361 $one, $one\n    jmp @loop\n    say "done {$i}"\n', { loopGuard });
      assert.deepEqual(simulation.chat, ['done 2'], String(loopGuard));
    }
  });

  it('reports a raw skip before an entry label also with the guard', () => {
    assert.throws(() => compileAssembly('.entry e\nstart:\n    set $a, 1\n    op361 $a, $a\ne:\n    say "e"\n', 't'), /before the label "e"/);
  });

  it('adds no jump into an entry that nothing can fall into', () => {
    const { warnings, program } = compileAssembly('.entry e\nstart:\n    say "s"\n    ret\nu:\ne:\n    say "e"\n', 't');
    assert.deepEqual(warnings, []);
    assert.equal(program.triggers.length, 2);
  });

  it('counts raw switches and calls to entries in the loop guard', () => {
    for (const source of [
      '.entry f\nstart:\n    set $i, 0\nloop:\n    add $i, 1\n    op99 @f, 0\n    jmp @loop\nf:\n    ret\n',
      'start:\n    set $i, 0\nloop:\n    add $i, 1\n    op363 @loop, 0\n',
    ]) {
      const { vars, simulation } = run(source, { loopGuard: 300 });
      assert.ok((vars['~t_i~'] as number) <= 301, String(vars['~t_i~']));
      assert.deepEqual(simulation.errors, []);
    }
  });

  it('reads host variables written as %name', () => {
    const { vars } = run('.extern\nstart:\n    set %score, 5\n    set $copy, %score\n    add $copy, %score\n    jeq %score, 5, @yes\n    ret\nyes:\n    set $hit, 1\n');
    assert.equal(vars.score, 5);
    assert.equal(vars['~t_copy~'], 10);
    assert.equal(vars['~t_hit~'], 1);
  });

  it('checks timer values', () => {
    assert.throws(() => compileAssembly('.timer t @go -5\ngo:\n    ret\n', 't'), /delay must be a whole number/);
    assert.throws(() => compileAssembly('.timer t @go 5 2.5\ngo:\n    ret\n', 't'), /calls must be a whole number/);
    assert.throws(() => compileAssembly('.timer t @go 5 0\ngo:\n    ret\n', 't'), /calls must be a whole number/);
    assert.throws(() => compileAssembly('.timer t go 5\ngo:\n    ret\n', 't'), /expected @label/);
  });

  it('names the line of unreachable code and warns when nothing starts the program', () => {
    const { warnings } = compileAssembly('start:\n    ret\n    set $x, 1\n', 't', { startTimer: false });
    assert.ok(warnings.some((warning) => warning.startsWith('line 3: 1 unreachable')), warnings.join('|'));
    assert.ok(warnings.some((warning) => warning.includes('No start timer')));
  });

  it('accepts a #hex chat color without a uid warning', () => {
    assert.deepEqual(compileAssembly('start:\n    say "hi", #ff0000\n', 't').warnings, []);
  });

  it('never writes a trigger without actions', () => {
    const { program } = compileAssembly('start:\n    call @f\n    ret\nf:\n    ret\n', 't');
    for (const trigger of program.triggers) assert.ok(trigger.actions.length > 0, trigger.uid);
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

  it('warns when the game would see XML entities', () => {
    const shown = compileAssembly('start:\n    say "a < b"\n', 't').warnings;
    assert.deepEqual(shown, []);
    const stored = compileAssembly('start:\n    set $x, "a < b"\n', 't').warnings;
    assert.ok(stored.some((warning) => warning.includes('XML entities')));
    const ampersand = compileAssembly('start:\n    say "a & b"\n', 't').warnings;
    assert.ok(ampersand.some((warning) => warning.includes('XML entities')));
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
      ['#t:start-timer', '#t_start', 0, 1], ['#t_tick', '#t_onTick', 30, -1],
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
