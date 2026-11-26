export const TEXT = Object.freeze({
  timeout: (what: string): string => `Timed out waiting for ${what}.`,
  wroteMap: (file: string, count: number): string => `Wrote ${file} with ${count} programs.`,
  caseResult: (name: string, ok: boolean): string => `${ok ? 'PASS' : 'FAIL'} ${name}`,
  mismatch: (name: string, simulated: readonly string[] | null, game: readonly string[] | null): string =>
    `  ${name}: simulator ${simulated ? simulated.join(' ') : 'missing'}, game ${game ? game.join(' ') : 'missing'}`,
  summary: (passed: number, total: number): string => `${passed} of ${total} programs match.`,
  noNames: 'No map variable name in plazma-burst-2/data/names.js.',
  simulatedOnly: (name: string, count: number, errors: number): string => `${name}: ${count} variables, ${errors} simulator errors`,
  simulatorError: (name: string, error: string): string => `  ${name} simulator error: ${error}`,
  launcher: 'the launcher page',
  game: 'the game page',
  menu: 'the main menu',
  gaming: 'the level to start',
  building: (folder: string): string => `Building the game app with the dev console in ${folder} (once)...`,
  buildFailed: (folder: string): string => `The build in ${folder} failed.`,
  lineEnd: '\n',
});
