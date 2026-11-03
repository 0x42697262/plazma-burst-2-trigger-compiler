import fs from 'node:fs';
import path from 'node:path';
import { emitXml, stagingPosition } from '../emit/xml-emitter.ts';
import { checkObjects } from '../objects/objects.ts';
import { placeObjects, regionsOf, withMapTriggers } from '../emit/place.ts';
import { missingHostObject } from '../objects/missing.ts';
import type { Layout } from '../emit/xml-emitter.ts';
import { DEFAULT_LAYOUT } from '../emit/constants.ts';
import { VAR_SYNC_IN_MAP } from '../emit/attributes.ts';
import { emitText, joinTextBlocks } from '../emit/trigger-text-emitter.ts';
import { appendToMap, removeOwned } from '../emit/merge.ts';
import { checkHostNames, checkHostUses } from '../compiler/host.ts';
import { createNames, describeLegend, seededPrefix } from '../compiler/names.ts';
import { isRandomSeed, randomSeed, resolveSeed } from '../obfuscate/random.ts';
import { tamperCheckOf } from '../tamper/options.ts';
import { TAMPER_MODE } from '../tamper/keys.ts';
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

const obfuscationSeed = (parsed: ReturnType<typeof parseArguments>, defaultSeed: string): string | null => {
  const seed = lastValue(parsed, FLAG.obfuscateSeed);
  if (seed !== null) return resolveSeed(seed);
  return parsed.flags.has(FLAG.obfuscate) ? lastValue(parsed, FLAG.nameSeed) ?? defaultSeed : null;
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

type BuildRecord = { uids: string[]; walls: string[] };

const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);

const readBuildRecord = (file: string): BuildRecord => {
  if (!fs.existsSync(file)) return { uids: [], walls: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, FILE_ENCODING)) as { uids?: unknown; walls?: unknown };
    return { uids: texts(parsed.uids), walls: texts(parsed.walls) };
  } catch {
    return { uids: [], walls: [] };
  }
};

const showValue = (value: unknown): string => (typeof value === 'string' || Array.isArray(value) ? JSON.stringify(value) : stringOf(value));

const simulate = (result: CompileResult, frames: number, output: Output): void => {
  const simulation = new Simulation(withMapTriggers(result.program, result.mapObjects), { regions: regionsOf(result.mapObjects) });
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
    const nameSeed = lastValue(parsed, FLAG.nameSeed);
    const givenPrefix = lastValue(parsed, FLAG.prefix);
    if (nameSeed !== null && givenPrefix !== null) throw new UsageError(TEXT.seedWithPrefix);
    const plainPrefix = givenPrefix ?? frontEnd.prefixOf(source) ?? prefixFromFile(file);
    const seed = obfuscationSeed(parsed, plainPrefix);
    if (seed !== null && isRandomSeed(lastValue(parsed, FLAG.obfuscateSeed) ?? '')) output.out(TEXT.randomSeed(seed));
    const prefix = nameSeed !== null ? seededPrefix(nameSeed) : givenPrefix ?? (seed === null ? plainPrefix : seededPrefix(seed));
    const tamper = tamperCheckOf({
      mode: lastValue(parsed, FLAG.tamperCheck) ?? TAMPER_MODE.off, seed: lastValue(parsed, FLAG.tamperSeed), layers: lastValue(parsed, FLAG.tamperLayers),
      announce: parsed.flags.has(FLAG.tamperAnnounce),
      fallbackSeed: () => {
        if (seed !== null) return seed;
        const fresh = randomSeed();
        output.out(TEXT.tamperSeed(fresh));
        return fresh;
      },
    });
    if (tamper !== null && isRandomSeed(lastValue(parsed, FLAG.tamperSeed) ?? '')) output.out(TEXT.tamperSeed(tamper.seed));
    const result = frontEnd.compile(source, prefix, { ...options, obfuscate: seed === null ? null : { seed }, tamper }, file);
    if (result.tamper !== null) output.out(TEXT.tamperFindings(result.tamper.variables.findings, result.tamper.variables.last));
    for (const warning of result.warnings) output.err(TEXT.warning(warning));
    const actions = result.program.triggers.reduce((total, trigger) => total + trigger.actions.length, 0);
    output.out(TEXT.summary(result.program.triggers.length, actions, result.program.timers.length));
    if (result.exports.length > 0) output.out(TEXT.exported(result.exports.map((entry) => TEXT.exportedEntry(entry.name, entry.gameName))));
    const base = path.join(lastValue(parsed, FLAG.out) ?? DEFAULT_OUT, path.basename(file, path.extname(file)));
    const check = hostMap === null ? null : checkObjects(result.objects, hostMap);
    const objectProblems = [...(check?.problems ?? []), ...(check?.missing ?? []).map(missingHostObject)];
    if (objectProblems.length > 0) throw new UsageError(TEXT.objectProblems(objectProblems));
    const names = createNames(prefix);
    const buildPath = base + OUTPUT.build;
    const recorded = replacing ? readBuildRecord(buildPath) : { uids: [], walls: [] };
    const recordedUids = new Set(recorded.uids);
    const host = hostMap === null ? null : replacing ? removeOwned(hostMap, (uid) => recordedUids.has(uid) || names.ownsUid(uid)) : hostMap;
    const placement = placeObjects(result.mapObjects, {
      host, staging: (index) => stagingPosition(index, result.program, layout), previousWalls: recorded.walls, replacing,
    });
    if (placement.problems.length > 0) throw new UsageError(TEXT.objectProblems(placement.problems));
    for (const note of placement.notes) output.out(note);
    const program = placement.declaresVarSync ? { ...result.program, varSyncMark: false } : result.program;
    const xml = placement.xml + emitXml(program, layout);
    writeFile(base + OUTPUT.xml, xml, output);
    try {
      const textProgram = withMapTriggers(result.program, result.mapObjects);
      writeFile(base + OUTPUT.text, joinTextBlocks(emitText(textProgram)), output);
      if (result.program.varSyncMark) output.err(TEXT.warning(TEXT.textNeedsVarSync));
      if (result.obfuscation !== null) output.err(TEXT.warning(TEXT.textNeedsOrder));
      if (textProgram.timers.length > 0) output.err(TEXT.warning(TEXT.textHasNoTimers(textProgram.timers.map((timer) => TEXT.timerTarget(timer.uid, timer.target)))));
    } catch (error) {
      fs.rmSync(base + OUTPUT.text, { force: true });
      output.err(TEXT.warning(TEXT.noText(error instanceof Error ? error.message : String(error))));
    }
    writeFile(base + OUTPUT.sourceMap, JSON.stringify(result.sourceMap, null, JSON_INDENT), output);
    if (result.obfuscation !== null) {
      writeFile(base + OUTPUT.names, JSON.stringify({ prefix, seed, names: describeLegend(prefix, result.obfuscation.legend) }, null, JSON_INDENT), output);
    }
    if (placement.host !== null) {
      const mapUids = new Set(result.mapObjects.flatMap((object) => (object.uid === null ? [] : [object.uid])));
      const hostOnly = removeOwned(placement.host, (uid) => mapUids.has(uid));
      for (const warning of checkHostNames(result.program, hostOnly)) output.err(TEXT.warning(warning));
      for (const warning of checkHostUses(hostOnly, names.ownsVariable, result.exports)) output.err(TEXT.warning(warning));
      writeFile(base + OUTPUT.map, appendToMap(placement.host, xml), output);
      const producedUids = [...result.program.triggers.map((trigger) => trigger.uid), ...result.program.timers.map((timer) => timer.uid)];
      writeFile(buildPath, JSON.stringify({ prefix, uids: producedUids, walls: placement.walls }, null, JSON_INDENT), output);
    }
    if (parsed.flags.has(FLAG.run)) simulate(result, frames, output);
    return 0;
  } catch (error) {
    output.err(TEXT.error(error instanceof Error ? error.message : String(error)));
    return EXIT_FAILURE;
  }
}
