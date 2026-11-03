import examples from 'virtual:examples';
import type { SerializedDockview } from 'dockview-core';
import { CodeEditor } from './editor.ts';
import { Workspace } from './workspace.ts';
import { build, checkOptions, parseEnvironment, preview, simulate } from './pipeline.ts';
import { BlueprintView } from './blueprint.ts';
import { sceneOf } from './blueprint-model.ts';
import { directoryOf, resolvePath } from '../lang/file-paths.ts';
import type { Build, BuildRecord, Options } from './pipeline.ts';
import { filterCommands, optionChips, shortcutLabel } from './commands.ts';
import type { Command } from './commands.ts';
import { ReferencePanel } from './reference-panel.ts';
import { Dock } from './dock.ts';
import {
  ATTRIBUTE, CLASS, DARK_QUERY, DOCK, EMPTY_OBJECT, ESCAPE, FOLDER_POSITION, GUIDE_URL, KEY_NAME, KEYDOWN, LIBRARY_FOLDER, MAC_PLATFORM, OUTPUT_BUTTONS, ROW_SELECTOR, SCROLL_NEAREST,
  SELECTOR, SHORTCUT, SHORTCUT_KEY, DEFAULT_FILE, DOWNLOAD_NAMES, ELEMENT, EVENT, EXTENSION, MIME, OUTPUT, STARTER_EXAMPLE, STORAGE, TAG, TRUE_TEXT, WORKSPACE_ROOT,
} from './keys.ts';
import { BLUEPRINT_REFRESH_DELAY, DEFAULT_FRAMES, DEFAULT_GUARD, FLASH_TIME, LAYOUT_SAVE_DELAY, STATUS_TIME } from './constants.ts';
import { TEXT } from './text.ts';
import { PATH_SEPARATOR } from '../lang/keys.ts';
import { DEFAULT_TARGET, isTarget, TARGETS } from '../pcode/keys.ts';
import { isStandardLibrary } from '../lang/file-paths.ts';
import { randomSeed } from '../obfuscate/random.ts';

type OutputName = (typeof OUTPUT)[keyof typeof OUTPUT];

const element = <Type extends HTMLElement>(id: string): Type => document.getElementById(id) as Type;
const storage = ((): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const readJson = <Type>(key: string): Partial<Type> => {
  try {
    return JSON.parse(storage?.getItem(key) ?? EMPTY_OBJECT) as Partial<Type>;
  } catch {
    return {};
  }
};
const mac = MAC_PLATFORM.test(navigator.platform);
const shortcut = (keys: readonly string[]): string => shortcutLabel(keys, mac);

const workspace = new Workspace(storage, Object.fromEntries(Object.entries(examples).filter(([file]) => isStandardLibrary(file))));
if (workspace.isEmpty) {
  workspace.loadExample(examples, STARTER_EXAMPLE);
  storage?.setItem(STORAGE.example, STARTER_EXAMPLE);
}

const prefixInput = element<HTMLInputElement>(ELEMENT.prefix);
const guardInput = element<HTMLInputElement>(ELEMENT.guard);
const framesInput = element<HTMLInputElement>(ELEMENT.frames);
const vimInput = element<HTMLInputElement>(ELEMENT.vim);
const numberTextInput = element<HTMLInputElement>(ELEMENT.numberText);
const directIndexInput = element<HTMLInputElement>(ELEMENT.directIndex);
const targetSelect = element<HTMLSelectElement>(ELEMENT.target);
const replaceInput = element<HTMLInputElement>(ELEMENT.replace);
const nameSeedInput = element<HTMLInputElement>(ELEMENT.nameSeed);
const obfuscateInput = element<HTMLInputElement>(ELEMENT.obfuscate);
const obfuscateSeedInput = element<HTMLInputElement>(ELEMENT.obfuscateSeed);
const environmentInput = element<HTMLTextAreaElement>(ELEMENT.environment);
const environment = () => parseEnvironment(environmentInput.value);
const output = element<HTMLPreElement>(ELEMENT.output);
const status = element<HTMLSpanElement>(ELEMENT.status);
const chips = element<HTMLSpanElement>(ELEMENT.chips);
const settings = element<HTMLDivElement>(ELEMENT.settings);
const palette = element<HTMLDivElement>(ELEMENT.palette);
const paletteInput = element<HTMLInputElement>(ELEMENT.paletteInput);
const paletteList = element<HTMLUListElement>(ELEMENT.paletteList);
const hostMapName = element<HTMLSpanElement>(ELEMENT.hostMapName);
const hostMapClear = element<HTMLButtonElement>(ELEMENT.hostMapClear);

const savedOptions = readJson<Options>(STORAGE.options);
prefixInput.value = savedOptions.prefix ?? '';
guardInput.value = String(savedOptions.guard ?? DEFAULT_GUARD);
framesInput.value = String(savedOptions.frames ?? DEFAULT_FRAMES);
numberTextInput.checked = savedOptions.numberText ?? true;
directIndexInput.checked = savedOptions.directIndex ?? false;
targetSelect.value = savedOptions.target ?? DEFAULT_TARGET;
replaceInput.checked = savedOptions.replace ?? false;
nameSeedInput.value = savedOptions.nameSeed ?? '';
obfuscateInput.checked = savedOptions.obfuscate ?? false;
obfuscateSeedInput.value = savedOptions.obfuscateSeed ?? '';
vimInput.checked = storage?.getItem(STORAGE.vim) === TRUE_TEXT;
element(ELEMENT.shortcutHelp).textContent = TEXT.shortcutHelp(shortcut(SHORTCUT.build), shortcut(SHORTCUT.run), shortcut(SHORTCUT.palette), shortcut(SHORTCUT.files), shortcut(SHORTCUT.settings), shortcut(SHORTCUT.reference));
element(ELEMENT.compile).title = TEXT.withShortcut(element(ELEMENT.compile).title, shortcut(SHORTCUT.build));
element(ELEMENT.run).title = TEXT.withShortcut(element(ELEMENT.run).title, shortcut(SHORTCUT.run));
element(ELEMENT.referenceButton).title = TEXT.withShortcut(element(ELEMENT.referenceButton).title, shortcut(SHORTCUT.reference));
element(ELEMENT.filesButton).title = TEXT.withShortcut(element(ELEMENT.filesButton).title, shortcut(SHORTCUT.files));
element(ELEMENT.paletteButton).textContent = shortcut(SHORTCUT.palette);

let hostMap: string | null = null;
let last: Build | null = null;
let runLines: string[] = [];
let shown: OutputName = OUTPUT.problems;
let statusTimer = 0;
let layoutTimer = 0;
let activeFile = workspace.active;
const editors = new Map<string, CodeEditor>();
const currentEditor = (): CodeEditor | null => editors.get(activeFile) ?? null;
const darkQuery = window.matchMedia(DARK_QUERY);

const options = (): Options => {
  const value = { prefix: prefixInput.value.trim(), guard: Number(guardInput.value) || 0, frames: Math.max(1, Number(framesInput.value) || DEFAULT_FRAMES), numberText: numberTextInput.checked, directIndex: directIndexInput.checked, target: isTarget(targetSelect.value) ? targetSelect.value : DEFAULT_TARGET, replace: replaceInput.checked, nameSeed: nameSeedInput.value,
    obfuscate: obfuscateInput.checked, obfuscateSeed: obfuscateSeedInput.value,
  };
  storage?.setItem(STORAGE.options, JSON.stringify(value));
  renderChips(value);
  return value;
};

const summary = (current: Build): string => {
  if (!current.result) return '';
  const program = current.result.program;
  return TEXT.compiled(program.triggers.length, program.triggers.reduce((total, trigger) => total + trigger.actions.length, 0), program.timers.length);
};

const idleStatus = (): string => (last?.result ? summary(last) : TEXT.ready);

const say = (text: string): void => {
  status.textContent = text;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    status.textContent = idleStatus();
  }, STATUS_TIME);
};

const baseName = (file = activeFile): string => (file.split(PATH_SEPARATOR).pop() ?? DEFAULT_FILE).replace(EXTENSION, '');
const shortName = (file: string): string => (file.startsWith(WORKSPACE_ROOT) ? file.slice(WORKSPACE_ROOT.length) : file);

const outputText = (name: OutputName): string => {
  if (!last) return TEXT.compileFirst;
  switch (name) {
    case OUTPUT.problems:
      return '';
    case OUTPUT.xml:
      return last.xml;
    case OUTPUT.text:
      return last.text;
    case OUTPUT.map:
      return hostMap === null ? TEXT.noMap : last.map;
    case OUTPUT.run:
      return runLines.join(TEXT.separator);
  }
};

const show = (name: OutputName): void => {
  shown = name;
  if (!dock.isOpen(DOCK.panel.output)) dock.show(DOCK.panel.output, true);
  for (const button of document.querySelectorAll<HTMLButtonElement>(OUTPUT_BUTTONS)) {
    button.classList.toggle(CLASS.active, button.getAttribute(ATTRIBUTE.output) === name);
  }
  output.replaceChildren();
  if (name !== OUTPUT.problems) {
    output.textContent = outputText(name);
    return;
  }
  const problems = last?.problems ?? [];
  const lines = [...problems.map((entry) => ({ text: TEXT.problem(entry.severity === 'error' ? TEXT.error : TEXT.warning, entry.file, entry.line + 1, entry.message), kind: entry.severity })),
    ...(last?.notes ?? []).map((note) => ({ text: note, kind: 'warning' as const }))];
  if (lines.length === 0) {
    output.textContent = last ? TEXT.noProblems : TEXT.compileFirst;
    return;
  }
  for (const line of lines) {
    const row = document.createElement(TAG.div);
    row.className = line.kind === 'error' ? CLASS.error : CLASS.warning;
    row.textContent = line.text;
    output.append(row);
  }
};

const buildStore = (): Record<string, unknown> => readJson<Record<string, unknown>>(STORAGE.build);

const recordOf = (stored: unknown): BuildRecord => {
  if (Array.isArray(stored)) return { uids: stored.filter((uid): uid is string => typeof uid === 'string'), walls: [] };
  const record = stored as Partial<BuildRecord> | undefined;
  return { uids: record?.uids ?? [], walls: record?.walls ?? [] };
};

const compile = (): Build => {
  const file = activeFile;
  last = build(workspace, file, options(), hostMap, environment(), recordOf(buildStore()[file]));
  if (hostMap !== null && last.map !== '') {
    storage?.setItem(STORAGE.build, JSON.stringify({ ...buildStore(), [file]: { uids: last.uids, walls: last.walls } }));
  }
  status.textContent = idleStatus();
  scheduleBlueprint();
  return last;
};

const buildAndShow = (): void => {
  compile();
  show(last?.result && shown !== OUTPUT.problems ? shown : last?.result ? OUTPUT.xml : OUTPUT.problems);
};

const run = (): void => {
  const current = compile();
  runLines = current.result ? simulate(current.result, options().frames) : [];
  show(current.result ? OUTPUT.run : OUTPUT.problems);
};

const editorHooks = {
  onChange: (file: string, text: string): void => {
    workspace.set(file, text);
    panel.refresh();
    scheduleBlueprint();
  },
  onJump: (location: { file: string; line: number; column: number }): void => jumpTo(location),
  checkOptions: () => checkOptions(numberTextInput.checked, directIndexInput.checked, options().target, environment()),
  onCursor: (file: string): void => {
    if (file === activeFile) panel.cursorMoved();
    const line = editors.get(file)?.cursorLine();
    if (line !== undefined) blueprint.highlightLine(file, line, activeFile);
  },
  onFocus: (file: string): void => setActiveFile(file),
};

const setActiveFile = (file: string): void => {
  if (file === activeFile) return;
  activeFile = file;
  workspace.activate(file);
  panel.refresh();
  scheduleBlueprint();
};

const sourceFile = (label: string | null): string => (label === null ? activeFile : isStandardLibrary(label) ? label : resolvePath(directoryOf(activeFile), label));

let blueprintTimer = 0;
const refreshBlueprint = (): void => {
  if (!dock.isOpen(DOCK.panel.blueprint)) return;
  const found = preview(workspace, activeFile, options(), environment());
  if (found === null) return;
  const scene = sceneOf(found.objects, found.staging, hostMap);
  blueprint.setScene({ ...scene, items: scene.items.map((item) => ({ ...item, file: item.line === null ? null : sourceFile(item.file) })) });
  const line = currentEditor()?.cursorLine();
  if (line !== undefined) blueprint.highlightLine(activeFile, line, activeFile);
};
const scheduleBlueprint = (): void => {
  window.clearTimeout(blueprintTimer);
  blueprintTimer = window.setTimeout(refreshBlueprint, BLUEPRINT_REFRESH_DELAY);
};

const saveLayout = (layout: SerializedDockview): void => {
  window.clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(() => storage?.setItem(STORAGE.layout, JSON.stringify(layout)), LAYOUT_SAVE_DELAY);
};

const dock = new Dock(element(ELEMENT.dock), {
  createFile: (file, parent) => {
    const editor = new CodeEditor(parent, file, workspace, editorHooks, vimInput.checked, darkQuery.matches);
    editors.set(file, editor);
    return {
      dispose: () => {
        editor.destroy();
        if (editors.get(file) === editor) editors.delete(file);
      },
    };
  },
  fixed: { output: element(ELEMENT.outputPanel), reference: element(ELEMENT.reference), settings, blueprint: element(ELEMENT.blueprint) },
  mounted: (mountedPanel) => {
    if (mountedPanel !== DOCK.panel.blueprint) return;
    blueprint.attach();
    scheduleBlueprint();
  },
  activeFile: (file) => setActiveFile(file),
  changed: saveLayout,
  newFile: () => newFile(),
  titleOf: shortName,
}, darkQuery.matches);

const blueprint = new BlueprintView(element(ELEMENT.blueprint), {
  jump: (file, line) => jumpTo({ file: file ?? activeFile, line: line - 1, column: 0 }, false),
  insert: (text) => currentEditor()?.insert(text),
  copy: (text) => {
    void navigator.clipboard.writeText(text).then(() => say(TEXT.copied));
  },
  expand: () => dock.show(DOCK.panel.blueprint, true),
});

const savedPanel = readJson<{ open: boolean; follow: boolean }>(STORAGE.reference);
const panel = new ReferencePanel(element(ELEMENT.reference), {
  insert: (text) => currentEditor()?.insert(text),
  jump: (location) => jumpTo(location),
  source: () => ({ file: activeFile, text: workspace.get(activeFile) ?? '', read: (file) => workspace.get(file) }),
  cursorWord: () => currentEditor()?.wordAtCursor() ?? { word: '', group: null },
  followChanged: (follow) => storage?.setItem(STORAGE.reference, JSON.stringify({ follow })),
  isOpen: () => dock.isOpen(DOCK.panel.reference),
  setOpen: (open) => dock.show(DOCK.panel.reference, open),
}, savedPanel.follow ?? true);

const openFile = (file: string): void => {
  dock.openFile(file);
  setActiveFile(file);
  editors.get(file)?.view.focus();
};

const jumpTo = (location: { file: string; line: number; column: number }, focus = true): void => {
  if (workspace.get(location.file) === null) return;
  if (location.file !== activeFile && !isStandardLibrary(location.file)) {
    dock.openFile(location.file);
    setActiveFile(location.file);
  }
  editors.get(location.file)?.select(location.line, location.column, focus);
};

const newFile = (): void => {
  const name = window.prompt(TEXT.newFilePrompt);
  if (!name) return;
  const file = workspace.workspacePath(name);
  if (workspace.get(file) === null) workspace.set(file, '');
  openFile(file);
};

const deleteFile = (file: string): void => {
  if (!window.confirm(TEXT.removeFile(shortName(file)))) return;
  dock.closeFile(file);
  workspace.remove(file);
};

const savedLayout = ((): SerializedDockview | null => {
  try {
    return JSON.parse(storage?.getItem(STORAGE.layout) ?? TEXT.nullJson) as SerializedDockview | null;
  } catch {
    return null;
  }
})();
dock.restore(savedLayout, workspace.list(), workspace.active, savedPanel.open ?? false);
darkQuery.addEventListener(EVENT.change, () => {
  dock.setDark(darkQuery.matches);
  for (const editor of editors.values()) editor.setDark(darkQuery.matches);
});

const exampleFiles = Object.keys(examples).filter((name) => !isStandardLibrary(name) && !name.split(PATH_SEPARATOR).includes(LIBRARY_FOLDER)).sort();
const exampleName = (file: string): string => {
  const parts = file.split(PATH_SEPARATOR);
  return TEXT.exampleName(parts.at(FOLDER_POSITION) ?? '', parts[parts.length - 1] ?? file);
};
const openExample = (file: string): void => {
  workspace.loadExample(examples, file);
  storage?.setItem(STORAGE.example, file);
  for (const [name, editor] of editors) editor.replaceText(workspace.get(name) ?? '');
  openFile(workspace.active);
  last = null;
  status.textContent = idleStatus();
  show(OUTPUT.problems);
};

const optionChanged = (): void => {
  options();
  for (const editor of editors.values()) editor.relint();
  scheduleBlueprint();
};
environmentInput.addEventListener(EVENT.input, optionChanged);
for (const input of [numberTextInput, directIndexInput, targetSelect, replaceInput, obfuscateInput]) input.addEventListener(EVENT.change, optionChanged);
for (const input of [nameSeedInput, obfuscateSeedInput, prefixInput, guardInput, framesInput]) input.addEventListener(EVENT.input, optionChanged);
const newSeed = (): void => {
  obfuscateSeedInput.value = randomSeed();
  obfuscateInput.checked = true;
  optionChanged();
};
element(ELEMENT.newSeed).addEventListener(EVENT.click, newSeed);
const setVim = (on: boolean): void => {
  vimInput.checked = on;
  storage?.setItem(STORAGE.vim, String(on));
  for (const editor of editors.values()) editor.setVim(on);
};
vimInput.addEventListener(EVENT.change, () => setVim(vimInput.checked));

const toggleSettings = (open = !dock.isOpen(DOCK.panel.settings)): void => {
  dock.show(DOCK.panel.settings, open);
  palette.hidden = true;
};

const revealSetting = (id: string): void => {
  dock.show(DOCK.panel.settings, true);
  const input = element<HTMLElement>(id);
  const row = input.closest<HTMLElement>(ROW_SELECTOR) ?? input;
  row.scrollIntoView({ block: SCROLL_NEAREST });
  row.classList.add(CLASS.flash);
  window.setTimeout(() => row.classList.remove(CLASS.flash), FLASH_TIME);
  input.focus();
};

function renderChips(current: Options): void {
  chips.replaceChildren(...optionChips(current, Object.keys(environment()).length).map((chip) => {
    const node = document.createElement(TAG.button);
    node.className = CLASS.chip;
    node.textContent = chip.label;
    node.title = TEXT.chipTitle;
    node.addEventListener(EVENT.click, () => revealSetting(chip.setting));
    return node;
  }));
}

const copyOutput = (): void => {
  void navigator.clipboard.writeText(shown === OUTPUT.problems ? output.textContent ?? '' : outputText(shown)).then(() => say(TEXT.copied));
};
const downloadOutput = (): void => {
  if (!last?.result) return say(TEXT.compileFirst);
  const [text, suffix, type] = shown === OUTPUT.text ? [last.text, DOWNLOAD_NAMES.text, MIME.text] : shown === OUTPUT.map && hostMap !== null
    ? [last.map, DOWNLOAD_NAMES.map, MIME.xml] : [last.xml, DOWNLOAD_NAMES.xml, MIME.xml];
  const link = document.createElement(TAG.link);
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = baseName() + suffix;
  link.click();
  URL.revokeObjectURL(link.href);
};
const chooseMap = (): void => element<HTMLInputElement>(ELEMENT.hostMap).click();
const clearMap = (): void => {
  hostMap = null;
  hostMapName.textContent = '';
  hostMapClear.hidden = true;
  element<HTMLInputElement>(ELEMENT.hostMap).value = '';
  if (last) compile();
  show(shown);
  scheduleBlueprint();
};

element(ELEMENT.compile).addEventListener(EVENT.click, buildAndShow);
element(ELEMENT.run).addEventListener(EVENT.click, run);
for (const button of document.querySelectorAll<HTMLButtonElement>(OUTPUT_BUTTONS)) {
  button.addEventListener(EVENT.click, () => show(button.getAttribute(ATTRIBUTE.output) as OutputName));
}
element(ELEMENT.copy).addEventListener(EVENT.click, copyOutput);
element(ELEMENT.download).addEventListener(EVENT.click, downloadOutput);
element(ELEMENT.hostMapButton).addEventListener(EVENT.click, chooseMap);
element(ELEMENT.settingsButton).addEventListener(EVENT.click, () => toggleSettings());
element(ELEMENT.referenceButton).addEventListener(EVENT.click, () => panel.toggle());
const toggleBlueprint = (): void => dock.show(DOCK.panel.blueprint, !dock.isOpen(DOCK.panel.blueprint));
element(ELEMENT.blueprintButton).addEventListener(EVENT.click, toggleBlueprint);
hostMapClear.addEventListener(EVENT.click, clearMap);
element<HTMLInputElement>(ELEMENT.hostMap).addEventListener(EVENT.change, (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  void file.text().then((text) => {
    hostMap = text;
    hostMapName.textContent = TEXT.hostMapChosen(file.name);
    hostMapClear.hidden = false;
    compile();
    show(OUTPUT.map);
    scheduleBlueprint();
  });
});

const commands = (): Command[] => {
  const toggle = (input: HTMLInputElement, name: string): Command => ({
    title: TEXT.commands.toggle(name, input.checked), detail: TEXT.commandDetail.option, shortcut: '', run: () => {
      input.checked = !input.checked;
      optionChanged();
    },
  });
  return [
    { title: TEXT.commands.build, detail: TEXT.commandDetail.action, shortcut: shortcut(SHORTCUT.build), run: buildAndShow },
    { title: TEXT.commands.run, detail: TEXT.commandDetail.action, shortcut: shortcut(SHORTCUT.run), run },
    { title: TEXT.commands.settings, detail: TEXT.commandDetail.action, shortcut: shortcut(SHORTCUT.settings), run: () => toggleSettings(true) },
    { title: TEXT.commands.reference, detail: TEXT.commandDetail.action, shortcut: shortcut(SHORTCUT.reference), run: () => panel.toggle() },
    { title: TEXT.commands.searchReference, detail: TEXT.commandDetail.action, shortcut: '', run: () => panel.focusSearch() },
    { title: TEXT.commands.blueprint, detail: TEXT.commandDetail.action, shortcut: '', run: toggleBlueprint },
    ...Object.values(OUTPUT).map((name): Command => ({ title: TEXT.commands.output(TEXT.outputNames[name]), detail: TEXT.commandDetail.output, shortcut: '', run: () => show(name) })),
    { title: TEXT.commands.map, detail: TEXT.commandDetail.action, shortcut: '', run: chooseMap },
    ...(hostMap === null ? [] : [{ title: TEXT.commands.clearMap, detail: TEXT.commandDetail.action, shortcut: '', run: clearMap }]),
    { title: TEXT.commands.copy, detail: TEXT.commandDetail.action, shortcut: '', run: copyOutput },
    { title: TEXT.commands.download, detail: TEXT.commandDetail.action, shortcut: '', run: downloadOutput },
    { title: TEXT.commands.newFile, detail: TEXT.commandDetail.action, shortcut: '', run: newFile },
    { title: TEXT.commands.resetLayout, detail: TEXT.commandDetail.action, shortcut: '', run: () => dock.restore(null, workspace.list(), activeFile, dock.isOpen(DOCK.panel.reference)) },
    ...TARGETS.map((target): Command => ({ title: TEXT.commands.target(target), detail: TEXT.commandDetail.option, shortcut: '', run: () => {
      targetSelect.value = target;
      optionChanged();
    } })),
    toggle(obfuscateInput, TEXT.optionNames.obfuscate),
    toggle(directIndexInput, TEXT.optionNames.directIndex),
    toggle(numberTextInput, TEXT.optionNames.numberText),
    toggle(replaceInput, TEXT.optionNames.replace),
    { title: TEXT.commands.newSeed, detail: TEXT.commandDetail.option, shortcut: '', run: newSeed },
    { title: TEXT.commands.vim, detail: TEXT.commandDetail.option, shortcut: '', run: () => setVim(!vimInput.checked) },
    { title: TEXT.commands.guide, detail: TEXT.commandDetail.action, shortcut: '', run: () => window.open(GUIDE_URL) },
    ...workspace.list().map((file): Command => ({ title: TEXT.commands.openFile(shortName(file)), detail: TEXT.commandDetail.file, shortcut: '', run: () => openFile(file) })),
    ...workspace.list().map((file): Command => ({ title: TEXT.commands.deleteFile(shortName(file)), detail: TEXT.commandDetail.file, shortcut: '', run: () => deleteFile(file) })),
    ...exampleFiles.map((file): Command => ({ title: TEXT.commands.example(exampleName(file)), detail: TEXT.commandDetail.example, shortcut: '', run: () => openExample(file) })),
  ];
};

let shownCommands: Command[] = [];
let activeCommand = 0;
let returnFocus: HTMLElement | null = null;
const renderPalette = (): void => {
  shownCommands = filterCommands(commands(), paletteInput.value);
  activeCommand = Math.min(activeCommand, Math.max(0, shownCommands.length - 1));
  paletteList.replaceChildren(...(shownCommands.length === 0 ? [Object.assign(document.createElement(TAG.listItem), { textContent: TEXT.noCommands, className: CLASS.muted })] : shownCommands.map((command, index) => {
    const item = document.createElement(TAG.listItem);
    item.className = index === activeCommand ? CLASS.active : '';
    const title = document.createElement(TAG.span);
    title.textContent = command.title;
    const key = document.createElement(TAG.span);
    key.className = CLASS.shortcut;
    key.textContent = command.shortcut || command.detail;
    item.append(title, key);
    item.addEventListener(EVENT.pointerDown, (event) => {
      event.preventDefault();
      runCommand(command);
    });
    return item;
  })));
  paletteList.querySelector(SELECTOR.active)?.scrollIntoView({ block: SCROLL_NEAREST });
};
const openPalette = (query = ''): void => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  palette.hidden = false;
  paletteInput.value = query;
  activeCommand = 0;
  renderPalette();
  paletteInput.focus();
};
const closePalette = (): void => {
  palette.hidden = true;
  (returnFocus ?? currentEditor()?.view.contentDOM)?.focus();
};
const runCommand = (command: Command): void => {
  closePalette();
  command.run();
};
paletteInput.addEventListener(EVENT.input, () => {
  activeCommand = 0;
  renderPalette();
});
paletteInput.addEventListener(KEYDOWN, (event) => {
  if (event.key === KEY_NAME.down || event.key === KEY_NAME.up) {
    event.preventDefault();
    const step = event.key === KEY_NAME.down ? 1 : -1;
    activeCommand = (activeCommand + step + shownCommands.length) % Math.max(1, shownCommands.length);
    renderPalette();
  } else if (event.key === KEY_NAME.enter) {
    event.preventDefault();
    const command = shownCommands[activeCommand];
    if (command) runCommand(command);
  }
});
document.addEventListener(EVENT.pointerDown, (event) => {
  if (!palette.hidden && !palette.contains(event.target as Node)) palette.hidden = true;
});
element(ELEMENT.paletteButton).addEventListener(EVENT.click, () => openPalette());
element(ELEMENT.examplesButton).addEventListener(EVENT.click, () => openPalette(TEXT.commands.example('')));
element(ELEMENT.filesButton).addEventListener(EVENT.click, () => openPalette(TEXT.commands.openFile('')));

window.addEventListener(KEYDOWN, (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (event.key === ESCAPE && !palette.hidden) {
    event.preventDefault();
    closePalette();
    return;
  }
  if (!modifier) return;
  const key = event.key.toLowerCase();
  if (key === KEY_NAME.enter.toLowerCase()) {
    event.preventDefault();
    if (event.shiftKey) run();
    else buildAndShow();
  } else if (key === SHORTCUT_KEY.palette) {
    event.preventDefault();
    if (palette.hidden) openPalette();
    else closePalette();
  } else if (key === SHORTCUT_KEY.files) {
    event.preventDefault();
    openPalette(TEXT.commands.openFile(''));
  } else if (key === SHORTCUT_KEY.settings) {
    event.preventDefault();
    toggleSettings();
  } else if (key === SHORTCUT_KEY.reference) {
    event.preventDefault();
    panel.toggle();
  }
}, true);

options();
status.textContent = idleStatus();
show(OUTPUT.problems);
