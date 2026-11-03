import { fit, hitTest, isMoved, itemsAtLine, snap, toScreen, toWorld, valuesText, withGeometry, zoomAt } from './blueprint-model.ts';
import type { Box, Camera, Geometry, Point, Scene, SceneItem } from './blueprint-model.ts';
import { BLUEPRINT_VIEW, CLASS, EVENT, TAG } from './keys.ts';
import { BLUEPRINT_DRAW } from './constants.ts';
import { TEXT } from './text.ts';

export type BlueprintHooks = {
  jump: (file: string | null, line: number) => void;
  insert: (text: string) => void;
  copy: (text: string) => void;
  expand: () => void;
};

type Handle = (typeof BLUEPRINT_VIEW.handles)[number];
type Drag =
  | { kind: 'pan'; start: Point; camera: Camera }
  | { kind: 'move'; id: string; start: Point; origin: Geometry; moved: boolean }
  | { kind: 'resize'; id: string; handle: Handle; start: Point; origin: Geometry }
  | { kind: 'area'; start: Point; end: Point };

const create = <Name extends keyof HTMLElementTagNameMap>(document: Document, tag: Name, className = '', text = ''): HTMLElementTagNameMap[Name] => {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  if (text !== '') node.textContent = text;
  return node;
};

export class BlueprintView {
  readonly element: HTMLElement;
  private readonly hooks: BlueprintHooks;
  private readonly canvas: HTMLCanvasElement;
  private readonly coordinates: HTMLSpanElement;
  private readonly movedBadge: HTMLButtonElement;
  private readonly card: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private items: SceneItem[] = [];
  private bounds: Box | null = null;
  private camera: Camera = { x: 0, y: 0, scale: 1 };
  private fitted = false;
  private selected: string | null = null;
  private hovered: string | null = null;
  private highlighted = new Set<string>();
  private drag: Drag | null = null;
  private mini = false;
  private observer: ResizeObserver | null = null;
  private frame = 0;

  constructor(element: HTMLElement, hooks: BlueprintHooks) {
    this.element = element;
    this.hooks = hooks;
    const document = element.ownerDocument;
    const bar = create(document, TAG.div, BLUEPRINT_VIEW.bar);
    const fitButton = create(document, TAG.button, CLASS.quiet, TEXT.blueprintView.fit);
    fitButton.title = TEXT.blueprintView.fitTitle;
    fitButton.addEventListener(EVENT.click, () => this.fitView());
    this.coordinates = create(document, TAG.span, BLUEPRINT_VIEW.coordinates);
    this.movedBadge = create(document, TAG.button, BLUEPRINT_VIEW.moved);
    this.movedBadge.title = TEXT.blueprintView.resetTitle;
    this.movedBadge.addEventListener(EVENT.click, () => this.resetMoves());
    bar.append(fitButton, this.coordinates, create(document, TAG.span, BLUEPRINT_VIEW.spacer), this.movedBadge);
    this.canvas = create(document, TAG.canvas, BLUEPRINT_VIEW.canvas);
    this.canvas.tabIndex = 0;
    this.card = create(document, TAG.div, BLUEPRINT_VIEW.card);
    this.tip = create(document, TAG.div, BLUEPRINT_VIEW.tip);
    const stage = create(document, TAG.div, BLUEPRINT_VIEW.stage);
    stage.append(this.canvas, this.card, this.tip);
    element.append(bar, stage);
    this.listen();
    this.renderChrome();
  }

  attach(): void {
    const view = this.element.ownerDocument.defaultView;
    this.observer?.disconnect();
    if (!view) return;
    this.observer = new view.ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas);
    this.resize();
  }

  setScene(scene: Scene): void {
    this.items = scene.items;
    this.bounds = scene.bounds;
    if (this.selected !== null && !this.items.some((item) => item.id === this.selected)) this.selected = null;
    if (!this.fitted || this.mini) this.fitView();
    this.renderChrome();
    this.request();
  }

  setMini(mini: boolean): void {
    this.mini = mini;
    this.element.classList.toggle(BLUEPRINT_VIEW.miniClass, mini);
    this.resize();
    if (mini) this.fitView();
    this.renderChrome();
  }

  highlightLine(file: string, line: number, mainFile: string): void {
    const next = new Set(itemsAtLine(this.items, file, line, mainFile).map((item) => item.id));
    if (next.size === this.highlighted.size && [...next].every((id) => this.highlighted.has(id))) return;
    this.highlighted = next;
    this.request();
  }

  private get movedCount(): number {
    return this.items.filter(isMoved).length;
  }

  private item(id: string | null): SceneItem | null {
    return id === null ? null : this.items.find((item) => item.id === id) ?? null;
  }

  private fitView(): void {
    const { width, height } = this.size();
    this.camera = fit(this.bounds, width, height);
    this.fitted = this.bounds !== null;
    this.request();
  }

  private resetMoves(): void {
    this.items = this.items.map((item) => (isMoved(item) ? withGeometry(item, item.source) : item));
    this.renderChrome();
    this.request();
  }

  private size(): { width: number; height: number } {
    return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
  }

  private resize(): void {
    const ratio = this.element.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    const { width, height } = this.size();
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    if (!this.fitted || this.mini) this.fitView();
    this.request();
  }

  private request(): void {
    const view = this.element.ownerDocument.defaultView;
    if (!view || this.frame !== 0) return;
    this.frame = view.requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private pointOf(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private handleAt(screen: Point): { item: SceneItem; handle: Handle } | null {
    const item = this.item(this.selected);
    if (!item?.rect || this.mini) return null;
    for (const handle of BLUEPRINT_VIEW.handles) {
      const spot = this.handleSpot(item.box, handle);
      if (Math.abs(spot.x - screen.x) <= BLUEPRINT_DRAW.handleHit && Math.abs(spot.y - screen.y) <= BLUEPRINT_DRAW.handleHit) return { item, handle };
    }
    return null;
  }

  private handleSpot(box: Box, handle: Handle): Point {
    const topLeft = toScreen(this.camera, { x: box.x, y: box.y });
    const bottomRight = toScreen(this.camera, { x: box.x + box.w, y: box.y + box.h });
    const middle = { x: (topLeft.x + bottomRight.x) * BLUEPRINT_DRAW.half, y: (topLeft.y + bottomRight.y) * BLUEPRINT_DRAW.half };
    return {
      x: handle.includes(BLUEPRINT_VIEW.west) ? topLeft.x : handle.includes(BLUEPRINT_VIEW.east) ? bottomRight.x : middle.x,
      y: handle.includes(BLUEPRINT_VIEW.north) ? topLeft.y : handle.includes(BLUEPRINT_VIEW.south) ? bottomRight.y : middle.y,
    };
  }

  private update(id: string, geometry: Geometry): void {
    this.items = this.items.map((item) => (item.id === id ? withGeometry(item, geometry) : item));
  }

  private listen(): void {
    const canvas = this.canvas;
    canvas.addEventListener(EVENT.wheel, (event) => {
      event.preventDefault();
      this.camera = zoomAt(this.camera, this.pointOf(event), Math.exp(-event.deltaY * BLUEPRINT_DRAW.wheelZoom));
      this.request();
    }, { passive: false });
    canvas.addEventListener(EVENT.pointerDown, (event) => {
      if (this.mini) {
        this.hooks.expand();
        return;
      }
      canvas.focus();
      canvas.setPointerCapture(event.pointerId);
      const screen = this.pointOf(event);
      const world = toWorld(this.camera, screen);
      const handle = this.handleAt(screen);
      if (handle) {
        this.drag = { kind: 'resize', id: handle.item.id, handle: handle.handle, start: world, origin: handle.item.geometry };
        return;
      }
      if (event.shiftKey) {
        this.drag = { kind: 'area', start: world, end: world };
        return;
      }
      const hit = event.button === BLUEPRINT_DRAW.middleButton ? null : hitTest(this.items, world);
      if (hit) {
        this.select(hit);
        this.drag = { kind: 'move', id: hit.id, start: world, origin: hit.geometry, moved: false };
        return;
      }
      this.drag = { kind: 'pan', start: screen, camera: this.camera };
    });
    canvas.addEventListener(EVENT.pointerMove, (event) => {
      const screen = this.pointOf(event);
      const world = toWorld(this.camera, screen);
      this.showCoordinates(world, event.altKey);
      const drag = this.drag;
      if (drag === null) {
        this.hover(this.mini ? null : hitTest(this.items, world), screen);
        return;
      }
      const free = event.altKey;
      if (drag.kind === 'pan') {
        this.camera = { ...drag.camera, x: drag.camera.x - (screen.x - drag.start.x) / drag.camera.scale, y: drag.camera.y - (screen.y - drag.start.y) / drag.camera.scale };
      } else if (drag.kind === 'move') {
        const travel = Math.hypot(world.x - drag.start.x, world.y - drag.start.y) * this.camera.scale;
        if (!drag.moved && travel < BLUEPRINT_DRAW.dragThreshold) return;
        drag.moved = true;
        this.update(drag.id, { ...drag.origin, x: snap(drag.origin.x + world.x - drag.start.x, free), y: snap(drag.origin.y + world.y - drag.start.y, free) });
      } else if (drag.kind === 'resize') {
        this.update(drag.id, this.resized(drag.origin, drag.handle, world.x - drag.start.x, world.y - drag.start.y, free));
      } else {
        drag.end = world;
      }
      this.renderChrome();
      this.request();
    });
    canvas.addEventListener(EVENT.pointerUp, (event) => {
      canvas.releasePointerCapture(event.pointerId);
      const drag = this.drag;
      this.drag = null;
      if (drag?.kind === 'area') {
        const left = snap(Math.min(drag.start.x, drag.end.x), event.altKey);
        const top = snap(Math.min(drag.start.y, drag.end.y), event.altKey);
        const width = snap(Math.abs(drag.end.x - drag.start.x), event.altKey);
        const height = snap(Math.abs(drag.end.y - drag.start.y), event.altKey);
        if (width > 0 && height > 0) this.hooks.insert(valuesText({ x: left, y: top, w: width, h: height }));
      }
      const screen = this.pointOf(event);
      if (drag?.kind === 'pan' && Math.hypot(screen.x - drag.start.x, screen.y - drag.start.y) < BLUEPRINT_DRAW.dragThreshold) this.selected = null;
      this.renderChrome();
      this.request();
    });
    canvas.addEventListener(EVENT.doubleClick, (event) => {
      if (this.mini) return;
      const world = toWorld(this.camera, this.pointOf(event));
      if (hitTest(this.items, world) !== null) return;
      this.hooks.insert(valuesText({ x: snap(world.x, event.altKey), y: snap(world.y, event.altKey), w: null, h: null }));
    });
    canvas.addEventListener(EVENT.pointerLeave, () => {
      this.hover(null, { x: 0, y: 0 });
      this.coordinates.textContent = '';
    });
    canvas.addEventListener(EVENT.keydown, (event) => {
      const item = this.item(this.selected);
      if (event.key === BLUEPRINT_VIEW.fitKey) this.fitView();
      else if (event.key === BLUEPRINT_VIEW.escapeKey) this.selected = null;
      else if (item && Object.hasOwn(BLUEPRINT_VIEW.nudge, event.key)) {
        event.preventDefault();
        const [stepX, stepY] = BLUEPRINT_VIEW.nudge[event.key as keyof typeof BLUEPRINT_VIEW.nudge];
        const step = event.shiftKey ? 1 : BLUEPRINT_DRAW.grid;
        this.update(item.id, { ...item.geometry, x: item.geometry.x + stepX * step, y: item.geometry.y + stepY * step });
      } else return;
      this.renderChrome();
      this.request();
    });
  }

  private resized(origin: Geometry, handle: Handle, deltaX: number, deltaY: number, free: boolean): Geometry {
    let { x: left, y: top } = origin;
    let width = origin.w ?? 0;
    let height = origin.h ?? 0;
    if (handle.includes(BLUEPRINT_VIEW.west)) {
      left = snap(origin.x + deltaX, free);
      width = (origin.w ?? 0) + origin.x - left;
    }
    if (handle.includes(BLUEPRINT_VIEW.east)) width = snap((origin.w ?? 0) + deltaX, free);
    if (handle.includes(BLUEPRINT_VIEW.north)) {
      top = snap(origin.y + deltaY, free);
      height = (origin.h ?? 0) + origin.y - top;
    }
    if (handle.includes(BLUEPRINT_VIEW.south)) height = snap((origin.h ?? 0) + deltaY, free);
    const minimum = free ? 1 : BLUEPRINT_DRAW.grid;
    return { x: left, y: top, w: Math.max(minimum, width), h: Math.max(minimum, height) };
  }

  private select(item: SceneItem): void {
    this.selected = item.id;
    if (item.line !== null) this.hooks.jump(item.file, item.line);
  }

  private hover(item: SceneItem | null, screen: Point): void {
    const id = item?.id ?? null;
    if (id !== this.hovered) {
      this.hovered = id;
      this.request();
    }
    if (item === null || this.drag !== null) {
      this.tip.hidden = true;
      return;
    }
    this.tip.hidden = false;
    this.tip.textContent = TEXT.blueprintView.tip(item.label, item.title, valuesText(item.geometry), item.line, item.host);
    this.tip.style.left = TEXT.pixels(screen.x + BLUEPRINT_DRAW.tipOffset);
    this.tip.style.top = TEXT.pixels(screen.y + BLUEPRINT_DRAW.tipOffset);
  }

  private showCoordinates(world: Point, free: boolean): void {
    this.coordinates.textContent = TEXT.blueprintView.coordinates(snap(world.x, free), snap(world.y, free));
  }

  private renderChrome(): void {
    const moved = this.movedCount;
    this.movedBadge.hidden = moved === 0 || this.mini;
    this.movedBadge.textContent = TEXT.blueprintView.moved(moved);
    const item = this.item(this.selected);
    this.card.hidden = item === null || this.mini;
    if (item === null) return;
    const document = this.element.ownerDocument;
    const title = create(document, TAG.div, BLUEPRINT_VIEW.cardTitle, item.label);
    const meta = create(document, TAG.div, CLASS.muted, TEXT.blueprintView.meta(item.title, item.line, item.host));
    const values = create(document, TAG.code, BLUEPRINT_VIEW.cardValues, valuesText(item.geometry));
    const buttons = create(document, TAG.div, BLUEPRINT_VIEW.cardButtons);
    const copy = create(document, TAG.button, CLASS.quiet, TEXT.blueprintView.copy);
    copy.addEventListener(EVENT.click, () => this.hooks.copy(valuesText(item.geometry)));
    const insert = create(document, TAG.button, CLASS.quiet, TEXT.blueprintView.insert);
    insert.addEventListener(EVENT.click, () => this.hooks.insert(valuesText(item.geometry)));
    buttons.append(copy, insert);
    if (isMoved(item)) {
      const from = create(document, TAG.div, CLASS.muted, TEXT.blueprintView.from(valuesText(item.source)));
      const reset = create(document, TAG.button, CLASS.quiet, TEXT.blueprintView.reset);
      reset.addEventListener(EVENT.click, () => {
        this.update(item.id, item.source);
        this.renderChrome();
        this.request();
      });
      buttons.append(reset);
      this.card.replaceChildren(title, meta, values, from, buttons);
      return;
    }
    this.card.replaceChildren(title, meta, values, buttons);
  }

  private draw(): void {
    const context = this.canvas.getContext(BLUEPRINT_VIEW.context);
    if (!context) return;
    const ratio = this.element.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    const style = getComputedStyle(this.element);
    const color = (name: string): string => style.getPropertyValue(name).trim();
    const { width, height } = this.size();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = color(BLUEPRINT_VIEW.colors.background);
    context.fillRect(0, 0, width, height);
    this.drawGrid(context, width, height, color(BLUEPRINT_VIEW.colors.line));
    const accent = color(BLUEPRINT_VIEW.colors.accent);
    const text = color(BLUEPRINT_VIEW.colors.text);
    context.font = BLUEPRINT_DRAW.font;
    context.textBaseline = BLUEPRINT_VIEW.baseline;
    for (const item of this.items) {
      const topLeft = toScreen(this.camera, { x: item.box.x, y: item.box.y });
      const boxWidth = item.box.w * this.camera.scale;
      const boxHeight = item.box.h * this.camera.scale;
      if (isMoved(item)) {
        const source = withGeometry(item, item.source).box;
        const ghost = toScreen(this.camera, { x: source.x, y: source.y });
        context.setLineDash(BLUEPRINT_DRAW.dash);
        context.strokeStyle = item.color;
        context.globalAlpha = BLUEPRINT_DRAW.ghostAlpha;
        context.strokeRect(ghost.x, ghost.y, source.w * this.camera.scale, source.h * this.camera.scale);
        context.beginPath();
        context.moveTo(ghost.x, ghost.y);
        context.lineTo(topLeft.x, topLeft.y);
        context.stroke();
        context.setLineDash([]);
      }
      const emphasis = this.highlighted.has(item.id) || item.id === this.hovered;
      context.globalAlpha = item.host ? BLUEPRINT_DRAW.hostFill : emphasis ? BLUEPRINT_DRAW.emphasisFill : BLUEPRINT_DRAW.fill;
      context.fillStyle = item.color;
      context.fillRect(topLeft.x, topLeft.y, boxWidth, boxHeight);
      context.globalAlpha = item.host ? BLUEPRINT_DRAW.hostStroke : 1;
      context.lineWidth = emphasis ? BLUEPRINT_DRAW.emphasisLine : 1;
      context.strokeStyle = this.highlighted.has(item.id) ? accent : item.color;
      context.strokeRect(topLeft.x, topLeft.y, boxWidth, boxHeight);
      context.globalAlpha = 1;
      context.lineWidth = 1;
      if (!this.mini && !item.host && boxWidth > BLUEPRINT_DRAW.labelWidth && boxHeight > BLUEPRINT_DRAW.labelHeight) {
        context.fillStyle = text;
        context.fillText(item.label, topLeft.x + BLUEPRINT_DRAW.labelInset, topLeft.y + BLUEPRINT_DRAW.labelInset, boxWidth - BLUEPRINT_DRAW.labelInset);
      }
    }
    const selected = this.item(this.selected);
    if (selected) {
      const topLeft = toScreen(this.camera, { x: selected.box.x, y: selected.box.y });
      context.strokeStyle = accent;
      context.lineWidth = BLUEPRINT_DRAW.selectionLine;
      context.strokeRect(topLeft.x - 1, topLeft.y - 1, selected.box.w * this.camera.scale + BLUEPRINT_DRAW.selectionLine, selected.box.h * this.camera.scale + BLUEPRINT_DRAW.selectionLine);
      context.lineWidth = 1;
      if (selected.rect && !this.mini) {
        context.fillStyle = color(BLUEPRINT_VIEW.colors.background);
        for (const handle of BLUEPRINT_VIEW.handles) {
          const spot = this.handleSpot(selected.box, handle);
          context.fillRect(spot.x - BLUEPRINT_DRAW.handleSize, spot.y - BLUEPRINT_DRAW.handleSize, BLUEPRINT_DRAW.handleSize * BLUEPRINT_DRAW.double, BLUEPRINT_DRAW.handleSize * BLUEPRINT_DRAW.double);
          context.strokeRect(spot.x - BLUEPRINT_DRAW.handleSize, spot.y - BLUEPRINT_DRAW.handleSize, BLUEPRINT_DRAW.handleSize * BLUEPRINT_DRAW.double, BLUEPRINT_DRAW.handleSize * BLUEPRINT_DRAW.double);
        }
      }
    }
    if (this.drag?.kind === 'area') {
      const start = toScreen(this.camera, this.drag.start);
      const end = toScreen(this.camera, this.drag.end);
      context.setLineDash(BLUEPRINT_DRAW.dash);
      context.strokeStyle = accent;
      context.strokeRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
      context.setLineDash([]);
    }
  }

  private drawGrid(context: CanvasRenderingContext2D, width: number, height: number, line: string): void {
    let step = BLUEPRINT_DRAW.gridStep;
    while (step * this.camera.scale < BLUEPRINT_DRAW.minGridPixels) step *= BLUEPRINT_DRAW.gridGrowth;
    const start = toWorld(this.camera, { x: 0, y: 0 });
    const end = toWorld(this.camera, { x: width, y: height });
    context.strokeStyle = line;
    context.globalAlpha = BLUEPRINT_DRAW.gridAlpha;
    context.beginPath();
    for (let worldX = Math.floor(start.x / step) * step; worldX <= end.x; worldX += step) {
      const screenX = Math.round(toScreen(this.camera, { x: worldX, y: 0 }).x) + BLUEPRINT_DRAW.half;
      context.moveTo(screenX, 0);
      context.lineTo(screenX, height);
    }
    for (let worldY = Math.floor(start.y / step) * step; worldY <= end.y; worldY += step) {
      const screenY = Math.round(toScreen(this.camera, { x: 0, y: worldY }).y) + BLUEPRINT_DRAW.half;
      context.moveTo(0, screenY);
      context.lineTo(width, screenY);
    }
    context.stroke();
    context.globalAlpha = 1;
  }
}
