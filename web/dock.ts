import { createDockview, themeDark, themeLight } from 'dockview-core';
import type {
  DockviewApi, DockviewGroupPanel, DockviewIDisposable as IDisposable, GroupPanelPartInitParameters, IContentRenderer, IGroupHeaderProps, IHeaderActionsRenderer, IWatermarkRenderer, SerializedDockview,
} from 'dockview-core';
import { CLASS, DOCK, EVENT, TAG } from './keys.ts';
import { DOCK_SIZE } from './constants.ts';
import { TEXT } from './text.ts';

export type FixedPanel = (typeof DOCK.panel)[keyof typeof DOCK.panel];
export type Corner = (typeof DOCK.corners)[number];
export type WindowBox = { x: number; y: number; width: number; height: number };
export type WindowState = { mini: boolean; corner: Corner; expanded: WindowBox | null };
export type DockHooks = {
  createFile: (file: string, element: HTMLElement) => IDisposable;
  fixed: Readonly<Record<FixedPanel, HTMLElement>>;
  activeFile: (file: string) => void;
  changed: (layout: SerializedDockview) => void;
  newFile: () => void;
  titleOf: (file: string) => string;
  mounted: (panel: FixedPanel) => void;
  miniChanged: (panel: FixedPanel, mini: boolean) => void;
  windowsChanged: (windows: Partial<Record<FixedPanel, WindowState>>) => void;
};

type FileParameters = { file: string };

const fileId = (file: string): string => DOCK.filePrefix + file;
const fileOf = (id: string): string | null => (id.startsWith(DOCK.filePrefix) ? id.slice(DOCK.filePrefix.length) : null);
const isFixed = (id: string): id is FixedPanel => (Object.values(DOCK.panel) as string[]).includes(id);
const isTool = (id: string): id is FixedPanel => (DOCK.tools as readonly string[]).includes(id);

export class Dock {
  readonly api: DockviewApi;
  private readonly hooks: DockHooks;
  private readonly root: HTMLElement;
  private readonly windows: Partial<Record<FixedPanel, WindowState>> = {};
  private snapTimer = 0;
  private applying = false;
  private readonly refreshers = new Set<() => void>();

  constructor(element: HTMLElement, hooks: DockHooks, dark: boolean) {
    this.hooks = hooks;
    this.root = element;
    this.api = createDockview(element, {
      theme: dark ? themeDark : themeLight,
      floatingGroupDragHandle: DOCK.dragHandle,
      disableTabsOverflowList: true,
      createComponent: (options) => (options.name === DOCK.fileComponent ? this.fileRenderer() : this.fixedRenderer(options.id)),
      createRightHeaderActionComponent: (group) => this.headerActions(group),
      createWatermarkComponent: () => this.watermark(),
    });
    this.api.onDidActivePanelChange((event) => {
      const file = event.panel ? fileOf(event.panel.id) : null;
      if (file !== null) hooks.activeFile(file);
    });
    this.api.onDidLayoutChange(() => {
      hooks.changed(this.api.toJSON());
      this.scheduleSnap();
    });
  }

  restoreWindows(saved: Partial<Record<FixedPanel, WindowState>>): void {
    for (const panel of DOCK.tools) {
      const state = saved[panel];
      if (!state) continue;
      this.windows[panel] = state;
      if (state.mini && this.isFloating(panel)) this.hooks.miniChanged(panel, true);
      else if (state.mini) this.windows[panel] = { ...state, mini: false };
    }
  }

  isMini(panel: FixedPanel): boolean {
    return this.windows[panel]?.mini === true && this.isFloating(panel);
  }

  minimize(panel: FixedPanel): void {
    const item = this.api.getPanel(panel);
    if (!item) return;
    const current = this.windows[panel];
    const expanded = this.isFloating(panel) ? this.boxOf(panel) : current?.expanded ?? null;
    const corner = current?.corner ?? DOCK.defaultCorner;
    this.setWindow(panel, { mini: true, corner, expanded });
    this.float(panel, this.cornerBox(panel, corner));
    this.hooks.miniChanged(panel, true);
  }

  expand(panel: FixedPanel): void {
    if (!this.api.getPanel(panel)) return;
    const state = this.windows[panel];
    this.setWindow(panel, { mini: false, corner: state?.corner ?? DOCK.defaultCorner, expanded: state?.expanded ?? null });
    this.float(panel, state?.expanded ?? this.defaultBox(panel));
    this.hooks.miniChanged(panel, false);
  }

  dockPanel(panel: FixedPanel): void {
    const item = this.api.getPanel(panel);
    if (!item) return;
    const wasMini = this.isMini(panel);
    const state = this.windows[panel];
    if (state) this.setWindow(panel, { ...state, mini: false });
    const anchor = this.api.panels.find((other) => fileOf(other.id) !== null) ?? this.api.panels.find((other) => other.id !== panel && other.group.api.location.type === DOCK.gridLocation);
    if (anchor) item.api.moveTo({ group: anchor.group, position: panel === DOCK.panel.output ? DOCK.direction.bottom : DOCK.direction.right });
    if (wasMini) this.hooks.miniChanged(panel, false);
  }

  popOut(panel: FixedPanel): void {
    const item = this.api.getPanel(panel);
    if (!item) return;
    if (this.isMini(panel)) {
      this.setWindow(panel, { ...(this.windows[panel] as WindowState), mini: false });
      this.hooks.miniChanged(panel, false);
    }
    void this.api.addPopoutGroup(item);
  }

  private setWindow(panel: FixedPanel, state: WindowState): void {
    this.windows[panel] = state;
    this.hooks.windowsChanged({ ...this.windows });
    for (const refresh of this.refreshers) refresh();
  }

  private isFloating(panel: FixedPanel): boolean {
    return this.api.getPanel(panel)?.group.api.location.type === DOCK.floatingLocation;
  }

  private float(panel: FixedPanel, box: WindowBox): void {
    const item = this.api.getPanel(panel);
    if (!item) return;
    this.applying = true;
    try {
      this.api.addFloatingGroup(item, { x: box.x, y: box.y, width: box.width, height: box.height });
      this.relayoutFloating(panel, box.width);
    } finally {
      this.applying = false;
    }
  }

  private relayoutFloating(panel: FixedPanel, width: number): void {
    const group = this.api.getPanel(panel)?.group;
    const component: unknown = Reflect.get(this.api, DOCK.componentField);
    const finder: unknown = typeof component === 'object' && component !== null ? Reflect.get(component, DOCK.floatingFinder) : null;
    if (!group || typeof finder !== 'function') return;
    const floating: unknown = Reflect.apply(finder, component, [group]);
    const gridview: unknown = typeof floating === 'object' && floating !== null ? Reflect.get(floating, DOCK.gridviewField) : null;
    if (typeof gridview !== 'object' || gridview === null) return;
    const layout: unknown = Reflect.get(gridview, DOCK.layoutMethod);
    const height: unknown = Reflect.get(gridview, DOCK.heightField);
    if (typeof layout === 'function' && typeof height === 'number') Reflect.apply(layout, gridview, [width, height]);
  }

  private boxOf(panel: FixedPanel): WindowBox | null {
    const group = this.api.getPanel(panel)?.group;
    if (!group) return null;
    const outer = this.root.getBoundingClientRect();
    const inner = group.element.getBoundingClientRect();
    return { x: Math.round(inner.left - outer.left), y: Math.round(inner.top - outer.top), width: Math.round(inner.width), height: Math.round(inner.height) };
  }

  private miniSize(panel: FixedPanel): { width: number; height: number } {
    return panel === DOCK.panel.blueprint ? { width: DOCK_SIZE.miniMapWidth, height: DOCK_SIZE.miniMapHeight } : { width: DOCK_SIZE.miniWidth, height: DOCK_SIZE.miniHeight };
  }

  private cornerBox(panel: FixedPanel, corner: Corner): WindowBox {
    const { width, height } = this.miniSize(panel);
    const right = corner === DOCK.corners[1] || corner === DOCK.corners[DOCK_SIZE.lastCorner];
    const bottom = corner === DOCK.corners[DOCK_SIZE.sides] || corner === DOCK.corners[DOCK_SIZE.lastCorner];
    const below = DOCK.tools.slice(0, (DOCK.tools as readonly string[]).indexOf(panel)).filter((other) => other !== panel && this.windows[other]?.mini === true && this.windows[other]?.corner === corner && this.isFloating(other));
    const offset = below.reduce((total, other) => total + this.miniSize(other).height + DOCK_SIZE.margin, 0);
    return {
      x: right ? this.api.width - width - DOCK_SIZE.margin : DOCK_SIZE.margin,
      y: bottom ? this.api.height - height - DOCK_SIZE.margin - offset : DOCK_SIZE.margin + offset, width, height,
    };
  }

  private nearestCorner(box: WindowBox): Corner {
    const right = box.x + box.width * DOCK_SIZE.half > this.api.width * DOCK_SIZE.half;
    const bottom = box.y + box.height * DOCK_SIZE.half > this.api.height * DOCK_SIZE.half;
    return DOCK.corners[(right ? 1 : 0) + (bottom ? DOCK_SIZE.sides : 0)] ?? DOCK.defaultCorner;
  }

  private scheduleSnap(): void {
    if (this.applying) return;
    window.clearTimeout(this.snapTimer);
    this.snapTimer = window.setTimeout(() => this.snapMinis(), DOCK_SIZE.snapDelay);
  }

  private snapMinis(): void {
    for (const panel of DOCK.tools) {
      const state = this.windows[panel];
      if (!state?.mini) continue;
      if (!this.isFloating(panel)) {
        this.setWindow(panel, { ...state, mini: false });
        this.hooks.miniChanged(panel, false);
        continue;
      }
      const box = this.boxOf(panel);
      if (box === null) continue;
      const size = this.miniSize(panel);
      if (box.width > size.width + DOCK_SIZE.grownBy || box.height > size.height + DOCK_SIZE.grownBy) {
        this.setWindow(panel, { ...state, mini: false, expanded: box });
        this.hooks.miniChanged(panel, false);
        continue;
      }
      const corner = this.nearestCorner(box);
      const target = this.cornerBox(panel, corner);
      if (Math.abs(target.x - box.x) <= DOCK_SIZE.snapTolerance && Math.abs(target.y - box.y) <= DOCK_SIZE.snapTolerance) continue;
      this.setWindow(panel, { ...state, corner });
      this.float(panel, target);
    }
  }

  private defaultBox(panel: FixedPanel): WindowBox {
    const width = Math.min(panel === DOCK.panel.blueprint ? DOCK_SIZE.blueprintWidth : DOCK_SIZE.settingsWidth, this.api.width - DOCK_SIZE.margin * DOCK_SIZE.sides);
    const height = Math.min(panel === DOCK.panel.blueprint ? DOCK_SIZE.blueprintHeight : DOCK_SIZE.settingsHeight, this.api.height - DOCK_SIZE.margin * DOCK_SIZE.sides);
    return { x: this.api.width - width - DOCK_SIZE.margin, y: panel === DOCK.panel.blueprint ? this.api.height - height - DOCK_SIZE.margin : DOCK_SIZE.margin, width, height };
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
      this.relayoutFloating(panel, width);
      return;
    }
    if (panel === DOCK.panel.blueprint) {
      const corner = this.windows[panel]?.corner ?? DOCK.defaultCorner;
      const box = this.cornerBox(panel, corner);
      this.setWindow(panel, { mini: true, corner, expanded: this.windows[panel]?.expanded ?? this.defaultBox(panel) });
      this.api.addPanel({ id: panel, component: panel, title: TEXT.dock.blueprint, floating: { width: box.width, height: box.height, x: box.x, y: box.y } });
      this.relayoutFloating(panel, box.width);
      this.hooks.miniChanged(panel, true);
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
        if (!isFixed(id)) return;
        element.append(this.hooks.fixed[id]);
        this.hooks.mounted(id);
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
    const control = (label: string, title: string, run: (panel: FixedPanel) => void): HTMLButtonElement => {
      const button = document.createElement(TAG.button);
      button.textContent = label;
      button.title = title;
      button.addEventListener(EVENT.click, (event) => {
        event.stopPropagation();
        const tool = this.toolOf(group);
        if (tool !== null) run(tool);
      });
      return button;
    };
    const minimize = control(TEXT.window.minimize, TEXT.window.minimizeTitle, (panel) => this.minimize(panel));
    const expand = control(TEXT.window.expand, TEXT.window.expandTitle, (panel) => this.expand(panel));
    const dock = control(TEXT.window.dock, TEXT.window.dockTitle, (panel) => this.dockPanel(panel));
    const popOut = control(TEXT.window.popOut, TEXT.window.popOutTitle, (panel) => this.popOut(panel));
    element.append(add, minimize, expand, dock, popOut);
    const subscriptions: IDisposable[] = [];
    const update = (): void => {
      add.hidden = !group.panels.some((panel) => fileOf(panel.id) !== null);
      const tool = this.toolOf(group);
      const location = group.api.location.type;
      const mini = tool !== null && this.isMini(tool);
      minimize.hidden = tool === null || mini || location === DOCK.popoutLocation;
      expand.hidden = !mini;
      dock.hidden = tool === null || location !== DOCK.floatingLocation;
      popOut.hidden = tool === null || location === DOCK.popoutLocation;
    };
    this.refreshers.add(update);
    return {
      element,
      init: (props: IGroupHeaderProps) => {
        subscriptions.push(
          props.containerApi.onDidAddPanel(update), props.containerApi.onDidRemovePanel(update), props.containerApi.onDidMovePanel(update),
          props.api.onDidLocationChange(() => {
            update();
            const tool = this.toolOf(group);
            if (tool !== null) this.hooks.mounted(tool);
          }),
          props.api.onDidActivePanelChange(update),
        );
        update();
      },
      dispose: () => {
        this.refreshers.delete(update);
        for (const subscription of subscriptions) subscription.dispose();
      },
    };
  }

  private toolOf(group: DockviewGroupPanel): FixedPanel | null {
    const id = group.activePanel?.id ?? group.panels[0]?.id ?? '';
    return isTool(id) ? id : null;
  }

  private watermark(): IWatermarkRenderer {
    const element = document.createElement(TAG.div);
    element.className = CLASS.watermark;
    element.textContent = TEXT.dock.empty;
    return { element, init: () => undefined };
  }
}
