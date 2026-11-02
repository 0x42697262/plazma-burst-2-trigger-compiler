import fs from 'node:fs';
import path from 'node:path';
import { emitXml, escapeXml, stagingPosition } from '../emit/xml-emitter.ts';
import { XML_LINE_END } from '../emit/keys.ts';
import { checkObjects, objectElement } from '../objects/objects.ts';
import type { Layout } from '../emit/xml-emitter.ts';
import { DEFAULT_LAYOUT } from '../emit/constants.ts';
import { VAR_SYNC_IN_MAP } from '../emit/attributes.ts';
import { emitText, joinTextBlocks } from '../emit/trigger-text-emitter.ts';
import { appendToMap, removeOwned } from '../emit/merge.ts';
import { checkHostNames, checkHostUses } from '../compiler/host.ts';
import { createNames } from '../compiler/names.ts';
import { DEFAULT_OPTIONS } from '../compiler/compile.ts';
import type { CompileOptions, CompileResult } from '../compiler/compile.ts';
import { Simulation } from '../sim/simulator.ts';
import { stringOf } from '../sim/values.ts';
import { parseArguments, lastValue, UsageError } from './arguments.ts';
import { DEFAULT_TARGET, isTarget } from '../pcode/keys.ts';
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

const optionsOf = (parsed: ReturnType<typeof parseArguments>, hostMap: string | null): Partial<CompileOptions> => {
  const guard = lastValue(parsed, FLAG.guard);
  const target = lastValue(parsed, FLAG.target) ?? DEFAULT_TARGET;
  if (!isTarget(target)) throw new UsageError(TEXT.badTarget(target));
  return {
    target,
    loopGuard: parsed.flags.has(FLAG.noGuard) ? null : guard === null ? DEFAULT_OPTIONS.loopGuard : positiveInteger(guard, TEXT.badGuard),
    startTimer: !parsed.flags.has(FLAG.noStart),
    externalUids: parsed.values.get(FLAG.extern) ?? [],
    varSync: hostMap !== null && VAR_SYNC_IN_MAP.test(hostMap) ? 'present' : parsed.flags.has(FLAG.noSyncMark) ? 'off' : 'add',
    protectNumberText: !parsed.flags.has(FLAG.noNumberText),
    environment: process.env,
    directIndex: parsed.flags.has(FLAG.directIndex),
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
    const layout = layoutOf(lastValue(parsed, FLAG.at));
    const framesText = lastValue(parsed, FLAG.frames);
    const frames = framesText === null ? DEFAULT_RUN_FRAMES : positiveInteger(framesText, TEXT.badFrames);
    const into = lastValue(parsed, FLAG.into);
    const replacing = parsed.flags.has(FLAG.replace);
    if (replacing && into === null) throw new UsageError(TEXT.replaceNeedsInto);
    const hostMap = into === null ? null : fs.readFileSync(into, FILE_ENCODING);
    const options = optionsOf(parsed, hostMap);
    const source = fs.readFileSync(file, FILE_ENCODING);
    const frontEnd = frontEndFor(file);
    const prefix = lastValue(parsed, FLAG.prefix) ?? frontEnd.prefixOf(source) ?? prefixFromFile(file);
    const result = frontEnd.compile(source, prefix, options, file);
    for (const warning of result.warnings) output.err(TEXT.warning(warning));
    const actions = result.program.triggers.reduce((total, trigger) => total + trigger.actions.length, 0);
    output.out(TEXT.summary(result.program.triggers.length, actions, result.program.timers.length));
    if (result.exports.length > 0) output.out(TEXT.exported(result.exports.map((entry) => TEXT.exportedEntry(entry.name, entry.gameName))));
    const base = path.join(lastValue(parsed, FLAG.out) ?? DEFAULT_OUT, path.basename(file, path.extname(file)));
    const check = hostMap === null ? null : checkObjects(result.objects, hostMap);
    if (check && check.problems.length > 0) throw new UsageError(TEXT.objectProblems(check.problems));
    const creating = check !== null && !parsed.flags.has(FLAG.noCreate) ? check.missing : [];
    if (check !== null && parsed.flags.has(FLAG.noCreate)) {
      for (const object of check.missing) output.err(TEXT.warning(TEXT.objectMissing(object.name, object.uid)));
    }
    const objectXml = creating.map((object, index) => {
      const staging = stagingPosition(index, result.program, layout);
      output.out(TEXT.objectCreated(object.keyword, object.uid, object.x ?? staging.x, object.y ?? staging.y));
      return objectElement(object, staging, escapeXml) + XML_LINE_END;
    }).join('');
    const xml = emitXml(result.program, layout) + objectXml;
    writeFile(base + OUTPUT.xml, xml, output);
    try {
      writeFile(base + OUTPUT.text, joinTextBlocks(emitText(result.program)), output);
      if (result.program.varSyncMark) output.err(TEXT.warning(TEXT.textNeedsVarSync));
      if (result.program.timers.length > 0) output.err(TEXT.warning(TEXT.textHasNoTimers(result.program.timers.map((timer) => TEXT.timerTarget(timer.uid, timer.target)))));
    } catch (error) {
      fs.rmSync(base + OUTPUT.text, { force: true });
      output.err(TEXT.warning(TEXT.noText(error instanceof Error ? error.message : String(error))));
    }
    writeFile(base + OUTPUT.sourceMap, JSON.stringify(result.sourceMap, null, JSON_INDENT), output);
    if (hostMap !== null) {
      const names = createNames(prefix);
      const host = replacing ? removeOwned(hostMap, names.ownsUid) : hostMap;
      for (const warning of checkHostNames(result.program, host)) output.err(TEXT.warning(warning));
      for (const warning of checkHostUses(host, names.ownsVariable, result.exports)) output.err(TEXT.warning(warning));
      writeFile(base + OUTPUT.map, appendToMap(host, xml), output);
    }
    if (parsed.flags.has(FLAG.run)) simulate(result, frames, output);
    return 0;
  } catch (error) {
    output.err(TEXT.error(error instanceof Error ? error.message : String(error)));
    return EXIT_FAILURE;
  }
}
