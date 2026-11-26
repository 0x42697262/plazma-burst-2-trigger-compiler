import { main } from './main.ts';
import { sessionFile } from './paths.ts';
import { hasTerminal, terminalPrompter } from './prompt.ts';
import { FIRST_USER_ARGUMENT } from './constants.ts';
import { LINE_END } from './keys.ts';

process.exitCode = await main(process.argv.slice(FIRST_USER_ARGUMENT), {
  output: {
    out: (line) => process.stdout.write(line + LINE_END),
    err: (line) => process.stderr.write(line + LINE_END),
  },
  environment: process.env,
  sessionFile: sessionFile(process.env),
  prompter: hasTerminal() ? terminalPrompter : null,
});
