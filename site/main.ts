import fs from 'node:fs';
import path from 'node:path';
import { convertMap } from '../convert/convert.ts';
import { STYLE } from '../convert/keys.ts';
import { createSiteClient, SiteError } from './client.ts';
import type { Fetch, SiteClient } from './client.ts';
import {
  BACKUP_NAME, COMMAND, DEFAULT_BACKUP_DIR, SYSTEM_ERROR_FIELD, DEFAULT_OUT, FILE_ENCODING, FLAG, FLAG_START, SOURCE_EXTENSION, TIME_SAFE, TIME_UNSAFE, VALUE_FLAGS, XML_EXTENSION,
} from './keys.ts';
import { isMapXml, ownMapPrefix, passwordHash, sameMap } from './protocol.ts';
import type { Account } from './protocol.ts';
import { PromptCancelled } from './prompt.ts';
import type { Prompter } from './prompt.ts';
import { accountFromEnvironment, readSession, removeSession, SessionError, writeSession } from './session.ts';
import { EXIT_FAILURE } from './constants.ts';
import { TEXT } from './text.ts';

export type Output = { out: (line: string) => void; err: (line: string) => void };
export type Context = Readonly<{
  output: Output;
  environment: NodeJS.ProcessEnv;
  sessionFile: string;
  prompter: Prompter | null;
  fetcher?: Fetch;
  now?: () => Date;
}>;
type Parsed = { command: string; positional: string[]; values: Map<string, string>; switches: Set<string> };

class UsageError extends Error {}
class CommandError extends Error {}

function parseArguments(argv: readonly string[]): Parsed | null {
  const positional: string[] = [];
  const values = new Map<string, string>();
  const switches = new Set<string>();
  for (let position = 0; position < argv.length; position++) {
    const argument = argv[position] ?? '';
    if (argument === FLAG.help) return null;
    if (VALUE_FLAGS.has(argument)) {
      const value = argv[position + 1];
      if (value === undefined) throw new UsageError(TEXT.missingValue(argument));
      values.set(argument, value);
      position++;
    } else if (Object.values<string>(FLAG).includes(argument)) {
      switches.add(argument);
    } else if (argument.startsWith(FLAG_START)) {
      throw new UsageError(TEXT.unknownFlag(argument));
    } else {
      positional.push(argument);
    }
  }
  const [command, ...rest] = positional;
  if (command === undefined) return null;
  return { command, positional: rest, values, switches };
}

function takeArguments(parsed: Parsed, names: readonly string[], optional = 0): (string | undefined)[] {
  if (parsed.positional.length > names.length) throw new UsageError(TEXT.tooManyArguments);
  const required = names.length - optional;
  const missing = names.slice(parsed.positional.length, required)[0];
  if (missing !== undefined) throw new UsageError(TEXT.missingArgument(missing));
  return names.map((_, index) => parsed.positional[index]);
}

function signedInAccount(context: Context): Account {
  const account = accountFromEnvironment(context.environment) ?? readSession(context.sessionFile);
  if (account === null) throw new CommandError(TEXT.notSignedIn);
  return account;
}

async function ownMaps(client: SiteClient): Promise<string[]> {
  const maps = await client.listMaps();
  if (maps === null) throw new CommandError(TEXT.badSignIn);
  return maps;
}

async function login(parsed: Parsed, context: Context): Promise<void> {
  const [given] = takeArguments(parsed, [TEXT.argumentName.login], 1);
  const fromEnvironment = accountFromEnvironment(context.environment);
  if (fromEnvironment !== null && given === undefined) {
    await ownMaps(createSiteClient(fromEnvironment, context.fetcher));
    context.output.out(TEXT.signedInFromEnvironment(fromEnvironment.login));
    return;
  }
  if (context.prompter === null) throw new CommandError(TEXT.noTerminal);
  const loginName = (given ?? await context.prompter.ask(TEXT.loginPrompt)).trim();
  if (loginName === '') throw new CommandError(TEXT.emptyLogin);
  const account = { login: loginName, passwordHash: passwordHash(await context.prompter.askHidden(TEXT.passwordPrompt)) };
  await ownMaps(createSiteClient(account, context.fetcher));
  writeSession(context.sessionFile, account);
  context.output.out(TEXT.signedIn(account.login, context.sessionFile));
}

function logout(parsed: Parsed, context: Context): void {
  takeArguments(parsed, []);
  context.output.out(removeSession(context.sessionFile) ? TEXT.signedOut(context.sessionFile) : TEXT.wasNotSignedIn);
}

async function maps(parsed: Parsed, context: Context): Promise<void> {
  takeArguments(parsed, []);
  const account = signedInAccount(context);
  const list = await ownMaps(createSiteClient(account, context.fetcher));
  if (list.length === 0) {
    context.output.out(TEXT.noMaps);
    return;
  }
  context.output.out(TEXT.mapCount(account.login, list.length));
  for (const mapId of list) context.output.out(TEXT.mapLine(mapId));
}

function writeFile(folder: string, name: string, text: string, output: Output): string {
  fs.mkdirSync(folder, { recursive: true });
  const target = path.join(folder, name);
  fs.writeFileSync(target, text);
  output.out(TEXT.wrote(target));
  return target;
}

async function pull(parsed: Parsed, context: Context): Promise<void> {
  const [given = ''] = takeArguments(parsed, [TEXT.argumentName.mapId]);
  const mapId = given.toLowerCase();
  const xml = await createSiteClient(signedInAccount(context), context.fetcher).download(mapId);
  if (xml === null) throw new CommandError(TEXT.cannotRead(mapId));
  const folder = parsed.values.get(FLAG.out) ?? DEFAULT_OUT;
  writeFile(folder, mapId + XML_EXTENSION, xml, context.output);
  if (!parsed.switches.has(FLAG.ptc)) return;
  const conversion = convertMap(xml, { style: STYLE.functions, label: mapId + XML_EXTENSION });
  writeFile(folder, mapId + SOURCE_EXTENSION, conversion.source, context.output);
  for (const note of conversion.notes) context.output.out(TEXT.note(note));
}

async function push(parsed: Parsed, context: Context): Promise<void> {
  const [file = '', given = ''] = takeArguments(parsed, [TEXT.argumentName.file, TEXT.argumentName.mapId]);
  const mapId = given.toLowerCase();
  const account = signedInAccount(context);
  const prefix = ownMapPrefix(account.login);
  if (!mapId.startsWith(prefix)) throw new CommandError(TEXT.notYours(mapId, prefix));
  const xml = fs.readFileSync(file, FILE_ENCODING);
  if (!isMapXml(xml)) throw new CommandError(TEXT.notMapXml(file));
  const client = createSiteClient(account, context.fetcher);
  if (!(await ownMaps(client)).includes(mapId)) throw new CommandError(TEXT.notOnList(mapId));
  if (parsed.switches.has(FLAG.backup)) {
    const current = await client.download(mapId);
    if (current === null) throw new CommandError(TEXT.cannotRead(mapId));
    const time = (context.now ?? (() => new Date()))().toISOString().replace(TIME_UNSAFE, TIME_SAFE);
    const target = path.join(parsed.values.get(FLAG.backupDir) ?? DEFAULT_BACKUP_DIR, BACKUP_NAME(mapId, time));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, current);
    context.output.out(TEXT.backedUp(target));
  }
  await client.replace(mapId, xml);
  const after = await client.download(mapId);
  if (after !== null && sameMap(after, xml)) context.output.out(TEXT.saved(mapId));
  else context.output.err(TEXT.warning(TEXT.savedDifferent(mapId)));
}

async function create(parsed: Parsed, context: Context): Promise<void> {
  const [given = ''] = takeArguments(parsed, [TEXT.argumentName.name]);
  const account = signedInAccount(context);
  const prefix = ownMapPrefix(account.login);
  const name = given.toLowerCase().startsWith(prefix) ? given.slice(prefix.length) : given;
  const mapId = (prefix + name).toLowerCase();
  const client = createSiteClient(account, context.fetcher);
  await client.create(name);
  if (!(await ownMaps(client)).includes(mapId)) throw new CommandError(TEXT.notCreated(mapId));
  context.output.out(TEXT.created(mapId));
}

const COMMANDS: Readonly<Record<string, (parsed: Parsed, context: Context) => Promise<void> | void>> = Object.freeze({
  [COMMAND.login]: login, [COMMAND.logout]: logout, [COMMAND.maps]: maps, [COMMAND.pull]: pull, [COMMAND.push]: push, [COMMAND.new]: create,
});

const isReported = (error: unknown): error is Error => error instanceof UsageError || error instanceof CommandError || error instanceof SiteError;

export async function main(argv: readonly string[], context: Context): Promise<number> {
  try {
    const parsed = parseArguments(argv);
    if (parsed === null) {
      context.output.out(TEXT.usage);
      return 0;
    }
    const run = COMMANDS[parsed.command];
    if (run === undefined) throw new UsageError(TEXT.unknownCommand(parsed.command));
    await run(parsed, context);
    return 0;
  } catch (error) {
    if (error instanceof SessionError) context.output.err(TEXT.error(TEXT.badSession(context.sessionFile)));
    else if (error instanceof PromptCancelled) context.output.err(TEXT.cancelled);
    else if (isReported(error)) context.output.err(TEXT.error(error.message));
    else if (error instanceof Error && SYSTEM_ERROR_FIELD in error) context.output.err(TEXT.error(error.message));
    else throw error;
    return EXIT_FAILURE;
  }
}
