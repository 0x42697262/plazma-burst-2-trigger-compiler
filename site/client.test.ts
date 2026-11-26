import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSiteClient, SiteError } from './client.ts';
import type { Fetch } from './client.ts';
import { cookieHeader, decodeEntities, isMapXml, isPasswordHash, parseMapList, parseSettingsForm, passwordHash, sameMap, siteErrors } from './protocol.ts';

const ACCOUNT = { login: 'Some User', passwordHash: passwordHash('secret') };

const SETTINGS_PAGE = `
<form name="search"><input name="q" value="ignored"></form>
<form name="form1" method="post" action="" enctype="multipart/form-data">
  <input name="mapname" type="text" value="one &amp; two">
  <textarea name="descr" class="linb">A &lt;b&gt; map
second line</textarea>
  <input name="published" type="radio" value="yes">
  <input type="radio" name="published" value="no" checked>
  <select name="shared_mode"><option value="0">Closed <option value="2" selected>Open </select>
  <select name="for_mode"><option value="10">Testing <option value="1">Single </select>
  <input name="uploadfile" id="uploadfile" type="file">
  <input name="button" type="button" value="Get Map ID">
  <input name="save" type="submit" value="Save map settings">
</form>`;

type Call = { url: string; init: RequestInit };

function fakeSite(answers: Record<string, string>, status = 200): { fetcher: Fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: Fetch = async (url, init) => {
    calls.push({ url, init });
    const path = url.replace('https://www.plazmaburst2.com', '');
    const key = `${init.method ?? 'GET'} ${path}`;
    return new Response(answers[key] ?? '', { status });
  };
  return { fetcher, calls };
}

describe('site protocol', () => {
  it('hashes passwords with md5 and knows an md5 when it sees one', () => {
    assert.equal(passwordHash('secret'), '5ebe2294ecd0e0f08eab7690d2a6ee69');
    assert.equal(isPasswordHash('5EBE2294ECD0E0F08EAB7690D2A6EE69'), true);
    assert.equal(isPasswordHash('secret'), false);
  });

  it('sends the login, the password hash and a pb2uid as cookies', () => {
    assert.equal(cookieHeader(ACCOUNT), 'login=Some%20User; password=5ebe2294ecd0e0f08eab7690d2a6ee69; pb2uid=1');
  });

  it('reads the map list, and nothing when signed out', () => {
    assert.deepEqual(parseMapList('\t\tknownmaps = ["user-a", "user-b"];\n'), ['user-a', 'user-b']);
    assert.equal(parseMapList(''), null);
  });

  it('reads the red error lines and tells map XML from messages', () => {
    assert.deepEqual(siteErrors('<td><span style="color:#FF0000">Map with same ID already exists</span>'), ['Map with same ID already exists']);
    assert.equal(isMapXml('<player uid="#player*0" />'), true);
    assert.equal(isMapXml('Can\'t download map. Nothing to download?'), false);
    assert.equal(sameMap('<a />\r\n<b />\r\n', '<a />\n<b />'), true);
    assert.equal(decodeEntities('&lt;&quot;&#039;&amp;lt;'), '<"\'&lt;');
  });

  it('reads every setting of the map settings form as the browser would send it', () => {
    const form = parseSettingsForm(SETTINGS_PAGE);
    assert.equal(form?.canUpload, true);
    assert.deepEqual(form?.fields, [
      ['mapname', 'one & two'],
      ['published', 'no'],
      ['descr', 'A <b> map\nsecond line'],
      ['shared_mode', '2'],
      ['for_mode', '10'],
    ]);
    assert.equal(parseSettingsForm('<html>not signed in</html>'), null);
  });
});

describe('site client', () => {
  it('lists maps through the editor server', async () => {
    const { fetcher, calls } = fakeSite({ 'POST /level_editor/e_server.php?a=': 'knownmaps = ["some user-x"];' });
    assert.deepEqual(await createSiteClient(ACCOUNT, fetcher).listMaps(), ['some user-x']);
    assert.equal(calls[0]?.init.body, 'a=mymaps');
    assert.match(String((calls[0]?.init.headers as Record<string, string>).cookie), /^login=Some%20User; password=/);
  });

  it('downloads map XML and gives null for a map it cannot read', async () => {
    const { fetcher } = fakeSite({
      'GET /level_editor/map_download.php?a=load&ext=xml&r=user-open': '<box x="0" />',
      'GET /level_editor/map_download.php?a=load&ext=xml&r=other-closed': 'Can\'t download map. Nothing to download?',
    });
    const client = createSiteClient(ACCOUNT, fetcher);
    assert.equal(await client.download('user-open'), '<box x="0" />');
    assert.equal(await client.download('other-closed'), null);
  });

  it('replaces a map with every setting sent back unchanged', async () => {
    const { fetcher, calls } = fakeSite({ 'GET /?m=user-x&a=&s=10': SETTINGS_PAGE, 'POST /?m=user-x&a=&s=10': SETTINGS_PAGE });
    await createSiteClient(ACCOUNT, fetcher).replace('user-x', '<box x="0" />');
    const body = calls[1]?.init.body as FormData;
    assert.equal(body.get('descr'), 'A <b> map\nsecond line');
    assert.equal(body.get('published'), 'no');
    assert.equal(body.get('save'), null);
    const file = body.get('uploadfile') as File;
    assert.equal(file.name, 'user-x.xml');
    assert.equal(await file.text(), '<box x="0" />');
  });

  it('refuses to replace without the form and reports the site\'s errors', async () => {
    const withoutForm = fakeSite({ 'GET /?m=other-x&a=&s=10': '<html></html>' });
    await assert.rejects(createSiteClient(ACCOUNT, withoutForm.fetcher).replace('other-x', '<a />'), SiteError);
    const refused = fakeSite({ 'POST /?s=1&a=': '<span style="color:#FF0000">Map with same ID already exists</span>' });
    await assert.rejects(createSiteClient(ACCOUNT, refused.fetcher).create('x'), /Map with same ID already exists/);
    assert.equal((refused.calls[0]?.init.body as URLSearchParams).toString(), 'id=x&newmap=Create+New+Map');
  });

  it('tells a Cloudflare check from other failures', async () => {
    const { fetcher } = fakeSite({ 'GET /?m=user-x&a=&s=10': '<title>Just a moment...</title>' }, 403);
    await assert.rejects(createSiteClient(ACCOUNT, fetcher).replace('user-x', '<a />'), /Cloudflare/);
  });
});
