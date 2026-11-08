import crypto from 'node:crypto';
import {
  CHECKED_ATTRIBUTE, CHECKED_DEFAULT_VALUE, CHOICE_INPUT_TYPES, COOKIE, COOKIE_PAIR, COOKIE_SEPARATOR, DEFAULT_INPUT_TYPE, ENTITIES, FORM_END, HEX, INPUT_TAG,
  LINE_BREAKS, LINE_END, MAP_ID_SEPARATOR, MAP_LIST, MAP_START, MD5, MD5_TEXT, NAME_ATTRIBUTE, OPTION_TAG, PLACEHOLDER_UID, SELECTED_ATTRIBUTE,
  SELECT_TAG, SETTINGS_FORM_START, SITE_ERROR, SKIPPED_INPUT_TYPES, TEXTAREA_TAG, TYPE_ATTRIBUTE, UPLOAD_FIELD, VALUE_ATTRIBUTE,
} from './keys.ts';

export type Account = Readonly<{ login: string; passwordHash: string }>;
export type SettingsForm = Readonly<{ fields: readonly (readonly [string, string])[]; canUpload: boolean }>;

export const passwordHash = (password: string): string => crypto.createHash(MD5).update(password).digest(HEX);

export const isPasswordHash = (text: string): boolean => MD5_TEXT.test(text);

export const cookieHeader = (account: Account): string => [
  COOKIE_PAIR(COOKIE.login, encodeURIComponent(account.login)),
  COOKIE_PAIR(COOKIE.password, account.passwordHash),
  COOKIE_PAIR(COOKIE.uid, PLACEHOLDER_UID),
].join(COOKIE_SEPARATOR);

export const ownMapPrefix = (login: string): string => login.toLowerCase() + MAP_ID_SEPARATOR;

export const decodeEntities = (text: string): string => ENTITIES.reduce((decoded, [pattern, replacement]) => decoded.replace(pattern, replacement), text);

export function parseMapList(response: string): string[] | null {
  const list = MAP_LIST.exec(response)?.[1];
  if (list === undefined) return null;
  const parsed: unknown = JSON.parse(list);
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : null;
}

export const siteErrors = (html: string): string[] => [...html.matchAll(SITE_ERROR)].map((match) => decodeEntities(match[1] ?? '').trim()).filter((message) => message !== '');

export const isMapXml = (text: string): boolean => text.trimStart().startsWith(MAP_START);

export const sameMap = (left: string, right: string): boolean => left.replace(LINE_BREAKS, LINE_END).trim() === right.replace(LINE_BREAKS, LINE_END).trim();

const attribute = (attributes: string, pattern: RegExp): string | undefined => pattern.exec(attributes)?.[1];

export function parseSettingsForm(html: string): SettingsForm | null {
  const start = html.indexOf(SETTINGS_FORM_START);
  if (start < 0) return null;
  const end = html.indexOf(FORM_END, start);
  const form = html.slice(start, end < 0 ? html.length : end);
  const fields: [string, string][] = [];
  let canUpload = false;
  for (const [, attributes = ''] of form.matchAll(INPUT_TAG)) {
    const name = attribute(attributes, NAME_ATTRIBUTE);
    if (name === undefined) continue;
    const type = (attribute(attributes, TYPE_ATTRIBUTE) ?? DEFAULT_INPUT_TYPE).toLowerCase();
    if (name === UPLOAD_FIELD) canUpload = true;
    if (SKIPPED_INPUT_TYPES.has(type)) continue;
    if (CHOICE_INPUT_TYPES.has(type) && !CHECKED_ATTRIBUTE.test(attributes)) continue;
    const value = attribute(attributes, VALUE_ATTRIBUTE) ?? (CHOICE_INPUT_TYPES.has(type) ? CHECKED_DEFAULT_VALUE : '');
    fields.push([name, decodeEntities(value)]);
  }
  for (const [, attributes = '', content = ''] of form.matchAll(TEXTAREA_TAG)) {
    const name = attribute(attributes, NAME_ATTRIBUTE);
    if (name !== undefined) fields.push([name, decodeEntities(content)]);
  }
  for (const [, attributes = '', options = ''] of form.matchAll(SELECT_TAG)) {
    const name = attribute(attributes, NAME_ATTRIBUTE);
    if (name === undefined) continue;
    const all = [...options.matchAll(OPTION_TAG)].map((match) => match[1] ?? '');
    const chosen = all.find((option) => SELECTED_ATTRIBUTE.test(option)) ?? all[0];
    const value = chosen === undefined ? undefined : attribute(chosen, VALUE_ATTRIBUTE);
    if (value !== undefined) fields.push([name, decodeEntities(value)]);
  }
  return { fields, canUpload };
}
