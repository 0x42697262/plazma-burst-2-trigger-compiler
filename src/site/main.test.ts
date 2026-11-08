import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from './main.ts';
import type { Context } from './main.ts';
import type { Fetch } from './client.ts';
import { passwordHash } from './protocol.ts';
import { sessionFile } from './paths.ts';

const LOGIN = 'Maker';
const PASSWORD = 'hunter2';
const MAP_FORM = '<form name="form1"><input name="mapname" value="one"><input name="uploadfile" type="file"></form>';

type Site = { maps: Map<string, string>; open: Map<string, string>; requests: string[] };

function fakeSite(site: Site): Fetch {
  return async (url, init) => {
    const target = new URL(url);
    const method = init.method ?? 'GET';
    site.requests.push(`${method} ${target.pathname}${target.search}`);
    const cookie = String((init.headers as Record<string, string>).cookie);
    const signedIn = cookie.includes(`login=${LOGIN}`) && cookie.includes(`password=${passwordHash(PASSWORD)}`);
    if (target.pathname === '/level_editor/e_server.php') {
      return new Response(signedIn ? `knownmaps = ${JSON.stringify([...site.maps.keys()])};` : '');
    }
    if (target.pathname === '/level_editor/map_download.php') {
      const mapId = target.searchParams.get('r') ?? '';
      const xml = signedIn ? site.maps.get(mapId) ?? site.open.get(mapId) : undefined;
      return new Response(xml ?? 'Can\'t download map. Nothing to download?');
    }
    const mapId = target.searchParams.get('m');
    if (mapId !== null) {
      if (method === 'POST') {
        const file = (init.body as FormData).get('uploadfile') as File;
        site.maps.set(mapId, await file.text());
      }
      return new Response(signedIn && site.maps.has(mapId) ? MAP_FORM : '<html></html>');
    }
    if (method === 'POST') {
      const name = (init.body as URLSearchParams).get('id') ?? '';
      const created = `${LOGIN.toLowerCase()}-${name.toLowerCase()}`;
      if (site.maps.has(created)) return new Response('<span style="color:#FF0000">Map with same ID already exists</span>');
      site.maps.set(created, '');
    }
    return new Response('<html></html>');
  };
}

function setup(answers: string[] = []) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ptc-site-'));
  const site: Site = { maps: new Map([['maker-arena', '<box x="0" />']]), open: new Map([['other-open', '<box x="5" />']]), requests: [] };
  const lines: string[] = [];
  const errors: string[] = [];
  const remaining = [...answers];
  const context: Context = {
    output: { out: (line) => lines.push(line), err: (line) => errors.push(line) },
    environment: {},
    sessionFile: path.join(folder, 'config', 'session.json'),
    prompter: { ask: async () => remaining.shift() ?? '', askHidden: async () => remaining.shift() ?? '' },
    fetcher: fakeSite(site),
    now: () => new Date('2026-11-08T12:34:56.789Z'),
  };
  const run = (...argv: string[]) => main(argv, context);
  return { folder, site, lines, errors, context, run };
}

describe('site command', () => {
  it('signs in after the site accepts the password, keeping only its md5 in a private file', async () => {
    const { run, lines, context } = setup([LOGIN, PASSWORD]);
    assert.equal(await run('login'), 0);
    assert.match(lines[0] ?? '', /^Signed in as Maker/);
    const saved = JSON.parse(fs.readFileSync(context.sessionFile, 'utf8'));
    assert.deepEqual(saved, { schemaVersion: 1, login: LOGIN, passwordHash: passwordHash(PASSWORD) });
    assert.equal(fs.statSync(context.sessionFile).mode & 0o777, 0o600);
    assert.equal(await run('logout'), 0);
    assert.equal(fs.existsSync(context.sessionFile), false);
  });

  it('saves nothing when the site refuses the password', async () => {
    const { run, errors, context } = setup([LOGIN, 'wrong']);
    assert.equal(await run('login'), 1);
    assert.match(errors[0] ?? '', /refused the login or password/);
    assert.equal(fs.existsSync(context.sessionFile), false);
  });

  it('signs in from PB2_LOGIN and PB2_PASSWORD without a file', async () => {
    const { run, lines, context } = setup();
    const withEnvironment = { ...context, environment: { PB2_LOGIN: LOGIN, PB2_PASSWORD: passwordHash(PASSWORD) } };
    assert.equal(await main(['maps'], withEnvironment), 0);
    assert.deepEqual(lines, ['1 map(s) of Maker:', '  maker-arena']);
    assert.equal(await run('maps'), 1);
  });

  it('pulls own and open-source maps and denies the others', async () => {
    const { run, folder, lines, errors } = setup([LOGIN, PASSWORD]);
    await run('login');
    const out = path.join(folder, 'maps');
    assert.equal(await run('pull', 'Other-Open', '--out', out, '--ptc'), 0);
    assert.equal(fs.readFileSync(path.join(out, 'other-open.xml'), 'utf8'), '<box x="5" />');
    assert.match(fs.readFileSync(path.join(out, 'other-open.ptc'), 'utf8'), /map \{/);
    assert.ok(lines.some((line) => line.endsWith('other-open.ptc')));
    assert.equal(await run('pull', 'other-closed', '--out', out), 1);
    assert.match(errors[0] ?? '', /Cannot open other-closed: it is not yours and not open source/);
  });

  it('pushes to own maps only, with the backup off unless asked for', async () => {
    const { run, folder, site, lines, errors } = setup([LOGIN, PASSWORD]);
    await run('login');
    const file = path.join(folder, 'new.xml');
    fs.writeFileSync(file, '<box x="9" />\n');
    const backups = path.join(folder, 'saved');
    assert.equal(await run('push', file, 'maker-arena', '--backup-dir', backups), 0);
    assert.equal(fs.existsSync(backups), false);
    assert.equal(site.maps.get('maker-arena'), '<box x="9" />\n');
    assert.equal(lines.at(-1), 'Saved maker-arena.');
    fs.writeFileSync(file, '<box x="10" />');
    assert.equal(await run('push', file, 'maker-arena', '--backup', '--backup-dir', backups), 0);
    assert.equal(fs.readFileSync(path.join(backups, 'maker-arena-2026-11-08T12-34-56-789Z.xml'), 'utf8'), '<box x="9" />\n');
    assert.equal(await run('push', file, 'other-open'), 1);
    assert.match(errors.at(-1) ?? '', /read-only/);
    assert.equal(site.open.get('other-open'), '<box x="5" />');
    assert.equal(await run('push', file, 'maker-missing'), 1);
    assert.match(errors.at(-1) ?? '', /not one of your maps/);
  });

  it('refuses a file that is not map XML before touching the site', async () => {
    const { run, folder, site, errors } = setup([LOGIN, PASSWORD]);
    await run('login');
    const file = path.join(folder, 'program.ptc');
    fs.writeFileSync(file, 'say("hi");');
    const before = site.requests.length;
    assert.equal(await run('push', file, 'maker-arena'), 1);
    assert.match(errors[0] ?? '', /not map XML/);
    assert.equal(site.requests.length, before);
  });

  it('creates maps with or without the login prefix and reports the site\'s refusal', async () => {
    const { run, lines, errors } = setup([LOGIN, PASSWORD]);
    await run('login');
    assert.equal(await run('new', 'Probe'), 0);
    assert.equal(lines.at(-1), 'Created maker-probe.');
    assert.equal(await run('new', 'maker-probe'), 1);
    assert.match(errors[0] ?? '', /Map with same ID already exists/);
  });

  it('explains usage mistakes', async () => {
    const { run, lines, errors } = setup();
    assert.equal(await run(), 0);
    assert.match(lines[0] ?? '', /^Usage: npm run site/);
    assert.equal(await run('fly'), 1);
    assert.equal(await run('pull'), 1);
    assert.equal(await run('maps'), 1);
    assert.deepEqual(errors, ['error: Unknown command fly. See --help.', 'error: Missing a map id. See --help.', 'error: Not signed in: run npm run site -- login.']);
  });

  it('keeps the sign-in under the user\'s config folder', () => {
    assert.equal(sessionFile({ XDG_CONFIG_HOME: '/config' }), path.join('/config', 'pb2-trigger-compiler', 'site-session.json'));
  });
});
