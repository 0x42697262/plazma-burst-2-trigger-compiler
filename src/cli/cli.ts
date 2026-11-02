import { main } from './main.ts';
import { FIRST_USER_ARGUMENT } from './constants.ts';
import { TEXT } from './text.ts';

process.exitCode = main(process.argv.slice(FIRST_USER_ARGUMENT), {
  out: (line) => process.stdout.write(line + TEXT.lineEnd),
  err: (line) => process.stderr.write(line + TEXT.lineEnd),
});
