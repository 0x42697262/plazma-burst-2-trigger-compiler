import examples from 'virtual:examples';
import { CodeEditor } from './editor.ts';
import { Workspace } from './workspace.ts';
import { build, checkOptions, parseEnvironment, simulate } from './pipeline.ts';
import type { Build, BuildRecord, Options } from './pipeline.ts';
import { filterCommands, optionChips, shortcutLabel } from './commands.ts';
import type { Command } from './commands.ts';
import {
  ATTRIBUTE, CLASS, SELECTOR, CSS_VARIABLE, DARK_QUERY, EMPTY_OBJECT, ESCAPE, FOLDER_POSITION, GUIDE_URL, KEY_NAME, KEYDOWN, LIBRARY_FOLDER, MAC_PLATFORM, OUTPUT_BUTTONS, SCROLL_NEAREST, SHORTCUT, SHORTCUT_KEY,
  TAB_ACTIVE, DEFAULT_FILE, DOWNLOAD_NAMES, ELEMENT, EVENT, EXTENSION, MIME, OUTPUT, PIXELS, STARTER_EXAMPLE, STORAGE, TAG, TRUE_TEXT, WORKSPACE_ROOT,
} from './keys.ts';
import { DEFAULT_FRAMES, DEFAULT_GUARD, MIN_EDITOR_HEIGHT, MIN_OUTPUT_HEIGHT, STATUS_TIME } from './constants.ts';
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
const tabs = element<HTMLElement>(ELEMENT.tabs);
const settings = element<HTMLDivElement>(ELEMENT.settings);
const settingsButton = element<HTMLButtonElement>(ELEMENT.settingsButton);
const palette = element<HTMLDivElement>(ELEMENT.palette);
const paletteInput = element<HTMLInputElement>(ELEMENT.paletteInput);
const paletteList = element<HTMLUListElement>(ELEMENT.paletteList);
const hostMapName = element<HTMLSpanElement>(ELEMENT.hostMapName);
const hostMapClear = element<HTMLButtonElement>(ELEMENT.hostMapClear);
const workbench = element<HTMLElement>(ELEMENT.main).querySelector<HTMLElement>(TAG.section) as HTMLElement;
const splitter = element<HTMLDivElement>(ELEMENT.splitter);

const savedOptions = JSON.parse(storage?.getItem(STORAGE.options) ?? EMPTY_OBJECT) as Partial<Options>;
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
const savedHeight = storage?.getItem(STORAGE.outputHeight);
if (savedHeight) workbench.style.setProperty(CSS_VARIABLE.outputHeight, savedHeight);
element(ELEMENT.shortcutHelp).textContent = TEXT.shortcutHelp(shortcut(SHORTCUT.build), shortcut(SHORTCUT.run), shortcut(SHORTCUT.palette), shortcut(SHORTCUT.settings));
element(ELEMENT.compile).title = TEXT.withShortcut(element(ELEMENT.compile).title, shortcut(SHORTCUT.build));
element(ELEMENT.run).title = TEXT.withShortcut(element(ELEMENT.run).title, shortcut(SHORTCUT.run));
element(ELEMENT.paletteButton).textContent = shortcut(SHORTCUT.palette);

let hostMap: string | null = null;
let last: Build | null = null;
let runLines: string[] = [];
let shown: OutputName = OUTPUT.problems;
let statusTimer = 0;

const renderChips = (current: Options): void => {
  chips.replaceChildren(...optionChips(current, Object.keys(environment()).length).map((label) => {
    const chip = document.createElement(TAG.span);
    chip.className = CLASS.chip;
    chip.textContent = label;
    chip.addEventListener(EVENT.click, () => toggleSettings(true));
    return chip;
  }));
};

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

const baseName = (): string => (editor.activeFile.split(PATH_SEPARATOR).pop() ?? DEFAULT_FILE).replace(EXTENSION, '');

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

const buildStore = (): Record<string, unknown> => JSON.parse(storage?.getItem(STORAGE.build) ?? EMPTY_OBJECT) as Record<string, unknown>;

const recordOf = (stored: unknown): BuildRecord => {
  if (Array.isArray(stored)) return { uids: stored.filter((uid): uid is string => typeof uid === 'string'), walls: [] };
  const record = stored as Partial<BuildRecord> | undefined;
  return { uids: record?.uids ?? [], walls: record?.walls ?? [] };
};

const compile = (): Build => {
  const file = editor.activeFile;
  last = build(workspace, file, options(), hostMap, environment(), recordOf(buildStore()[file]));
  if (hostMap !== null && last.map !== '') {
    storage?.setItem(STORAGE.build, JSON.stringify({ ...buildStore(), [file]: { uids: last.uids, walls: last.walls } }));
  }
  status.textContent = idleStatus();
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

const openFile = (file: string): void => {
  workspace.activate(file);
  editor.open(file);
  renderTabs();
};

const newFile = (): void => {
  const name = window.prompt(TEXT.newFilePrompt);
  if (!name) return;
  const file = workspace.workspacePath(name);
  if (workspace.get(file) === null) workspace.set(file, '');
  openFile(file);
};

const renderTabs = (): void => {
  tabs.replaceChildren();
  for (const file of workspace.list()) {
    const tab = document.createElement(TAG.span);
    tab.className = file === editor.activeFile ? TAB_ACTIVE : CLASS.tab;
    tab.textContent = file.slice(WORKSPACE_ROOT.length);
    tab.addEventListener(EVENT.click, () => openFile(file));
    if (workspace.list().length > 1) {
      const close = document.createElement(TAG.span);
      close.className = CLASS.close;
      close.textContent = TEXT.closeMark;
      close.addEventListener(EVENT.click, (event) => {
        event.stopPropagation();
        if (!window.confirm(TEXT.removeFile(file.slice(WORKSPACE_ROOT.length)))) return;
        workspace.remove(file);
        editor.forget(file);
        editor.open(workspace.active);
        renderTabs();
      });
      tab.append(close);
    }
    tabs.append(tab);
  }
  const add = document.createElement(TAG.button);
  add.id = ELEMENT.newFile;
  add.textContent = TEXT.addFile;
  add.title = TEXT.commands.newFile;
  add.addEventListener(EVENT.click, newFile);
  tabs.append(add);
};

const darkQuery = window.matchMedia(DARK_QUERY);
const editor = new CodeEditor(element(ELEMENT.editor), workspace, {
  onChange: (file, text) => workspace.set(file, text),
  onJump: (location) => {
    if (location.file !== editor.activeFile && workspace.get(location.file) !== null) openFile(location.file);
    editor.select(location.line, location.column);
  },
  checkOptions: () => checkOptions(numberTextInput.checked, directIndexInput.checked, options().target, environment()),
}, vimInput.checked, darkQuery.matches);
darkQuery.addEventListener(EVENT.change, () => editor.setDark(darkQuery.matches));

const exampleFiles = Object.keys(examples).filter((name) => !isStandardLibrary(name) && !name.split(PATH_SEPARATOR).includes(LIBRARY_FOLDER)).sort();
const exampleName = (file: string): string => {
  const parts = file.split(PATH_SEPARATOR);
  return TEXT.exampleName(parts.at(FOLDER_POSITION) ?? '', parts[parts.length - 1] ?? file);
};
const examplesSelect = element<HTMLSelectElement>(ELEMENT.examples);
const placeholder = document.createElement(TAG.option);
placeholder.textContent = TEXT.examplesPlaceholder;
placeholder.value = '';
examplesSelect.append(placeholder);
const groups = new Map<string, HTMLOptGroupElement>();
for (const file of exampleFiles) {
  const folder = file.split(PATH_SEPARATOR).at(FOLDER_POSITION) ?? '';
  let group = groups.get(folder);
  if (!group) {
    group = document.createElement(TAG.optionGroup);
    group.label = TEXT.exampleGroup(folder);
    groups.set(folder, group);
    examplesSelect.append(group);
  }
  const option = document.createElement(TAG.option);
  option.value = file;
  option.textContent = exampleName(file);
  group.append(option);
}
examplesSelect.value = storage?.getItem(STORAGE.example) ?? '';
const openExample = (file: string): void => {
  workspace.loadExample(examples, file);
  storage?.setItem(STORAGE.example, file);
  examplesSelect.value = file;
  editor.open(workspace.active);
  renderTabs();
  last = null;
  status.textContent = idleStatus();
  show(OUTPUT.problems);
};
examplesSelect.addEventListener(EVENT.change, () => {
  if (examplesSelect.value !== '') openExample(examplesSelect.value);
});

const optionChanged = (): void => {
  options();
  editor.relint();
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
  editor.setVim(on);
};
vimInput.addEventListener(EVENT.change, () => setVim(vimInput.checked));

const toggleSettings = (open = settings.hidden): void => {
  settings.hidden = !open;
  palette.hidden = true;
};
settingsButton.addEventListener(EVENT.click, () => toggleSettings());
document.addEventListener(EVENT.pointerDown, (event) => {
  const target = event.target as Node;
  if (!settings.hidden && !settings.contains(target) && !settingsButton.contains(target) && !chips.contains(target)) settings.hidden = true;
  if (!palette.hidden && !palette.contains(target)) palette.hidden = true;
});

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
};

element(ELEMENT.compile).addEventListener(EVENT.click, buildAndShow);
element(ELEMENT.run).addEventListener(EVENT.click, run);
for (const button of document.querySelectorAll<HTMLButtonElement>(OUTPUT_BUTTONS)) {
  button.addEventListener(EVENT.click, () => show(button.getAttribute(ATTRIBUTE.output) as OutputName));
}
element(ELEMENT.copy).addEventListener(EVENT.click, copyOutput);
element(ELEMENT.download).addEventListener(EVENT.click, downloadOutput);
element(ELEMENT.hostMapButton).addEventListener(EVENT.click, chooseMap);
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
    ...Object.values(OUTPUT).map((name): Command => ({ title: TEXT.commands.output(TEXT.outputNames[name]), detail: TEXT.commandDetail.output, shortcut: '', run: () => show(name) })),
    { title: TEXT.commands.map, detail: TEXT.commandDetail.action, shortcut: '', run: chooseMap },
    ...(hostMap === null ? [] : [{ title: TEXT.commands.clearMap, detail: TEXT.commandDetail.action, shortcut: '', run: clearMap }]),
    { title: TEXT.commands.copy, detail: TEXT.commandDetail.action, shortcut: '', run: copyOutput },
    { title: TEXT.commands.download, detail: TEXT.commandDetail.action, shortcut: '', run: downloadOutput },
    { title: TEXT.commands.newFile, detail: TEXT.commandDetail.action, shortcut: '', run: newFile },
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
    ...exampleFiles.map((file): Command => ({ title: TEXT.commands.example(exampleName(file)), detail: TEXT.commandDetail.example, shortcut: '', run: () => openExample(file) })),
  ];
};

let shownCommands: Command[] = [];
let activeCommand = 0;
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
const openPalette = (): void => {
  settings.hidden = true;
  palette.hidden = false;
  paletteInput.value = '';
  activeCommand = 0;
  renderPalette();
  paletteInput.focus();
};
const closePalette = (): void => {
  palette.hidden = true;
  editor.view.focus();
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
element(ELEMENT.paletteButton).addEventListener(EVENT.click, openPalette);

window.addEventListener(KEYDOWN, (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (event.key === ESCAPE && (!palette.hidden || !settings.hidden)) {
    event.preventDefault();
    settings.hidden = true;
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
  } else if (key === SHORTCUT_KEY.settings) {
    event.preventDefault();
    toggleSettings();
  }
}, true);

let dragTop = 0;
splitter.addEventListener(EVENT.pointerDown, (event) => {
  splitter.setPointerCapture(event.pointerId);
  splitter.classList.add(CLASS.dragging);
  dragTop = workbench.getBoundingClientRect().bottom;
});
splitter.addEventListener(EVENT.pointerMove, (event) => {
  if (!splitter.hasPointerCapture(event.pointerId)) return;
  const height = Math.max(MIN_OUTPUT_HEIGHT, Math.min(dragTop - event.clientY, workbench.getBoundingClientRect().height - MIN_EDITOR_HEIGHT));
  workbench.style.setProperty(CSS_VARIABLE.outputHeight, height + PIXELS);
});
splitter.addEventListener(EVENT.pointerUp, (event) => {
  splitter.releasePointerCapture(event.pointerId);
  splitter.classList.remove(CLASS.dragging);
  storage?.setItem(STORAGE.outputHeight, workbench.style.getPropertyValue(CSS_VARIABLE.outputHeight));
});

renderTabs();
options();
status.textContent = idleStatus();
show(OUTPUT.problems);
