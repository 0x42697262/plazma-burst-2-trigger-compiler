import type { MapObject } from '../objects/types.ts';
import { tagRules } from '../objects/properties.ts';
import { ELEMENT_ATTRIBUTE, ELEMENT_PARTS, MAP_ELEMENT } from '../emit/keys.ts';
import { BLUEPRINT } from './keys.ts';
import { BLUEPRINT_SIZE, BOTH_SIDES, HALF } from './constants.ts';
import { TEXT } from './text.ts';

export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Camera = { x: number; y: number; scale: number };
export type Geometry = { x: number; y: number; w: number | null; h: number | null };
export type SceneItem = {
  id: string; tag: string; title: string; color: string; label: string; uid: string | null; rect: boolean; host: boolean;
  geometry: Geometry; source: Geometry; box: Box; side: number; model: string | null;
  line: number | null; file: string | null; attributes: readonly (readonly [string, string])[];
};
export type Scene = { items: SceneItem[]; bounds: Box | null };

const rulesOf = tagRules;

const numberOf = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function boundsOf(tag: string, geometry: Geometry, side: number, model: string | null): Box {
  if (geometry.w !== null && geometry.h !== null) {
    return { x: Math.min(geometry.x, geometry.x + geometry.w), y: Math.min(geometry.y, geometry.y + geometry.h), w: Math.abs(geometry.w), h: Math.abs(geometry.h) };
  }
  const rules = rulesOf(tag);
  const box = (model !== null ? rules?.modelBoxes?.[model] : undefined) ?? rules?.box ?? BLUEPRINT_SIZE.marker;
  const left = side === BLUEPRINT.leftSide ? -box.x - box.w : box.x;
  return { x: geometry.x + left, y: geometry.y + box.y, w: box.w, h: box.h };
}

const unionOf = (boxes: readonly Box[]): Box | null => {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
};

type HostElement = { tag: string; attributes: Map<string, string>; index: number };

export function hostElements(xml: string): HostElement[] {
  const found: HostElement[] = [];
  let index = 0;
  for (const match of xml.matchAll(MAP_ELEMENT)) {
    const parts = ELEMENT_PARTS.exec(match[0].trim());
    if (parts === null) continue;
    const attributes = new Map([...(parts[2] ?? '').matchAll(ELEMENT_ATTRIBUTE)].map((entry): [string, string] => [entry[1] ?? '', entry[2] ?? '']));
    found.push({ tag: parts[1] ?? '', attributes, index });
    index += 1;
  }
  return found;
}

function item(id: string, tag: string, values: ReadonlyMap<string, string>, host: boolean, label: string, line: number | null, file: string | null): SceneItem | null {
  const rules = rulesOf(tag);
  if (!rules?.place) return null;
  const left = numberOf(values.get(BLUEPRINT.attribute.x));
  const top = numberOf(values.get(BLUEPRINT.attribute.y));
  if (left === null || top === null) return null;
  const geometry: Geometry = rules.rect
    ? { x: left, y: top, w: numberOf(values.get(BLUEPRINT.attribute.w)) ?? BLUEPRINT_SIZE.defaultSide, h: numberOf(values.get(BLUEPRINT.attribute.h)) ?? BLUEPRINT_SIZE.defaultSide }
    : { x: left, y: top, w: null, h: null };
  const side = numberOf(values.get(BLUEPRINT.attribute.side)) ?? 1;
  const model = tag === BLUEPRINT.vehicleTag ? values.get(BLUEPRINT.attribute.model) ?? rules.defaults[BLUEPRINT.attribute.model] ?? null : null;
  return {
    id, tag, title: rules.title ?? tag, color: rules.color ?? BLUEPRINT.fallbackColor, label, uid: values.get(BLUEPRINT.attribute.uid) ?? null, rect: rules.rect, host,
    geometry, source: geometry, box: boundsOf(tag, geometry, side, model), side, model, line, file, attributes: [...values],
  };
}

export function sceneOf(objects: readonly MapObject[], staging: (index: number) => Point, hostXml: string | null): Scene {
  const host = hostXml === null ? [] : hostElements(hostXml);
  const byUid = new Map(host.flatMap((element) => {
    const uid = element.attributes.get(BLUEPRINT.attribute.uid);
    return uid === undefined ? [] : [[uid, element] as const];
  }));
  const used = new Set<HostElement>();
  const items: SceneItem[] = [];
  const program: SceneItem[] = [];
  let stagingIndex = 0;
  const counts = new Map<string, number>();
  for (const object of objects) {
    const existing = object.uid === null ? undefined : byUid.get(object.uid);
    let values: Map<string, string>;
    if (existing && existing.tag === object.tag) {
      used.add(existing);
      values = new Map([...existing.attributes, ...object.set]);
    } else {
      values = new Map(Object.entries(rulesOf(object.tag)?.defaults ?? {}));
      for (const [name, value] of [...object.initial, ...object.set]) values.set(name, value);
      if (object.uid !== null) values.set(BLUEPRINT.attribute.uid, object.uid);
      if (rulesOf(object.tag)?.place && (!values.has(BLUEPRINT.attribute.x) || !values.has(BLUEPRINT.attribute.y))) {
        const spot = staging(stagingIndex);
        stagingIndex += 1;
        if (!values.has(BLUEPRINT.attribute.x)) values.set(BLUEPRINT.attribute.x, String(spot.x));
        if (!values.has(BLUEPRINT.attribute.y)) values.set(BLUEPRINT.attribute.y, String(spot.y));
      }
    }
    const key = TEXT.blueprint.siteKey(object.tag, object.line);
    const occurrence = counts.get(key) ?? 0;
    counts.set(key, occurrence + 1);
    const label = object.uid ?? (object.mark === null ? object.constructorName : TEXT.blueprint.markLabel(object.mark));
    const made = item(object.uid ?? TEXT.blueprint.siteId(key, occurrence), object.tag, values, false, label, object.line, object.file ?? null);
    if (made) program.push(made);
  }
  for (const element of host) {
    if (used.has(element)) continue;
    const uid = element.attributes.get(BLUEPRINT.attribute.uid);
    const label = uid ?? rulesOf(element.tag)?.title ?? element.tag;
    const made = item(TEXT.blueprint.hostId(element.index), element.tag, element.attributes, true, label, null, null);
    if (made) items.push(made);
  }
  items.push(...program);
  return { items, bounds: unionOf(items.map((entry) => entry.box)) };
}

const contains = (box: Box, point: Point): boolean => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h;

export function hitTest(items: readonly SceneItem[], point: Point): SceneItem | null {
  const hits = items.filter((entry) => contains(entry.box, point));
  hits.sort((first, second) => Number(first.host) - Number(second.host) || first.box.w * first.box.h - second.box.w * second.box.h);
  return hits[0] ?? null;
}

export const toScreen = (camera: Camera, point: Point): Point => ({ x: (point.x - camera.x) * camera.scale, y: (point.y - camera.y) * camera.scale });

export const toWorld = (camera: Camera, point: Point): Point => ({ x: point.x / camera.scale + camera.x, y: point.y / camera.scale + camera.y });

export function zoomAt(camera: Camera, screen: Point, factor: number): Camera {
  const scale = Math.min(BLUEPRINT_SIZE.maxScale, Math.max(BLUEPRINT_SIZE.minScale, camera.scale * factor));
  const anchor = toWorld(camera, screen);
  return { x: anchor.x - screen.x / scale, y: anchor.y - screen.y / scale, scale };
}

export function fit(bounds: Box | null, width: number, height: number): Camera {
  if (bounds === null || width <= 0 || height <= 0) return { x: -width * HALF, y: -height * HALF, scale: 1 };
  const padding = BLUEPRINT_SIZE.fitPadding * BOTH_SIDES;
  const scale = Math.min(BLUEPRINT_SIZE.maxScale, Math.max(BLUEPRINT_SIZE.minScale, Math.min((width - padding) / Math.max(bounds.w, 1), (height - padding) / Math.max(bounds.h, 1))));
  return { x: bounds.x + (bounds.w - width / scale) * HALF, y: bounds.y + (bounds.h - height / scale) * HALF, scale };
}

export const snap = (value: number, free: boolean): number => (free ? Math.round(value) : Math.round(value / BLUEPRINT_SIZE.grid) * BLUEPRINT_SIZE.grid);

export function withGeometry(entry: SceneItem, geometry: Geometry): SceneItem {
  return { ...entry, geometry, box: boundsOf(entry.tag, geometry, entry.side, entry.model) };
}

export const isMoved = (entry: SceneItem): boolean =>
  entry.geometry.x !== entry.source.x || entry.geometry.y !== entry.source.y || entry.geometry.w !== entry.source.w || entry.geometry.h !== entry.source.h;

export const valuesText = (geometry: Geometry): string =>
  (geometry.w === null || geometry.h === null ? TEXT.blueprint.position(geometry.x, geometry.y) : TEXT.blueprint.area(geometry.x, geometry.y, geometry.w, geometry.h));

export const itemsAtLine = (items: readonly SceneItem[], file: string, line: number, mainFile: string): SceneItem[] =>
  items.filter((entry) => entry.line === line && (entry.file ?? mainFile) === file);
