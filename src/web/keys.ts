export const ELEMENT = Object.freeze({
  dock: 'dock',
  outputPanel: 'output-panel',
  examplesButton: 'examples-button',
  filesButton: 'files-button',
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
  hostMapClear: 'host-map-clear',
  hostMapChip: 'host-map-chip',
  convertMap: 'convert-map',
  mapMenu: 'map-menu',
  mapImport: 'map-import',
  mapConvert: 'map-convert',
  mapForget: 'map-forget',
  replace: 'replace',
  nameSeed: 'name-seed',
  obfuscate: 'obfuscate',
  obfuscateSeed: 'obfuscate-seed',
  tamperCheck: 'tamper-check',
  tamperSeed: 'tamper-seed',
  tamperAnnounce: 'tamper-announce',
  newSeed: 'new-seed',
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
  shortcutHelp: 'shortcut-help',
  referenceButton: 'reference-button',
  reference: 'reference',
  blueprint: 'blueprint',
  blueprintButton: 'blueprint-button',
  settingsSummary: 'settings-summary',
});
export const OUTPUT = Object.freeze({ problems: 'problems', xml: 'xml', text: 'text', map: 'map', run: 'run' } as const);
export const STORAGE = Object.freeze({
  files: 'ptc.files', active: 'ptc.active', vim: 'ptc.vim', options: 'ptc.options', example: 'ptc.example', build: 'ptc.build', layout: 'ptc.layout', reference: 'ptc.reference', windows: 'ptc.windows',
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
  active: 'active', error: 'error', warning: 'warning', hover: 'hover-doc', chip: 'chip', muted: 'muted', shortcut: 'shortcut', flash: 'flash', panelFill: 'panel-fill',
  groupActions: 'group-actions', watermark: 'watermark', quiet: 'quiet', mini: 'mini',
});
export const MIME = Object.freeze({ xml: 'application/xml', text: 'text/plain' });
export const ATTRIBUTE = Object.freeze({ file: 'data-file', output: 'data-output', expanded: 'aria-expanded' });
export const MAP_FILE_EXTENSION = /\.(xml|txt)$/i;
export const CONVERTED_FALLBACK = 'map';
export const EVENT = Object.freeze({
  click: 'click', change: 'change', input: 'input', keydown: 'keydown', pointerDown: 'pointerdown', pointerMove: 'pointermove', pointerUp: 'pointerup', pointerLeave: 'pointerleave',
  wheel: 'wheel', doubleClick: 'dblclick',
});
export const TAG = Object.freeze({
  canvas: 'canvas',
  button: 'button', option: 'option', span: 'span', div: 'div', link: 'a', optionGroup: 'optgroup', listItem: 'li', section: 'section', nav: 'nav', input: 'input', ul: 'ul', li: 'li',
  h2: 'h2', h3: 'h3', p: 'p', code: 'code',
});
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
export const LIBRARY_FOLDER = 'lib';
export const FOLDER_POSITION = -2;
export const KEYDOWN = 'keydown';
export const ESCAPE = 'Escape';
export const KEY_NAME = Object.freeze({ enter: 'Enter', up: 'ArrowUp', down: 'ArrowDown' });
export const SHORTCUT_KEY = Object.freeze({ palette: 'k', files: 'p', settings: ',', reference: '\\' });
export const SHORTCUT: Readonly<Record<'build' | 'run' | 'palette' | 'files' | 'settings' | 'reference', readonly string[]>> = Object.freeze({
  build: ['mod', 'enter'], run: ['mod', 'shift', 'enter'], palette: ['mod', 'K'], files: ['mod', 'P'], settings: ['mod', ','], reference: ['mod', '\\'],
});
export const MAC_PLATFORM = /Mac|iPhone|iPad/;
export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const ROOT_ID = 'root';
export const PROGRAM_PREFIX = 'program:';
export const EVENT_SYMBOL = 'event';
export const PANEL = Object.freeze({
  top: 'ref-top', crumbs: 'ref-crumbs', crumb: 'ref-crumb', search: 'ref-search', body: 'ref-body', follow: 'ref-follow', back: 'ref-back', close: 'ref-close',
  signature: 'ref-signature', summary: 'ref-summary', insert: 'ref-insert', list: 'ref-list', linked: 'linked', dot: 'ref-dot', text: 'ref-text', line: 'ref-line',
  name: 'ref-name', detail: 'ref-detail', fieldSummary: 'ref-field-summary', add: 'ref-add', colored: 'colored', colorVariable: '--entry-color',
});
export const SELECTOR = Object.freeze({ active: '.active', firstMenuItem: 'button:not([hidden])' });
export const ROW_SELECTOR = '.row, .stack';
export const WORD_GAP = /\s+/;
export const BLUEPRINT_VIEW = Object.freeze({
  bar: 'bp-bar', coordinates: 'bp-coordinates', moved: 'bp-moved', spacer: 'spacer', canvas: 'bp-canvas', card: 'bp-card', tip: 'bp-tip', stage: 'bp-stage', miniClass: 'mini',
  cardTitle: 'bp-card-title', cardValues: 'bp-card-values', cardButtons: 'bp-card-buttons',
  handles: ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const, west: 'w', east: 'e', north: 'n', south: 's',
  fitKey: 'f', escapeKey: 'Escape', context: '2d', baseline: 'top',
  nudge: Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as const),
  colors: Object.freeze({ background: '--bg', line: '--line', accent: '--accent', text: '--text' }),
});
export const BLUEPRINT = Object.freeze({
  leftSide: -1, vehicleTag: 'vehicle', fallbackColor: '#9aa0a6',
  attribute: Object.freeze({ x: 'x', y: 'y', w: 'w', h: 'h', side: 'side', model: 'model', uid: 'uid' }),
});
export const DOCK = Object.freeze({
  panel: Object.freeze({ output: 'output', reference: 'reference', settings: 'settings', blueprint: 'blueprint' } as const),
  filePrefix: 'file:', fileComponent: 'file', dragHandle: 'tabbar',
  direction: Object.freeze({ above: 'above', below: 'below', right: 'right', bottom: 'bottom' } as const),
  tools: Object.freeze(['blueprint', 'settings', 'reference'] as const),
  corners: Object.freeze(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const),
  defaultCorner: 'bottom-right' as const,
  gridLocation: 'grid', floatingLocation: 'floating', popoutLocation: 'popout',
  componentField: 'component', floatingFinder: 'getFloatingWindowForGroup', gridviewField: 'gridview', layoutMethod: 'layout', heightField: 'height',
});
export const SCROLL_NEAREST = 'nearest';
export const GUIDE_URL = 'https://github.com/0x42697262/plazma-burst-2-trigger-compiler/blob/master/docs/syntax.md';
export const PLAIN_EDITOR_THEME = Object.freeze({
  '&': { backgroundColor: 'transparent' }, '.cm-gutters': { backgroundColor: 'transparent', border: 'none' }, '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--selected)' },
});
