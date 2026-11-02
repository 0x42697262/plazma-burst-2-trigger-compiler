import { EditorState, Compartment } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, hoverTooltip,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { linter, lintKeymap } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { vim } from '@replit/codemirror-vim';
import { oneDark } from '@codemirror/theme-one-dark';
import { complete, definition, hover } from '../service/service.ts';
import type { ServiceLocation } from '../service/service.ts';
import { ptcLanguage, pasmLanguage } from './highlight.ts';
import { renderMarkdown } from './markdown.ts';
import { problemsOf } from './pipeline.ts';
import type { Workspace } from './workspace.ts';
import { ASSEMBLY_EXTENSION, CLASS, KEY, TAG, WORD_BEFORE } from './keys.ts';
import { HOVER_DELAY, LINT_DELAY } from './constants.ts';

export type EditorHooks = { onChange: (file: string, text: string) => void; onJump: (location: ServiceLocation) => void };

const positionOf = (state: EditorState, offset: number): { line: number; column: number } => {
  const line = state.doc.lineAt(offset);
  return { line: line.number - 1, column: offset - line.from };
};

export class CodeEditor {
  readonly view: EditorView;
  private readonly workspace: Workspace;
  private readonly hooks: EditorHooks;
  private readonly states = new Map<string, EditorState>();
  private readonly vimMode = new Compartment();
  private vimOn: boolean;
  private file: string;

  constructor(parent: HTMLElement, workspace: Workspace, hooks: EditorHooks, vimOn: boolean) {
    this.workspace = workspace;
    this.hooks = hooks;
    this.vimOn = vimOn;
    this.file = workspace.active;
    this.view = new EditorView({ parent, state: this.stateFor(this.file) });
  }

  get activeFile(): string {
    return this.file;
  }

  open(file: string): void {
    this.states.set(this.file, this.view.state);
    this.file = file;
    this.view.setState(this.stateFor(file));
    this.view.focus();
  }

  reload(): void {
    this.states.clear();
    this.file = this.workspace.active;
    this.view.setState(this.stateFor(this.file));
  }

  forget(file: string): void {
    this.states.delete(file);
  }

  select(line: number, column: number): void {
    const target = this.view.state.doc.line(Math.min(line + 1, this.view.state.doc.lines));
    const offset = Math.min(target.from + column, target.to);
    this.view.dispatch({ selection: { anchor: offset }, scrollIntoView: true });
    this.view.focus();
  }

  setVim(on: boolean): void {
    this.vimOn = on;
    this.view.dispatch({ effects: this.vimMode.reconfigure(on ? vim() : []) });
    for (const [file, state] of this.states) this.states.set(file, state.update({ effects: this.vimMode.reconfigure(on ? vim() : []) }).state);
  }

  private stateFor(file: string): EditorState {
    const saved = this.states.get(file);
    if (saved) return saved;
    return EditorState.create({ doc: this.workspace.get(file) ?? '', extensions: this.extensions(file) });
  }

  private extensions(file: string): Extension[] {
    const read = (name: string): string | null => this.workspace.get(name);
    const isAssembly = file.endsWith(ASSEMBLY_EXTENSION);
    const lint = linter((view): Diagnostic[] => problemsOf(this.workspace, file).map((entry) => {
      const line = view.state.doc.line(Math.min(entry.line + 1, view.state.doc.lines));
      return { from: line.from, to: line.to, severity: entry.severity, message: entry.message };
    }), { delay: LINT_DELAY });
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
      oneDark,
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
      }),
    ];
  }
}
