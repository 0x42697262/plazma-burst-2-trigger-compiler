import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSource } from './compile.ts';
import { Simulation } from '../sim/simulator.ts';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ptc-test-'));
after(() => fs.rmSync(folder, { recursive: true, force: true }));

const write = (name: string, text: string): string => {
  const file = path.join(folder, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
};

const compileFile = (file: string) => compileSource(fs.readFileSync(file, 'utf8'), 't', {}, { file, read: (name) => fs.readFileSync(name, 'utf8') });

describe('import', () => {
  it('adds the declarations of imported files, once each, relative to the importing file', () => {
    write('lib/math.ptc', 'import "shared.ptc";\nfunction double(x) { return x * 2; }\nfunction unused() { }\n');
    write('lib/shared.ptc', 'var base = 20;\n');
    const main = write('main.ptc', 'import "lib/math.ptc";\nimport "lib/shared.ptc";\nvar result = 0;\non start { result = double(base) + 2; }\n');
    const compiled = compileFile(main);
    assert.deepEqual(compiled.warnings, []);
    const simulation = new Simulation(compiled.program);
    simulation.tick();
    assert.equal(simulation.variables['~t_result~'], 42);
  });

  it('names the imported file in errors', () => {
    write('bad.ptc', 'function broken() {\n  missing = 1;\n}\n');
    const main = write('uses-bad.ptc', 'import "bad.ptc";\non start { broken(); }\n');
    assert.throws(() => compileFile(main), /: bad\.ptc line 2: unknown variable "missing"/);
    write('typo.ptc', 'var x = ;\n');
    assert.throws(() => compileFile(write('uses-typo.ptc', 'import "typo.ptc";\n')), /typo\.ptc line 1: expected an expression/);
    assert.throws(() => compileFile(write('uses-nothing.ptc', 'import "nothing.ptc";\n')), /line 1: cannot read the imported file nothing\.ptc/);
    write('twice.ptc', 'var shared = 1;\n');
    assert.throws(() => compileFile(write('clash.ptc', 'import "twice.ptc";\nvar shared = 2;\n')), /line 2: "shared" is already defined/);
  });

  it('needs a file to import from', () => {
    assert.throws(() => compileSource('import "x.ptc";', 't'), /import works only when compiling a file/);
  });
});
