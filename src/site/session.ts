import fs from 'node:fs';
import path from 'node:path';
import { ENVIRONMENT, FILE_ENCODING } from './keys.ts';
import { isPasswordHash, passwordHash } from './protocol.ts';
import type { Account } from './protocol.ts';
import { JSON_INDENT, SESSION_FILE_MODE, SESSION_FOLDER_MODE, SESSION_VERSION } from './constants.ts';

type StoredSession = { schemaVersion: number; login: string; passwordHash: string };

export class SessionError extends Error {}

export function accountFromEnvironment(environment: NodeJS.ProcessEnv): Account | null {
  const login = environment[ENVIRONMENT.login];
  const password = environment[ENVIRONMENT.password];
  if (!login || !password) return null;
  return { login, passwordHash: isPasswordHash(password) ? password.toLowerCase() : passwordHash(password) };
}

const isStoredSession = (value: unknown): value is StoredSession => {
  if (typeof value !== 'object' || value === null) return false;
  const stored = value as Partial<StoredSession>;
  return stored.schemaVersion === SESSION_VERSION && typeof stored.login === 'string' && typeof stored.passwordHash === 'string' && isPasswordHash(stored.passwordHash);
};

export function readSession(file: string): Account | null {
  let text: string;
  try {
    text = fs.readFileSync(file, FILE_ENCODING);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SessionError(file);
  }
  if (!isStoredSession(parsed)) throw new SessionError(file);
  return { login: parsed.login, passwordHash: parsed.passwordHash };
}

export function writeSession(file: string, account: Account): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: SESSION_FOLDER_MODE });
  const stored: StoredSession = { schemaVersion: SESSION_VERSION, login: account.login, passwordHash: account.passwordHash };
  fs.writeFileSync(file, JSON.stringify(stored, null, JSON_INDENT), { mode: SESSION_FILE_MODE });
  fs.chmodSync(file, SESSION_FILE_MODE);
}

export function removeSession(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file);
  return true;
}
