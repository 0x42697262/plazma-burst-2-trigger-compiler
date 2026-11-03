import { createDockview, themeDark, themeLight } from 'dockview-core';
import type {
  DockviewApi, DockviewGroupPanel, DockviewIDisposable as IDisposable, GroupPanelPartInitParameters, IContentRenderer, IGroupHeaderProps, IHeaderActionsRenderer, IWatermarkRenderer, SerializedDockview,
} from 'dockview-core';
import { CLASS, DOCK, EVENT, TAG } from './keys.ts';
import { DOCK_SIZE } from './constants.ts';
import { TEXT } from './text.ts';

export type FixedPanel = (typeof DOCK.panel)[keyof typeof DOCK.panel];
export type DockHooks = {
  createFile: (file: string, element: HTMLElement) => IDisposable;
  fixed: Readonly<Record<FixedPanel, HTMLElement>>;
  activeFile: (file: string) => void;
  changed: (layout: SerializedDockview) => void;
  newFile: () => void;
  titleOf: (file: string) => string;
};

type FileParameters = { file: string };

const fileId = (file: string): string => DOCK.filePrefix + file;
const fileOf = (id: string): string | null => (id.startsWith(DOCK.filePrefix) ? id.slice(DOCK.filePrefix.length) : null);
const isFixed = (id: string): id is FixedPanel => (Object.values(DOCK.panel) as string[]).includes(id);

export class Dock {
  readonly api: DockviewApi;
  private readonly hooks: DockHooks;

  constructor(element: HTMLElement, hooks: DockHooks, dark: boolean) {
    this.hooks = hooks;
    this.api = createDockview(element, {
      theme: dark ? themeDark : themeLight,
      floatingGroupDragHandle: DOCK.dragHandle,
      createComponent: (options) => (options.name === DOCK.fileComponent ? this.fileRenderer() : this.fixedRenderer(options.id)),
      createRightHeaderActionComponent: (group) => this.headerActions(group),
      createWatermarkComponent: () => this.watermark(),
    });
    this.api.onDidActivePanelChange((event) => {
      const file = event.panel ? fileOf(event.panel.id) : null;
      if (file !== null) hooks.activeFile(file);
    });
    this.api.onDidLayoutChange(() => hooks.changed(this.api.toJSON()));
  }

  restore(saved: SerializedDockview | null, files: readonly string[], active: string, referenceOpen: boolean): void {
    if (saved !== null) {
      const known = new Set(files);
      const panels = Object.values(saved.panels ?? {});
      const valid = panels.length > 0 && panels.every((panel) => {
        const file = fileOf(panel.id);
        return file === null ? isFixed(panel.id) : known.has(file);
      });
      if (valid) {
        try {
          this.api.fromJSON(saved);
          if (this.hasFile()) return;
        } catch {
          this.api.clear();
        }
      }
    }
    this.defaultLayout(files, active, referenceOpen);
  }

  setDark(dark: boolean): void {
    this.api.updateOptions({ theme: dark ? themeDark : themeLight });
  }

  openFile(file: string): void {
    const existing = this.api.getPanel(fileId(file));
    if (existing) {
      existing.api.setActive();
      return;
    }
    const sibling = this.api.panels.find((panel) => fileOf(panel.id) !== null && panel.group === this.api.activeGroup)
      ?? this.api.panels.find((panel) => fileOf(panel.id) !== null);
    const output = this.api.getPanel(DOCK.panel.output);
    const position = sibling ? { referenceGroup: sibling.group } : output ? { referencePanel: output, direction: DOCK.direction.above } : undefined;
    this.api.addPanel<FileParameters>({ id: fileId(file), component: DOCK.fileComponent, title: this.hooks.titleOf(file), params: { file }, ...(position ? { position } : {}) });
  }

  closeFile(file: string): void {
    this.api.getPanel(fileId(file))?.api.close();
  }

  openFiles(): string[] {
    return this.api.panels.flatMap((panel) => {
      const file = fileOf(panel.id);
      return file === null ? [] : [file];
    });
  }

  isOpen(panel: FixedPanel): boolean {
    return this.api.getPanel(panel) !== undefined;
  }

  show(panel: FixedPanel, open: boolean): void {
    const existing = this.api.getPanel(panel);
    if (!open) {
      existing?.api.close();
      return;
    }
    if (existing) {
      existing.api.setActive();
      return;
    }
    if (panel === DOCK.panel.settings) {
      const width = DOCK_SIZE.settingsWidth;
      this.api.addPanel({ id: panel, component: panel, title: TEXT.dock.settings, floating: { width, height: Math.min(DOCK_SIZE.settingsHeight, this.api.height - DOCK_SIZE.margin), x: Math.max(0, this.api.width - width - DOCK_SIZE.margin), y: DOCK_SIZE.margin } });
      return;
    }
    if (panel === DOCK.panel.reference) {
      this.api.addPanel({ id: panel, component: panel, title: TEXT.dock.reference, position: { direction: DOCK.direction.right }, initialWidth: DOCK_SIZE.referenceWidth });
      return;
    }
    const sibling = this.api.panels.find((item) => fileOf(item.id) !== null);
    this.api.addPanel({
      id: panel, component: panel, title: TEXT.dock.output, initialHeight: Math.round(this.api.height * DOCK_SIZE.outputShare),
      ...(sibling ? { position: { referencePanel: sibling, direction: DOCK.direction.below } } : {}),
    });
  }

  private hasFile(): boolean {
    return this.api.panels.some((panel) => fileOf(panel.id) !== null);
  }

  private defaultLayout(files: readonly string[], active: string, referenceOpen: boolean): void {
    this.api.clear();
    for (const file of files) this.openFile(file);
    this.show(DOCK.panel.output, true);
    if (referenceOpen) this.show(DOCK.panel.reference, true);
    this.api.getPanel(fileId(active))?.api.setActive();
  }

  private fileRenderer(): IContentRenderer {
    const element = document.createElement(TAG.div);
    element.className = CLASS.panelFill;
    let editor: IDisposable | null = null;
    return {
      element,
      init: (parameters: GroupPanelPartInitParameters) => {
        const { file } = parameters.params as FileParameters;
        editor = this.hooks.createFile(file, element);
      },
      dispose: () => editor?.dispose(),
    };
  }

  private fixedRenderer(id: string): IContentRenderer {
    const element = document.createElement(TAG.div);
    element.className = CLASS.panelFill;
    return {
      element,
      init: () => {
        if (isFixed(id)) element.append(this.hooks.fixed[id]);
      },
    };
  }

  private headerActions(group: DockviewGroupPanel): IHeaderActionsRenderer {
    const element = document.createElement(TAG.div);
    element.className = CLASS.groupActions;
    const add = document.createElement(TAG.button);
    add.textContent = TEXT.addFile;
    add.title = TEXT.commands.newFile;
    add.addEventListener(EVENT.click, () => {
      group.api.setActive();
      this.hooks.newFile();
    });
    element.append(add);
    const subscriptions: IDisposable[] = [];
    const update = (): void => {
      add.hidden = !group.panels.some((panel) => fileOf(panel.id) !== null);
    };
    return {
      element,
      init: (props: IGroupHeaderProps) => {
        subscriptions.push(props.containerApi.onDidAddPanel(update), props.containerApi.onDidRemovePanel(update), props.containerApi.onDidMovePanel(update));
        update();
      },
      dispose: () => {
        for (const subscription of subscriptions) subscription.dispose();
      },
    };
  }

  private watermark(): IWatermarkRenderer {
    const element = document.createElement(TAG.div);
    element.className = CLASS.watermark;
    element.textContent = TEXT.dock.empty;
    return { element, init: () => undefined };
  }
}
