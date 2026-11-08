import {
  CHALLENGE_MARK, EDITOR_SERVER_PATH, FORM_ENCODED, HEADER, MAP_DOWNLOAD_PATH, MAP_LIST_REQUEST, MAP_SETTINGS_PATH, MESSAGE_SEPARATOR, MY_MAPS_PAGE_PATH,
  NEW_MAP_FIELD, NEW_MAP_SUBMIT, POST, SITE_ORIGIN, UPLOAD_FIELD, UPLOAD_TYPE, USER_AGENT, XML_EXTENSION,
} from './keys.ts';
import { cookieHeader, isMapXml, parseMapList, parseSettingsForm, siteErrors } from './protocol.ts';
import type { Account } from './protocol.ts';
import { HTTP_FORBIDDEN, HTTP_OK } from './constants.ts';
import { TEXT } from './text.ts';

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type SiteClient = ReturnType<typeof createSiteClient>;

export class SiteError extends Error {}

export function createSiteClient(account: Account, fetcher: Fetch = fetch) {
  async function request(path: string, init: RequestInit = {}): Promise<string> {
    const response = await fetcher(SITE_ORIGIN + path, { ...init, headers: { [HEADER.cookie]: cookieHeader(account), [HEADER.userAgent]: USER_AGENT, ...init.headers } });
    const text = await response.text();
    if (response.status === HTTP_FORBIDDEN && text.includes(CHALLENGE_MARK)) throw new SiteError(TEXT.challenge);
    if (response.status !== HTTP_OK) throw new SiteError(TEXT.httpStatus(response.status, path));
    return text;
  }

  async function listMaps(): Promise<string[] | null> {
    const response = await request(EDITOR_SERVER_PATH, { method: POST, body: MAP_LIST_REQUEST, headers: { [HEADER.contentType]: FORM_ENCODED } });
    return parseMapList(response);
  }

  async function download(mapId: string): Promise<string | null> {
    const text = await request(MAP_DOWNLOAD_PATH(mapId));
    return isMapXml(text) ? text : null;
  }

  async function replace(mapId: string, xml: string): Promise<void> {
    const path = MAP_SETTINGS_PATH(mapId);
    const form = parseSettingsForm(await request(path));
    if (form === null || !form.canUpload) throw new SiteError(TEXT.noUploadForm(mapId));
    const body = new FormData();
    for (const [name, value] of form.fields) body.append(name, value);
    body.append(UPLOAD_FIELD, new Blob([xml], { type: UPLOAD_TYPE }), mapId + XML_EXTENSION);
    const errors = siteErrors(await request(path, { method: POST, body }));
    if (errors.length > 0) throw new SiteError(TEXT.siteError(errors.join(MESSAGE_SEPARATOR)));
  }

  async function create(name: string): Promise<void> {
    const body = new URLSearchParams({ [NEW_MAP_FIELD.id]: name, [NEW_MAP_FIELD.submit]: NEW_MAP_SUBMIT });
    const errors = siteErrors(await request(MY_MAPS_PAGE_PATH, { method: POST, body }));
    if (errors.length > 0) throw new SiteError(TEXT.siteError(errors.join(MESSAGE_SEPARATOR)));
  }

  return { listMaps, download, replace, create };
}
