import examples from 'virtual:examples';
import { CodeEditor } from './editor.ts';
import { Workspace } from './workspace.ts';
import { build, checkOptions, simulate } from './pipeline.ts';
import type { Build, Options } from './pipeline.ts';
import { ATTRIBUTE, CLASS, EMPTY_OBJECT, ENTER, FOLDER_POSITION, KEYDOWN, LIBRARY_FOLDER, OUTPUT_BUTTONS, TAB_ACTIVE, DEFAULT_FILE, DOWNLOAD_NAMES, ELEMENT, EVENT, EXTENSION, MIME, OUTPUT, STARTER_EXAMPLE, STORAGE, TAG, TRUE_TEXT, WORKSPACE_ROOT } from './keys.ts';
import { DEFAULT_FRAMES, DEFAULT_GUARD, STATUS_TIME } from './constants.ts';
import { TEXT } from './text.ts';
import { PATH_SEPARATOR } from '../lang/keys.ts';
import { DEFAULT_TARGET, isTarget } from '../pcode/keys.ts';

type OutputName = (typeof OUTPUT)[keyof typeof OUTPUT];

const element = <Type extends HTMLElement>(id: string): Type => document.getElementById(id) as Type;
const storage = ((): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

const workspace = new Workspace(storage);
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
const output = element<HTMLPreElement>(ELEMENT.output);
const status = element<HTMLDivElement>(ELEMENT.status);
const tabs = element<HTMLElement>(ELEMENT.tabs);

const savedOptions = JSON.parse(storage?.getItem(STORAGE.options) ?? EMPTY_OBJECT) as Partial<Options>;
prefixInput.value = savedOptions.prefix ?? '';
guardInput.value = String(savedOptions.guard ?? DEFAULT_GUARD);
framesInput.value = String(savedOptions.frames ?? DEFAULT_FRAMES);
numberTextInput.checked = savedOptions.numberText ?? true;
directIndexInput.checked = savedOptions.directIndex ?? false;
targetSelect.value = savedOptions.target ?? DEFAULT_TARGET;
vimInput.checked = storage?.getItem(STORAGE.vim) === TRUE_TEXT;

let hostMap: string | null = null;
let hostMapName = '';
let last: Build | null = null;
let runLines: string[] = [];
let shown: OutputName = OUTPUT.problems;
let statusTimer = 0;

const options = (): Options => {
  const value = { prefix: prefixInput.value.trim(), guard: Number(guardInput.value) || 0, frames: Math.max(1, Number(framesInput.value) || DEFAULT_FRAMES), numberText: numberTextInput.checked, directIndex: directIndexInput.checked, target: isTarget(targetSelect.value) ? targetSelect.value : DEFAULT_TARGET };
  storage?.setItem(STORAGE.options, JSON.stringify(value));
  return value;
};

const say = (text: string): void => {
  status.textContent = text;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    status.textContent = last?.result ? summary(last) : '';
  }, STATUS_TIME);
};

const summary = (current: Build): string => {
  if (!current.result) return '';
  const program = current.result.program;
  return TEXT.compiled(program.triggers.length, program.triggers.reduce((total, trigger) => total + trigger.actions.length, 0), program.timers.length);
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

const compile = (): Build => {
  last = build(workspace, editor.activeFile, options(), hostMap);
  status.textContent = summary(last);
  return last;
};

const run = (): void => {
  const current = compile();
  runLines = current.result ? simulate(current.result, options().frames) : [];
  show(current.result ? OUTPUT.run : OUTPUT.problems);
};

const renderTabs = (): void => {
  tabs.replaceChildren();
  for (const file of workspace.list()) {
    const tab = document.createElement(TAG.span);
    tab.className = file === editor.activeFile ? TAB_ACTIVE : CLASS.tab;
    tab.textContent = file.slice(WORKSPACE_ROOT.length);
    tab.addEventListener(EVENT.click, () => {
      workspace.activate(file);
      editor.open(file);
      renderTabs();
    });
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
  add.addEventListener(EVENT.click, () => {
    const name = window.prompt(TEXT.newFilePrompt);
    if (!name) return;
    const file = workspace.workspacePath(name);
    if (workspace.get(file) === null) workspace.set(file, '');
    workspace.activate(file);
    editor.open(file);
    renderTabs();
  });
  tabs.append(add);
};

const editor = new CodeEditor(element(ELEMENT.editor), workspace, {
  onChange: (file, text) => workspace.set(file, text),
  onJump: (location) => {
    if (location.file !== editor.activeFile && workspace.get(location.file) !== null) {
      workspace.activate(location.file);
      editor.open(location.file);
      renderTabs();
    }
    editor.select(location.line, location.column);
  },
  checkOptions: () => checkOptions(numberTextInput.checked, directIndexInput.checked, options().target),
}, vimInput.checked);

const examplesSelect = element<HTMLSelectElement>(ELEMENT.examples);
const placeholder = document.createElement(TAG.option);
placeholder.textContent = TEXT.examplesPlaceholder;
placeholder.value = '';
examplesSelect.append(placeholder);
const groups = new Map<string, HTMLOptGroupElement>();
for (const file of Object.keys(examples).sort()) {
  const parts = file.split(PATH_SEPARATOR);
  if (parts.includes(LIBRARY_FOLDER)) continue;
  const folder = parts.at(FOLDER_POSITION) ?? '';
  let group = groups.get(folder);
  if (!group) {
    group = document.createElement(TAG.optionGroup);
    group.label = TEXT.exampleGroup(folder);
    groups.set(folder, group);
    examplesSelect.append(group);
  }
  const option = document.createElement(TAG.option);
  option.value = file;
  option.textContent = TEXT.exampleName(folder, parts[parts.length - 1] ?? file);
  group.append(option);
}
examplesSelect.value = storage?.getItem(STORAGE.example) ?? '';
examplesSelect.addEventListener(EVENT.change, () => {
  if (examplesSelect.value === '') return;
  workspace.loadExample(examples, examplesSelect.value);
  storage?.setItem(STORAGE.example, examplesSelect.value);
  editor.reload();
  renderTabs();
  last = null;
  show(OUTPUT.problems);
});

for (const input of [numberTextInput, directIndexInput, targetSelect]) {
  input.addEventListener(EVENT.change, () => {
    options();
    editor.relint();
  });
}
vimInput.addEventListener(EVENT.change, () => {
  storage?.setItem(STORAGE.vim, String(vimInput.checked));
  editor.setVim(vimInput.checked);
});
element(ELEMENT.compile).addEventListener(EVENT.click, () => {
  compile();
  show(last?.result && shown !== OUTPUT.problems ? shown : last?.result ? OUTPUT.xml : OUTPUT.problems);
});
element(ELEMENT.run).addEventListener(EVENT.click, run);
document.addEventListener(KEYDOWN, (event) => {
  if (event.key !== ENTER || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  if (event.shiftKey) run();
  else element(ELEMENT.compile).click();
});
for (const button of document.querySelectorAll<HTMLButtonElement>(OUTPUT_BUTTONS)) {
  button.addEventListener(EVENT.click, () => show(button.getAttribute(ATTRIBUTE.output) as OutputName));
}
element(ELEMENT.copy).addEventListener(EVENT.click, () => {
  void navigator.clipboard.writeText(shown === OUTPUT.problems ? output.textContent ?? '' : outputText(shown)).then(() => say(TEXT.copied));
});
element(ELEMENT.download).addEventListener(EVENT.click, () => {
  if (!last?.result) return say(TEXT.compileFirst);
  const [text, suffix, type] = shown === OUTPUT.text ? [last.text, DOWNLOAD_NAMES.text, MIME.text] : shown === OUTPUT.map && hostMap !== null
    ? [last.map, DOWNLOAD_NAMES.map, MIME.xml] : [last.xml, DOWNLOAD_NAMES.xml, MIME.xml];
  const link = document.createElement(TAG.link);
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = baseName() + suffix;
  link.click();
  URL.revokeObjectURL(link.href);
});
element(ELEMENT.hostMapButton).addEventListener(EVENT.click, () => element<HTMLInputElement>(ELEMENT.hostMap).click());
element<HTMLInputElement>(ELEMENT.hostMap).addEventListener(EVENT.change, (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  void file.text().then((text) => {
    hostMap = text;
    hostMapName = file.name;
    element(ELEMENT.hostMapName).textContent = TEXT.hostMapChosen(hostMapName);
    compile();
    show(OUTPUT.map);
  });
});

renderTabs();
show(OUTPUT.problems);
