import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GAME_REPOSITORY, SANDBOX, SANDBOX_BUILT_MARK, SANDBOX_COPIES, SANDBOX_DATA_COPIES, SANDBOX_LINKS, SANDBOX_MAPS } from './paths.ts';
import { BUILD_COMMAND, NPM } from './keys.ts';
import { TEXT } from './text.ts';

export function prepareSandbox(rebuild: boolean, print: (line: string) => void): void {
  if (!rebuild && fs.existsSync(SANDBOX_BUILT_MARK)) return;
  print(TEXT.building(SANDBOX));
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  fs.mkdirSync(SANDBOX_MAPS, { recursive: true });
  for (const entry of SANDBOX_COPIES) fs.cpSync(path.join(GAME_REPOSITORY, entry), path.join(SANDBOX, entry), { recursive: true });
  for (const entry of SANDBOX_LINKS) fs.symlinkSync(path.join(GAME_REPOSITORY, entry), path.join(SANDBOX, entry));
  for (const entry of SANDBOX_DATA_COPIES) fs.copyFileSync(path.join(GAME_REPOSITORY, entry), path.join(SANDBOX, entry));
  const build = spawnSync(NPM, BUILD_COMMAND, { cwd: SANDBOX, stdio: 'ignore' });
  if (build.status !== 0 || !fs.existsSync(SANDBOX_BUILT_MARK)) throw new Error(TEXT.buildFailed(SANDBOX));
}
