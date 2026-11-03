export const ELEMENT = Object.freeze({
  editor: 'editor',
  tabs: 'tabs',
  newFile: 'new-file',
  examples: 'examples',
  vim: 'vim',
  prefix: 'prefix',
  guard: 'guard',
  frames: 'frames',
  numberText: 'number-text',
  directIndex: 'direct-index',
  target: 'target',
  environment: 'environment',
  compile: 'compile',
  run: 'run',
  hostMap: 'host-map',
  hostMapName: 'host-map-name',
  hostMapButton: 'host-map-button',
  replace: 'replace',
  nameSeed: 'name-seed',
  obfuscate: 'obfuscate',
  obfuscateSeed: 'obfuscate-seed',
  newSeed: 'new-seed',
  outputTabs: 'output-tabs',
  output: 'output',
  copy: 'copy',
  download: 'download',
  status: 'status',
  chips: 'chips',
  settings: 'settings',
  settingsButton: 'settings-button',
  palette: 'palette',
  paletteInput: 'palette-input',
  paletteList: 'palette-list',
  paletteButton: 'palette-button',
  hostMapClear: 'host-map-clear',
  main: 'main',
  splitter: 'splitter',
  shortcutHelp: 'shortcut-help',
  referenceButton: 'reference-button',
  reference: 'reference',
});
export const OUTPUT = Object.freeze({ problems: 'problems', xml: 'xml', text: 'text', map: 'map', run: 'run' } as const);
export const STORAGE = Object.freeze({
  files: 'ptc.files', active: 'ptc.active', vim: 'ptc.vim', options: 'ptc.options', example: 'ptc.example', build: 'ptc.build', outputHeight: 'ptc.outputHeight', reference: 'ptc.reference',
});
export const WORKSPACE_ROOT = '/work/';
export const DEFAULT_FILE = '/work/main.ptc';
export const EXAMPLES_ROOT = '/examples/';
export const SOURCE_EXTENSION = '.ptc';
export const ASSEMBLY_EXTENSION = '.pasm';
export const IMPORT_STATEMENT = /import\s+"([^"]+)"/g;
export const WORD_BEFORE = /[A-Za-z0-9_]*$/;
export const WORD_AFTER = /^[A-Za-z0-9_]*/;
export const DOT = '.';
export const CLASS = Object.freeze({
  active: 'active', error: 'error', warning: 'warning', hover: 'hover-doc', tab: 'tab', close: 'close', chip: 'chip', muted: 'muted', shortcut: 'shortcut', dragging: 'dragging',
});
export const MIME = Object.freeze({ xml: 'application/xml', text: 'text/plain' });
export const ATTRIBUTE = Object.freeze({ file: 'data-file', output: 'data-output' });
export const EVENT = Object.freeze({ click: 'click', change: 'change', input: 'input', pointerDown: 'pointerdown', pointerMove: 'pointermove', pointerUp: 'pointerup' });
export const TAG = Object.freeze({ button: 'button', option: 'option', span: 'span', div: 'div', link: 'a', optionGroup: 'optgroup', listItem: 'li', section: 'section' });
export const KEY = Object.freeze({ definition: 'F12', definitionAlternative: 'Mod-b' });
export const DOWNLOAD_NAMES = Object.freeze({ xml: '.xml', text: '.txt', map: '-map.xml' });
export const MARKDOWN = Object.freeze({
  codeBlock: /```[a-z]*\n([\s\S]*?)```/g,
  code: /`([^`]+)`/g,
  bold: /\*\*([^*]+)\*\*/g,
  newline: /\n/g,
});
export const HTML_ESCAPES: readonly (readonly [string, string])[] = Object.freeze([['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;']]);
export const TRUE_TEXT = 'true';
export const ENVIRONMENT_ASSIGN = '=';
export const ENVIRONMENT_COMMENT = '#';
export const LINE_BREAK = /\r?\n/;
export const LEADING_SLASH = /^\//;
export const COPY_SEPARATOR = '-';
export const HIGHLIGHT = Object.freeze({
  lineComment: '//',
  blockStart: '/*',
  blockEnd: '*/',
  assemblyComment: /^(;|\/\/)/,
  quote: '"',
  escape: '\\',
  identifier: /^[A-Za-z_][A-Za-z0-9_]*/,
  namedValue: /^[A-Z][A-Za-z]*\.[A-Za-z_][A-Za-z0-9_]*/,
  number: /^-?[0-9]+(\.[0-9]+)?/,
  reference: /^[@$%][A-Za-z_][A-Za-z0-9_]*/,
  operator: /^(\.\.=?|=>|\?=|[-+*/%=!<>]=?|&&|\|\|)/,
  blockAhead: /^\s*\{/,
  label: /^[A-Za-z_][A-Za-z0-9_]*:/,
  directive: /^\.[a-z]+/,
  callAhead: /^\s*\(/,
});
export const TOKEN = Object.freeze({
  comment: 'comment', string: 'string', number: 'number', keyword: 'keyword', atom: 'atom', builtin: 'builtin', type: 'typeName',
  operator: 'operator', variable: 'variableName', special: 'special', meta: 'meta', label: 'labelName',
});
export const ASSEMBLY_INSTRUCTIONS: ReadonlySet<string> = new Set(['jmp', 'call', 'ret', 'set', 'add', 'say', 'jeq', 'jne', 'jlt', 'jle', 'jgt', 'jge']);
export const BOOLEANS: ReadonlySet<string> = new Set(['true', 'false']);
export const PREFIX_CLEANUP = /[^A-Za-z0-9]/g;
export const LEADING_DIGITS = /^[0-9]+/;
export const DEFAULT_PREFIX = 'ptc';
export const STARTER_EXAMPLE = '/examples/tutorial/01-hello.ptc';
export const EXTENSION = /\.[^./]+$/;
export const EMPTY_OBJECT = '{}';
export const OUTPUT_BUTTONS = '[data-output]';
export const TAB_ACTIVE = 'tab active';
export const LIBRARY_FOLDER = 'lib';
export const FOLDER_POSITION = -2;
export const KEYDOWN = 'keydown';
export const ESCAPE = 'Escape';
export const KEY_NAME = Object.freeze({ enter: 'Enter', up: 'ArrowUp', down: 'ArrowDown' });
export const SHORTCUT_KEY = Object.freeze({ palette: 'k', settings: ',', reference: '\\' });
export const SHORTCUT: Readonly<Record<'build' | 'run' | 'palette' | 'settings' | 'reference', readonly string[]>> = Object.freeze({
  build: ['mod', 'enter'], run: ['mod', 'shift', 'enter'], palette: ['mod', 'K'], settings: ['mod', ','], reference: ['mod', '\\'],
});
export const MAC_PLATFORM = /Mac|iPhone|iPad/;
export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const CSS_VARIABLE = Object.freeze({ outputHeight: '--output-height' });
export const PIXELS = 'px';
export const SELECTOR = Object.freeze({ active: '.active' });
export const SCROLL_NEAREST = 'nearest';
export const GUIDE_URL = 'https://github.com/0x42697262/plazma-burst-2-trigger-compiler/blob/master/docs/syntax.md';
export const PLAIN_EDITOR_THEME = Object.freeze({
  '&': { backgroundColor: 'transparent' }, '.cm-gutters': { backgroundColor: 'transparent', border: 'none' }, '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--selected)' },
});
