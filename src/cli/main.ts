import fs from 'node:fs';
import path from 'node:path';
import { emitXml } from '../emit/xml-emitter.ts';
import type { Layout } from '../emit/xml-emitter.ts';
import { DEFAULT_LAYOUT } from '../emit/constants.ts';
import { emitText, joinTextBlocks } from '../emit/trigger-text-emitter.ts';
import { appendToMap } from '../emit/merge.ts';
import { DEFAULT_OPTIONS } from '../compiler/compile.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { Simulation } from '../sim/simulator.ts';
import { stringOf } from '../sim/values.ts';
import { parseArguments, lastValue, UsageError } from './arguments.ts';
import { frontEndFor } from './frontends.ts';
import { DEFAULT_OUT, DEFAULT_PREFIX, FILE_ENCODING, FLAG, LEADING_DIGITS, OUTPUT, POSITION_SEPARATOR, PREFIX_CLEANUP } from './keys.ts';
import { DEFAULT_RUN_FRAMES, EXIT_FAILURE, JSON_INDENT, POSITION_PARTS } from './constants.ts';
import { TEXT } from './text.ts';

export type Output = { out: (line: string) => void; err: (line: string) => void };

export const prefixFromFile = (file: string): string => {
  const cleaned = path.basename(file, path.extname(file)).replace(PREFIX_CLEANUP, '').replace(LEADING_DIGITS, '');
  return cleaned === '' ? DEFAULT_PREFIX : cleaned;
};

const positiveInteger = (value: string, message: (value: string) => string): number => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new UsageError(message(value));
  return number;
};

const layoutOf = (value: string | null): Layout => {
  if (value === null) return DEFAULT_LAYOUT;
  const parts = value.split(POSITION_SEPARATOR).map(Number);
  const [originX, originY] = parts;
  if (parts.length !== POSITION_PARTS || !Number.isInteger(originX) || !Number.isInteger(originY)) throw new UsageError(TEXT.badPosition(value));
  return { ...DEFAULT_LAYOUT, originX: originX ?? 0, originY: originY ?? 0 };
};

const optionsOf = (parsed: ReturnType<typeof parseArguments>): Partial<CompileOptions> => {
  const guard = lastValue(parsed, FLAG.guard);
  return {
    loopGuard: parsed.flags.has(FLAG.noGuard) ? null : guard === null ? DEFAULT_OPTIONS.loopGuard : positiveInteger(guard, TEXT.badGuard),
    startTimer: !parsed.flags.has(FLAG.noStart),
    externalUids: parsed.values.get(FLAG.extern) ?? [],
  };
};

const writeFile = (file: string, content: string, output: Output): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  output.out(TEXT.wrote(file));
};

const showValue = (value: unknown): string => (typeof value === 'string' || Array.isArray(value) ? JSON.stringify(value) : stringOf(value));

const simulate = (result: CompileResult, frames: number, output: Output): void => {
  const simulation = new Simulation(result.program);
  simulation.tick(frames);
  for (const [name, value] of Object.entries(simulation.variables)) output.out(TEXT.variable(name, showValue(value)));
  for (const line of simulation.chat) output.out(TEXT.chat(line));
  for (const line of simulation.errors) output.out(TEXT.simError(line));
  for (const opcode of simulation.unsimulated) output.out(TEXT.unsimulated(opcode));
};

export function main(argumentsList: readonly string[], output: Output): number {
  try {
    const parsed = parseArguments(argumentsList);
    if (parsed.flags.has(FLAG.help)) {
      output.out(TEXT.usage);
      return 0;
    }
    const file = parsed.files[0];
    if (file === undefined) throw new UsageError(TEXT.missingFile);
    if (parsed.files.length > 1) throw new UsageError(TEXT.oneFile);
    const source = fs.readFileSync(file, FILE_ENCODING);
    const frontEnd = frontEndFor(file);
    const prefix = lastValue(parsed, FLAG.prefix) ?? frontEnd.prefixOf(source) ?? prefixFromFile(file);
    const result = frontEnd.compile(source, prefix, optionsOf(parsed));
    for (const warning of result.warnings) output.err(TEXT.warning(warning));
    const actions = result.program.triggers.reduce((total, trigger) => total + trigger.actions.length, 0);
    output.out(TEXT.summary(result.program.triggers.length, actions, result.program.timers.length));
    const base = path.join(lastValue(parsed, FLAG.out) ?? DEFAULT_OUT, path.basename(file, path.extname(file)));
    const xml = emitXml(result.program, layoutOf(lastValue(parsed, FLAG.at)));
    writeFile(base + OUTPUT.xml, xml, output);
    try {
      writeFile(base + OUTPUT.text, joinTextBlocks(emitText(result.program)), output);
      if (result.program.timers.length > 0) output.err(TEXT.warning(TEXT.textHasNoTimers(result.program.timers.map((timer) => TEXT.timerTarget(timer.uid, timer.target)))));
    } catch (error) {
      fs.rmSync(base + OUTPUT.text, { force: true });
      output.err(TEXT.warning(TEXT.noText(error instanceof Error ? error.message : String(error))));
    }
    writeFile(base + OUTPUT.sourceMap, JSON.stringify(result.sourceMap, null, JSON_INDENT), output);
    const into = lastValue(parsed, FLAG.into);
    if (into !== null) writeFile(base + OUTPUT.map, appendToMap(fs.readFileSync(into, FILE_ENCODING), xml), output);
    if (parsed.flags.has(FLAG.run)) {
      const frames = lastValue(parsed, FLAG.frames);
      simulate(result, frames === null ? DEFAULT_RUN_FRAMES : positiveInteger(frames, TEXT.badFrames), output);
    }
    return 0;
  } catch (error) {
    output.err(TEXT.error(error instanceof Error ? error.message : String(error)));
    return EXIT_FAILURE;
  }
}
