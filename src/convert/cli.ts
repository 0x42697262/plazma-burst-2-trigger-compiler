import { main } from './main.ts';
import { FIRST_USER_ARGUMENT } from './constants.ts';
import { LINE_END } from './keys.ts';

process.exitCode = main(process.argv.slice(FIRST_USER_ARGUMENT), {
  out: (line) => process.stdout.write(line + LINE_END),
  err: (line) => process.stderr.write(line + LINE_END),
});
