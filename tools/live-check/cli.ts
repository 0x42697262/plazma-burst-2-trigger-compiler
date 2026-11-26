import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { emitXml } from '../../emit/xml-emitter.ts';
import { appendToMap } from '../../emit/merge.ts';
import { placeObjects, regionsOf, withMapTriggers } from '../../emit/place.ts';
import type { MapObject } from '../../objects/types.ts';
import { BASE_MAP } from '../../emit/keys.ts';
import { Simulation } from '../../sim/simulator.ts';
import { frontEndFor } from '../../cli/frontends.ts';
import { prefixFromFile } from '../../cli/main.ts';
import { createNames } from '../../compiler/names.ts';
import { CASES_DIRECTORIES, GAME_NAMES_FILE, REPOSITORY_ROOT, MAP_FILE, MAP_NAME, SANDBOX } from './paths.ts';
import { prepareSandbox } from './sandbox.ts';
import { CASE_EXTENSIONS, ELECTRON_ARGUMENTS, ENTER_KEY, GUEST_NAME, EXPRESSION, FILE_ENCODING, FRAME, KEY_EVENTS, MAP_VARIABLES_KEY, METHOD, NAMES_GLOBAL, NPX, PAGE_TYPE, REBUILD_FLAG, DIRECT_INDEX_FLAG, PCODE_FLAG, OBFUSCATE_FLAG, OBFUSCATE_SEED, PCODE_TARGET, ONLY_FLAG, TAMPER_FLAG, TAMPER_SEED, SIGNAL, SIMULATE_FLAG, SPACE_KEY } from './keys.ts';
import {
  CLICK_ATTEMPTS, CLICK_PAUSE, CONSOLE_TIMEOUT, DEBUG_PORT, ENTER_KEY_CODE, FIRST_USER_ARGUMENT, GAMING_TIMEOUT, LAUNCH_TIMEOUT, MENU_TIMEOUT, MILLISECONDS,
  RUN_SECONDS, SETTLE_MILLISECONDS, SIMULATED_FRAMES, SIMULATED_MAX_STEPS, PCODE_LOOP_GUARD, SIMULATED_PLAYERS, SPACE_KEY_CODE, STAGING,
} from './constants.ts';
import { TEXT } from './text.ts';
import { Session, listTargets, sleep, waitFor } from './cdp.ts';
import { compareSnapshots, encodeVariables } from './compare.ts';
import type { CompileOptions } from '../../compiler/compile.ts';
import { DEFAULT_TARGET, VM_VARIABLE } from '../../pcode/keys.ts';
import type { Snapshot } from './compare.ts';
import { tamperCheckOf } from '../../tamper/options.ts';

type Case = { name: string; prefix: string; xml: string; objects: readonly MapObject[]; simulated: Snapshot; errors: string[]; mapDependent: readonly string[] };

const print = (line: string): void => {
  process.stdout.write(line + TEXT.lineEnd);
};

function loadCases(options: Partial<CompileOptions>): Case[] {
  const files = CASES_DIRECTORIES.flatMap((folder) => fs.readdirSync(folder)
    .filter((file) => CASE_EXTENSIONS.includes(path.extname(file))).sort()
    .map((file) => path.join(folder, file)));
  return files.map((file) => {
    const source = fs.readFileSync(file, FILE_ENCODING);
    const frontEnd = frontEndFor(file);
    const prefix = frontEnd.prefixOf(source) ?? prefixFromFile(file);
    const result = frontEnd.compile(source, prefix, options, file);
    const simulation = new Simulation(withMapTriggers(result.program, result.mapObjects), { players: SIMULATED_PLAYERS, maxSteps: SIMULATED_MAX_STEPS, regions: regionsOf(result.mapObjects) });
    simulation.tick(SIMULATED_FRAMES);
    return {
      name: path.relative(REPOSITORY_ROOT, file), prefix, xml: emitXml(result.program), objects: result.mapObjects, simulated: encodeVariables(simulation.variables), errors: simulation.errors,
      mapDependent: [...(result.obfuscation?.mapDependent ?? []), ...(result.tamper?.variables.timeDependent ?? [])],
    };
  });
}

function mapVariablesName(): string {
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(GAME_NAMES_FILE, FILE_ENCODING), sandbox);
  const names = sandbox[NAMES_GLOBAL] as Record<string, string> | undefined;
  const name = names?.[MAP_VARIABLES_KEY];
  if (!name) throw new Error(TEXT.noNames);
  return name;
}

async function findPage(port: number, expression: string): Promise<Session | false> {
  for (const target of (await listTargets(port)).filter((entry) => entry.type === PAGE_TYPE)) {
    const session = await Session.open(target);
    if ((await session.evaluate(expression)) === true) return session;
    session.close();
  }
  return false;
}

async function readGameVariables(variablesName: string): Promise<Snapshot> {
  const app = spawn(NPX, ELECTRON_ARGUMENTS(DEBUG_PORT), { cwd: SANDBOX, stdio: 'ignore', detached: true });
  try {
    const launcher = await waitFor(() => findPage(DEBUG_PORT, EXPRESSION.hasServers), LAUNCH_TIMEOUT, TEXT.launcher);
    await launcher.evaluate(EXPRESSION.playOfficial);
    launcher.close();
    const game = await waitFor(() => findPage(DEBUG_PORT, EXPRESSION.hasGame), CONSOLE_TIMEOUT, TEXT.game);
    const frame = async (): Promise<unknown> => game.evaluate(EXPRESSION.frameLabel);
    await waitFor(async () => {
      const label = await frame();
      if (label === FRAME.namePrompt) {
        await game.send(METHOD.insertText, { text: GUEST_NAME });
        for (const type of KEY_EVENTS) await game.send(METHOD.key, { type, ...ENTER_KEY, windowsVirtualKeyCode: ENTER_KEY_CODE });
      }
      return label === FRAME.menu;
    }, MENU_TIMEOUT, TEXT.menu);
    await sleep(SETTLE_MILLISECONDS);
    await game.evaluate(EXPRESSION.openMap(MAP_NAME));
    await sleep(SETTLE_MILLISECONDS);
    for (let attempt = 0; attempt < CLICK_ATTEMPTS && (await frame()) !== FRAME.gaming; attempt++) {
      for (const type of KEY_EVENTS) await game.send(METHOD.key, { type, ...SPACE_KEY, windowsVirtualKeyCode: SPACE_KEY_CODE });
      await sleep(CLICK_PAUSE);
    }
    await waitFor(async () => (await frame()) === FRAME.gaming, GAMING_TIMEOUT, TEXT.gaming);
    await sleep(RUN_SECONDS * MILLISECONDS);
    const raw = await game.evaluate(EXPRESSION.readVariables(variablesName));
    game.close();
    return JSON.parse(String(raw)) as Snapshot;
  } finally {
    if (app.pid !== undefined) process.kill(-app.pid, SIGNAL);
  }
}

async function main(): Promise<number> {
  const flags = process.argv.slice(FIRST_USER_ARGUMENT);
  const pcode = flags.includes(PCODE_FLAG);
  const only = flags.flatMap((flag, position) => (flag === ONLY_FLAG ? [flags[position + 1] ?? ''] : []));
  const tamperPosition = flags.indexOf(TAMPER_FLAG);
  const tamper = tamperPosition < 0 ? null : tamperCheckOf({ mode: flags[tamperPosition + 1] ?? '', seed: TAMPER_SEED, layers: null, fallbackSeed: () => TAMPER_SEED });
  const cases = loadCases({
    directIndex: flags.includes(DIRECT_INDEX_FLAG), target: pcode ? PCODE_TARGET : DEFAULT_TARGET, ...(pcode ? { loopGuard: PCODE_LOOP_GUARD } : {}),
    obfuscate: flags.includes(OBFUSCATE_FLAG) ? { seed: OBFUSCATE_SEED } : null, tamper,
  }).filter((entry) => only.length === 0 || only.some((part) => entry.name.includes(part)));
  prepareSandbox(flags.includes(REBUILD_FLAG), print);
  const map = cases.reduce((combined, entry) => {
    const placement = placeObjects(entry.objects, { host: combined, staging: () => STAGING, previousWalls: [], replacing: true });
    return appendToMap(placement.host ?? combined, placement.xml + entry.xml);
  }, BASE_MAP);
  fs.writeFileSync(MAP_FILE, map);
  print(TEXT.wroteMap(MAP_FILE, cases.length));
  if (flags.includes(SIMULATE_FLAG)) {
    for (const entry of cases) {
      print(TEXT.simulatedOnly(entry.name, Object.keys(entry.simulated).length, entry.errors.length));
      for (const error of entry.errors) print(TEXT.simulatorError(entry.name, error));
    }
    return 0;
  }
  const game = await readGameVariables(mapVariablesName());
  let passed = 0;
  for (const entry of cases) {
    const names = createNames(entry.prefix);
    const mapIndependent = (name: string): boolean => names.ownsVariable(name) && name !== names.internalVariable(VM_VARIABLE.base) && !entry.mapDependent.includes(name);
    const mismatches = compareSnapshots(entry.simulated, game, mapIndependent);
    print(TEXT.caseResult(entry.name, mismatches.length === 0));
    for (const mismatch of mismatches) {
      print(TEXT.mismatch(mismatch.name, mismatch.simulated, mismatch.game));
    }
    if (mismatches.length === 0) passed += 1;
  }
  print(TEXT.summary(passed, cases.length));
  return passed === cases.length ? 0 : 1;
}

process.exitCode = await main();
