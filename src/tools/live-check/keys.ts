export const NAMES_GLOBAL = 'PB2_NAMES';
export const MAP_VARIABLES_KEY = 'mapVars';
export const FILE_ENCODING = 'utf8';
export const NPX = 'npx';
export const ELECTRON_ARGUMENTS = (port: number): string[] => ['electron', '.', `--remote-debugging-port=${port}`];
export const TARGETS_URL = (port: number): string => `http://127.0.0.1:${port}/json`;
export const PAGE_TYPE = 'page';
export const SIGNAL = 'SIGTERM';
export const EXPRESSION = Object.freeze({
  hasServers: 'typeof pb2servers === "object"',
  playOfficial: 'pb2servers.list().then((list) => pb2servers.play(list.official.id))',
  hasGame: 'typeof stage === "object" && stage !== null && typeof stage.currentFrameLabel === "string"',
  frameLabel: 'String(stage.currentFrameLabel)',
  openMap: (map: string): string => `window.postMessage(${JSON.stringify(`rt:local-${map}:sp`)}, "*")`,
  readVariables: (name: string): string => `JSON.stringify(Object.fromEntries(Object.entries(globalThis[${JSON.stringify(name)}] || {}).map(([key, value]) => [key, [Array.isArray(value) ? "array" : typeof value, Array.isArray(value) ? JSON.stringify(value.map(String)) : String(value)]])))`,
});
export const FRAME = Object.freeze({ menu: 'menu', gaming: 'gaming', namePrompt: 'name_prompt' });
export const GUEST_NAME = 'ptc';
export const ENTER_KEY = Object.freeze({ key: 'Enter', code: 'Enter' });
export const METHOD = Object.freeze({
  evaluate: 'Runtime.evaluate',
  key: 'Input.dispatchKeyEvent',
  insertText: 'Input.insertText',
});
export const KEY_EVENTS: readonly string[] = Object.freeze(['keyDown', 'keyUp']);
export const SPACE_KEY = Object.freeze({ key: ' ', code: 'Space' });
export const CASE_EXTENSIONS: readonly string[] = Object.freeze(['.pasm', '.ptc']);
export const ARRAY_TYPE = 'array';
export const SIMULATE_FLAG = '--simulate-only';
export const NPM = 'npm';
export const BUILD_COMMAND: string[] = ['run', 'build'];
export const REBUILD_FLAG = '--rebuild';
export const DIRECT_INDEX_FLAG = '--direct-index';
export const PCODE_FLAG = '--pcode';
export const OBFUSCATE_FLAG = '--obfuscate';
export const OBFUSCATE_SEED = 'live-check';
export const ONLY_FLAG = '--only';
export const PCODE_TARGET = 'pcode';
