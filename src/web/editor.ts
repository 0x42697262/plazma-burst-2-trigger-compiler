import { EditorState, Compartment, StateEffect } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, hoverTooltip,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { forceLinting, linter, lintKeymap } from '@codemirror/lint';

const refreshLint = StateEffect.define<null>();
import type { Diagnostic } from '@codemirror/lint';
import { vim } from '@replit/codemirror-vim';
import { oneDark } from '@codemirror/theme-one-dark';
import { complete, definition, hover } from '../service/service.ts';
import type { ServiceLocation } from '../service/service.ts';
import { ptcLanguage, pasmLanguage } from './highlight.ts';
import { renderMarkdown } from './markdown.ts';
import { problemsOf } from './pipeline.ts';
import type { CompileOptions } from '../compiler/compile.ts';
import type { Workspace } from './workspace.ts';
import { ASSEMBLY_EXTENSION, CLASS, DOT, KEY, PLAIN_EDITOR_THEME, TAG, WORD_AFTER, WORD_BEFORE } from './keys.ts';
import { HOVER_DELAY, LINT_DELAY } from './constants.ts';

export type EditorHooks = {
  onChange: (file: string, text: string) => void; onJump: (location: ServiceLocation) => void; checkOptions: () => Partial<CompileOptions>;
  onCursor: (file: string) => void; onFocus: (file: string) => void;
};

const LIGHT_THEME = EditorView.theme(PLAIN_EDITOR_THEME, { dark: false });
const DARK_THEME = [EditorView.theme(PLAIN_EDITOR_THEME, { dark: true }), oneDark];

const positionOf = (state: EditorState, offset: number): { line: number; column: number } => {
  const line = state.doc.lineAt(offset);
  return { line: line.number - 1, column: offset - line.from };
};

export class CodeEditor {
  readonly view: EditorView;
  readonly file: string;
  private readonly workspace: Workspace;
  private readonly hooks: EditorHooks;
  private readonly vimMode = new Compartment();
  private readonly theme = new Compartment();
  private readonly vimOn: boolean;
  private readonly dark: boolean;

  constructor(parent: HTMLElement, file: string, workspace: Workspace, hooks: EditorHooks, vimOn: boolean, dark: boolean) {
    this.workspace = workspace;
    this.hooks = hooks;
    this.file = file;
    this.vimOn = vimOn;
    this.dark = dark;
    this.view = new EditorView({ parent, state: EditorState.create({ doc: workspace.get(file) ?? '', extensions: this.extensions(file) }) });
  }

  destroy(): void {
    this.view.destroy();
  }

  replaceText(text: string): void {
    if (text === this.view.state.doc.toString()) return;
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text } });
  }

  select(line: number, column: number, focus = true): void {
    const target = this.view.state.doc.line(Math.min(line + 1, this.view.state.doc.lines));
    const offset = Math.min(target.from + column, target.to);
    this.view.dispatch({ selection: { anchor: offset }, scrollIntoView: true });
    if (focus) this.view.focus();
  }

  relint(): void {
    this.view.dispatch({ effects: refreshLint.of(null) });
    forceLinting(this.view);
  }

  setVim(on: boolean): void {
    this.view.dispatch({ effects: this.vimMode.reconfigure(on ? vim() : []) });
  }

  setDark(on: boolean): void {
    this.view.dispatch({ effects: this.theme.reconfigure(on ? DARK_THEME : LIGHT_THEME) });
  }

  wordAtCursor(): { word: string; group: string | null } {
    const state = this.view.state;
    const offset = state.selection.main.head;
    const line = state.doc.lineAt(offset);
    const before = WORD_BEFORE.exec(line.text.slice(0, offset - line.from))?.[0] ?? '';
    const after = WORD_AFTER.exec(line.text.slice(offset - line.from))?.[0] ?? '';
    const start = offset - line.from - before.length;
    const group = line.text.charAt(start - 1) === DOT ? WORD_BEFORE.exec(line.text.slice(0, start - 1))?.[0] ?? null : null;
    return { word: before + after, group };
  }

  cursorLine(): number {
    return this.view.state.doc.lineAt(this.view.state.selection.main.head).number;
  }

  insert(text: string): void {
    const { from, to } = this.view.state.selection.main;
    this.view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true });
    this.view.focus();
  }

  private extensions(file: string): Extension[] {
    const read = (name: string): string | null => this.workspace.get(name);
    const isAssembly = file.endsWith(ASSEMBLY_EXTENSION);
    const lint = linter((view): Diagnostic[] => problemsOf(this.workspace, file, this.hooks.checkOptions()).map((entry) => {
      const line = view.state.doc.line(Math.min(entry.line + 1, view.state.doc.lines));
      return { from: line.from, to: line.to, severity: entry.severity, message: entry.message };
    }), { delay: LINT_DELAY, needsRefresh: (update) => update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(refreshLint))) });
    const completions = (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(WORD_BEFORE);
      if (!word || (word.from === word.to && !context.explicit && !/[.("]$/.test(context.state.sliceDoc(word.from - 1, word.from)))) return null;
      const items = complete(context.state.doc.toString(), positionOf(context.state, context.pos), file, read);
      return {
        from: word.from,
        options: items.map((item) => ({ label: item.label, type: item.kind, detail: item.detail, info: item.documentation || undefined, apply: item.insertText })),
      };
    };
    const hovers = hoverTooltip((view, offset) => {
      const text = hover(view.state.doc.toString(), positionOf(view.state, offset), file, read);
      if (text === null) return null;
      return {
        pos: offset,
        create: () => {
          const dom = document.createElement(TAG.div);
          dom.className = CLASS.hover;
          dom.innerHTML = renderMarkdown(text);
          return { dom };
        },
      };
    }, { hoverTime: HOVER_DELAY });
    const goToDefinition = (view: EditorView): boolean => {
      const found = definition(view.state.doc.toString(), positionOf(view.state, view.state.selection.main.head), file, read);
      if (found) this.hooks.onJump(found);
      return found !== null;
    };
    return [
      this.vimMode.of(this.vimOn ? vim() : []),
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      this.theme.of(this.dark ? DARK_THEME : LIGHT_THEME),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      isAssembly ? pasmLanguage : ptcLanguage,
      ...(isAssembly ? [] : [autocompletion({ override: [completions] }), hovers]),
      lint,
      keymap.of([
        { key: KEY.definition, run: goToDefinition },
        { key: KEY.definitionAlternative, run: goToDefinition },
        ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...lintKeymap, indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) this.hooks.onChange(file, update.state.doc.toString());
        if (update.selectionSet || update.docChanged) this.hooks.onCursor(file);
        if (update.focusChanged && update.view.hasFocus) this.hooks.onFocus(file);
      }),
    ];
  }
}
