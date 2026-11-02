import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { emitXml } from '../../emit/xml-emitter.ts';
import { appendToMap } from '../../emit/merge.ts';
import { BASE_MAP } from '../../emit/keys.ts';
import { Simulation } from '../../sim/simulator.ts';
import { frontEndFor } from '../../cli/frontends.ts';
import { prefixFromFile } from '../../cli/main.ts';
import { createNames } from '../../compiler/names.ts';
import { CASES_DIRECTORY, GAME_NAMES_FILE, MAP_FILE, MAP_NAME, SANDBOX } from './paths.ts';
import { prepareSandbox } from './sandbox.ts';
import { CASE_EXTENSIONS, ELECTRON_ARGUMENTS, EXPRESSION, FILE_ENCODING, FRAME, KEY_EVENTS, MAP_VARIABLES_KEY, METHOD, NAMES_GLOBAL, NPX, PAGE_TYPE, REBUILD_FLAG, SIGNAL, SIMULATE_FLAG, SPACE_KEY } from './keys.ts';
import {
  CLICK_ATTEMPTS, CLICK_PAUSE, CONSOLE_TIMEOUT, DEBUG_PORT, FIRST_USER_ARGUMENT, GAMING_TIMEOUT, LAUNCH_TIMEOUT, MENU_TIMEOUT, MILLISECONDS,
  RUN_SECONDS, SETTLE_MILLISECONDS, SIMULATED_FRAMES, SPACE_KEY_CODE,
} from './constants.ts';
import { TEXT } from './text.ts';
import { Session, listTargets, sleep, waitFor } from './cdp.ts';
import { compareSnapshots, encodeVariables } from './compare.ts';
import type { Snapshot } from './compare.ts';

type Case = { name: string; prefix: string; xml: string; simulated: Snapshot; errors: string[] };

const print = (line: string): void => {
  process.stdout.write(line + TEXT.lineEnd);
};

function loadCases(): Case[] {
  const files = fs.readdirSync(CASES_DIRECTORY).filter((file) => CASE_EXTENSIONS.includes(path.extname(file))).sort();
  return files.map((file) => {
    const fullPath = path.join(CASES_DIRECTORY, file);
    const source = fs.readFileSync(fullPath, FILE_ENCODING);
    const frontEnd = frontEndFor(file);
    const prefix = frontEnd.prefixOf(source) ?? prefixFromFile(file);
    const result = frontEnd.compile(source, prefix, {});
    const simulation = new Simulation(result.program);
    simulation.tick(SIMULATED_FRAMES);
    return { name: file, prefix, xml: emitXml(result.program), simulated: encodeVariables(simulation.variables), errors: simulation.errors };
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
    await waitFor(async () => (await frame()) === FRAME.menu, MENU_TIMEOUT, TEXT.menu);
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
  const cases = loadCases();
  prepareSandbox(flags.includes(REBUILD_FLAG), print);
  const map = cases.reduce((combined, entry) => appendToMap(combined, entry.xml), BASE_MAP);
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
    const mismatches = compareSnapshots(entry.simulated, game, createNames(entry.prefix).ownsVariable);
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
