import { breadcrumbs, referenceEntry, referenceIdFor, searchReference } from '../reference/reference.ts';
import type { ReferenceEntry, ReferenceField } from '../reference/reference.ts';
import { references, symbols } from '../service/service.ts';
import type { ServiceLocation } from '../service/service.ts';
import { CLASS, EVENT, EVENT_SYMBOL, KEY_NAME, PANEL, PROGRAM_PREFIX, ROOT_ID, TAG } from './keys.ts';
import { FOLLOW_DELAY } from './constants.ts';
import { renderMarkdown } from './markdown.ts';
import { TEXT } from './text.ts';

export type PanelHooks = {
  insert: (text: string) => void;
  jump: (location: ServiceLocation) => void;
  source: () => { file: string; text: string; read: (file: string) => string | null };
  cursorWord: () => { word: string; group: string | null };
  changed: (state: { open: boolean; follow: boolean }) => void;
};

const create = <Name extends keyof HTMLElementTagNameMap>(tag: Name, className = '', text = ''): HTMLElementTagNameMap[Name] => {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  if (text !== '') node.textContent = text;
  return node;
};

export class ReferencePanel {
  private readonly container: HTMLElement;
  private readonly hooks: PanelHooks;
  private readonly crumbs = create(TAG.nav, PANEL.crumbs);
  private readonly search = create(TAG.input, PANEL.search);
  private readonly body = create(TAG.div, PANEL.body);
  private readonly followButton = create(TAG.button, PANEL.follow, TEXT.reference.follow);
  private readonly backButton = create(TAG.button, PANEL.back, TEXT.reference.back);
  private readonly history: string[] = [];
  private current = ROOT_ID;
  private follow: boolean;
  private followTimer = 0;

  constructor(container: HTMLElement, hooks: PanelHooks, state: { open: boolean; follow: boolean }) {
    this.container = container;
    this.hooks = hooks;
    this.follow = state.follow;
    this.container.hidden = !state.open;
    const top = create(TAG.div, PANEL.top);
    const close = create(TAG.button, PANEL.close, TEXT.closeMark);
    close.title = TEXT.reference.close;
    close.addEventListener(EVENT.click, () => this.toggle(false));
    this.backButton.title = TEXT.reference.backTitle;
    this.backButton.addEventListener(EVENT.click, () => this.back());
    this.followButton.title = TEXT.reference.followTitle;
    this.followButton.addEventListener(EVENT.click, () => {
      this.follow = !this.follow;
      this.renderFollow();
      this.save();
      if (this.follow) this.followCursor();
    });
    top.append(this.backButton, this.crumbs, this.followButton, close);
    this.search.placeholder = TEXT.reference.searchPlaceholder;
    this.search.spellcheck = false;
    this.search.addEventListener(EVENT.input, () => this.render());
    this.search.addEventListener(EVENT.keydown, (event) => {
      if (event.key !== KEY_NAME.enter) return;
      const first = searchReference(this.search.value)[0];
      if (first) this.open(first.id);
    });
    this.container.append(top, this.search, this.body);
    this.renderFollow();
    this.render();
  }

  get isOpen(): boolean {
    return !this.container.hidden;
  }

  toggle(open = this.container.hidden): void {
    this.container.hidden = !open;
    this.save();
    if (open && this.follow) this.followCursor();
  }

  focusSearch(): void {
    this.toggle(true);
    this.search.focus();
    this.search.select();
  }

  open(id: string, remember = true): void {
    if (id === this.current && this.search.value === '') return;
    if (remember && id !== this.current) this.history.push(this.current);
    this.current = id;
    this.search.value = '';
    this.render();
  }

  cursorMoved(): void {
    if (!this.follow || this.container.hidden) return;
    window.clearTimeout(this.followTimer);
    this.followTimer = window.setTimeout(() => this.followCursor(), FOLLOW_DELAY);
  }

  refresh(): void {
    if (this.current.startsWith(PROGRAM_PREFIX) || this.current === ROOT_ID) this.render();
  }

  private followCursor(): void {
    const { word, group } = this.hooks.cursorWord();
    if (word === '') return;
    const id = referenceIdFor(word, group) ?? (this.programNames().includes(word) ? PROGRAM_PREFIX + word : null);
    if (id !== null && id !== this.current) this.open(id);
  }

  private back(): void {
    const previous = this.history.pop();
    if (previous !== undefined) this.open(previous, false);
  }

  private save(): void {
    this.hooks.changed({ open: !this.container.hidden, follow: this.follow });
  }

  private renderFollow(): void {
    this.followButton.classList.toggle(CLASS.active, this.follow);
  }

  private programNames(): string[] {
    const { text } = this.hooks.source();
    return symbols(text).filter((entry) => entry.kind !== EVENT_SYMBOL).map((entry) => entry.name);
  }

  private render(): void {
    this.backButton.disabled = this.history.length === 0;
    this.body.replaceChildren();
    this.body.scrollTop = 0;
    if (this.search.value.trim() !== '') {
      this.renderCrumbs([{ id: ROOT_ID, title: TEXT.reference.results }]);
      const found = searchReference(this.search.value);
      if (found.length === 0) this.body.append(create(TAG.p, CLASS.muted, TEXT.reference.nothing));
      this.body.append(this.list(found.map((entry) => ({
        name: entry.title, detail: TEXT.reference.kindLabel(entry.kind), summary: entry.summary, link: entry.id, insert: entry.insert, color: entry.color,
      }))));
      return;
    }
    if (this.current.startsWith(PROGRAM_PREFIX)) {
      this.renderProgram(this.current.slice(PROGRAM_PREFIX.length));
      return;
    }
    const entry = referenceEntry(this.current) ?? referenceEntry(ROOT_ID);
    if (entry === null) return;
    this.renderCrumbs(breadcrumbs(entry.id).map((item) => ({ id: item.id, title: item.title })));
    this.renderHead(entry);
    if (entry.id === ROOT_ID) this.renderProgramRoot();
    for (const section of entry.sections) {
      if (section.title !== '') this.body.append(create(TAG.h3, '', section.title));
      this.body.append(this.list(section.fields));
    }
  }

  private renderCrumbs(trail: { id: string; title: string }[]): void {
    this.crumbs.replaceChildren(...trail.flatMap((item, index) => {
      const link = create(TAG.button, PANEL.crumb, item.title);
      link.addEventListener(EVENT.click, () => this.open(item.id));
      return index === 0 ? [link] : [create(TAG.span, CLASS.muted, TEXT.reference.separator), link];
    }));
  }

  private renderHead(entry: ReferenceEntry): void {
    const title = create(TAG.h2, '', entry.title);
    if (entry.color !== null) title.style.setProperty(PANEL.colorVariable, entry.color);
    if (entry.color !== null) title.classList.add(PANEL.colored);
    this.body.append(title);
    if (entry.signature !== null) this.body.append(create(TAG.code, PANEL.signature, entry.signature));
    if (entry.summary !== '') {
      const summary = create(TAG.p, PANEL.summary);
      summary.innerHTML = renderMarkdown(entry.summary);
      this.body.append(summary);
    }
    if (entry.insert !== null) {
      const insert = create(TAG.button, PANEL.insert, TEXT.reference.insert);
      insert.title = entry.insert;
      insert.addEventListener(EVENT.click, () => this.hooks.insert(entry.insert ?? ''));
      this.body.append(insert);
    }
  }

  private list(fields: readonly ReferenceField[]): HTMLElement {
    const list = create(TAG.ul, PANEL.list);
    for (const field of fields) {
      const item = create(TAG.li, field.link === null ? '' : PANEL.linked);
      if (field.color !== null) {
        const dot = create(TAG.span, PANEL.dot);
        dot.style.background = field.color;
        item.append(dot);
      }
      const text = create(TAG.div, PANEL.text);
      const line = create(TAG.div, PANEL.line);
      line.append(create(TAG.span, PANEL.name, field.name));
      if (field.detail !== '') line.append(create(TAG.span, PANEL.detail, field.detail));
      text.append(line);
      if (field.summary !== '') text.append(create(TAG.div, PANEL.fieldSummary, field.summary));
      item.append(text);
      if (field.insert !== null) {
        const insert = create(TAG.button, PANEL.add, TEXT.reference.add);
        insert.title = TEXT.reference.insertTitle(field.insert);
        insert.addEventListener(EVENT.click, (event) => {
          event.stopPropagation();
          this.hooks.insert(field.insert ?? '');
        });
        item.append(insert);
      }
      if (field.link !== null) item.addEventListener(EVENT.click, () => this.open(field.link ?? ROOT_ID));
      list.append(item);
    }
    return list;
  }

  private renderProgramRoot(): void {
    const { text } = this.hooks.source();
    const names = symbols(text).filter((entry) => entry.kind !== EVENT_SYMBOL);
    this.body.append(create(TAG.h3, '', TEXT.reference.program));
    if (names.length === 0) {
      this.body.append(create(TAG.p, CLASS.muted, TEXT.reference.noNames));
      return;
    }
    this.body.append(this.list(names.map((entry) => ({
      name: entry.name, detail: entry.kind, summary: TEXT.reference.declaredAt(entry.line + 1), link: PROGRAM_PREFIX + entry.name, insert: null, color: null,
    }))));
  }

  private renderProgram(name: string): void {
    const { file, text, read } = this.hooks.source();
    this.renderCrumbs([{ id: ROOT_ID, title: TEXT.reference.rootTitle }, { id: this.current, title: name }]);
    const declared = symbols(text).find((entry) => entry.name === name);
    this.body.append(create(TAG.h2, '', name));
    if (!declared) {
      this.body.append(create(TAG.p, CLASS.muted, TEXT.reference.notDeclared));
      return;
    }
    this.body.append(create(TAG.p, PANEL.summary, TEXT.reference.programSummary(declared.kind, declared.line + 1)));
    const found = references(text, { line: declared.line, column: declared.column }, file, read);
    this.body.append(create(TAG.h3, '', TEXT.reference.usedAt(found.length)));
    const list = create(TAG.ul, PANEL.list);
    for (const location of found) {
      const source = location.file === file ? text : read(location.file) ?? '';
      const item = create(TAG.li, PANEL.linked);
      const body = create(TAG.div, PANEL.text);
      const line = create(TAG.div, PANEL.line);
      line.append(create(TAG.span, PANEL.name, TEXT.reference.location(location.file === file ? '' : location.file, location.line + 1)));
      body.append(line, create(TAG.code, PANEL.fieldSummary, source.split(TEXT.separator)[location.line]?.trim() ?? ''));
      item.append(body);
      item.addEventListener(EVENT.click, () => this.hooks.jump(location));
      list.append(item);
    }
    this.body.append(list);
  }
}
