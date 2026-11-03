import type { Attribute, MapObject } from '../objects/types.ts';
import { tagRules } from '../objects/properties.ts';
import { DEFAULT_SIZE, ENGINE_MARK_TAG, MARK_ARGUMENT, POSITION_ATTRIBUTES, SIZE_ATTRIBUTES, UID_ATTRIBUTE_NAME } from '../objects/keys.ts';
import type { Region } from '../sim/simulator.ts';
import { escapeXml } from './xml-emitter.ts';
import type { Position } from './xml-emitter.ts';
import { ACTION_ATTRIBUTE, ACTION_FIELDS, ELEMENT_ATTRIBUTE, ELEMENT_PARTS, MAP_ELEMENT, REGION_TAG, TIMER_TAG, TRIGGER_TAG, TRUE_TEXT, XML_LINE_END } from './keys.ts';
import { ENGINE_MARK, TRIGGER_ATTRIBUTE } from './attributes.ts';
import { FIRST_ACTION_NUMBER } from './constants.ts';
import type { Action, Program, Timer, Trigger } from '../program/types.ts';
import { PLACE_TEXT as TEXT } from './text.ts';

export type Placement = {
  host: string | null;
  xml: string;
  notes: string[];
  problems: string[];
  walls: string[];
  declaresVarSync: boolean;
};

export type PlaceOptions = { host: string | null; staging: (index: number) => Position; previousWalls: readonly string[]; replacing: boolean };

type Element = { tag: string; attributes: [string, string][]; text: string; index: number };

const parseElement = (text: string, index: number): Element | null => {
  const parts = ELEMENT_PARTS.exec(text.trim());
  if (parts === null) return null;
  const attributes = [...(parts[2] ?? '').matchAll(ELEMENT_ATTRIBUTE)].map((match): [string, string] => [match[1] ?? '', match[2] ?? '']);
  return { tag: parts[1] ?? '', attributes, text, index };
};

const elementText = (tag: string, attributes: readonly (readonly [string, string])[]): string =>
  TEXT.element(tag, attributes.map(([name, value]) => TEXT.attribute(name, value)));

const nameOf = (object: MapObject): string => object.uid ?? (object.mark === null ? object.constructorName : TEXT.markName(object.mark));

function createElement(object: MapObject, staging: () => Position): string {
  const rules = tagRules(object.tag);
  const attributes = new Map<string, string>();
  if (object.uid !== null) attributes.set(UID_ATTRIBUTE_NAME, object.uid);
  const given = new Map([...object.initial, ...object.set]);
  if (rules?.place) {
    const needsStaging = !given.has(POSITION_ATTRIBUTES.x) || !given.has(POSITION_ATTRIBUTES.y);
    const spot = needsStaging ? staging() : null;
    attributes.set(POSITION_ATTRIBUTES.x, String(spot?.x ?? ''));
    attributes.set(POSITION_ATTRIBUTES.y, String(spot?.y ?? ''));
  }
  if (rules?.rect) {
    attributes.set(SIZE_ATTRIBUTES.w, DEFAULT_SIZE);
    attributes.set(SIZE_ATTRIBUTES.h, DEFAULT_SIZE);
  }
  for (const [name, value] of Object.entries(rules?.defaults ?? {})) attributes.set(name, value);
  for (const [name, value] of given) attributes.set(name, value);
  return elementText(object.tag, [...attributes, ...actionAttributes(object.actions ?? [])].map(([name, value]) => [name, escapeXml(value)] as const));
}

const actionAttributes = (actions: readonly Action[]): (readonly [string, string])[] => actions.flatMap((action, index) => {
  const position = index + FIRST_ACTION_NUMBER;
  return [
    [TEXT.actionAttribute(position, TRIGGER_ATTRIBUTE.type), String(action.opcode)] as const,
    [TEXT.actionAttribute(position, TRIGGER_ATTRIBUTE.targetA), action.targetA] as const,
    [TEXT.actionAttribute(position, TRIGGER_ATTRIBUTE.targetB), action.targetB] as const,
  ];
});

function replaceActions(attributes: [string, string][], actions: readonly Action[]): string | null {
  const before = attributes.filter(([name]) => ACTION_ATTRIBUTE.test(name));
  const after = actionAttributes(actions).map(([name, value]): [string, string] => [name, escapeXml(value)]);
  if (before.length === after.length && before.every(([name, value], index) => after[index]?.[0] === name && after[index]?.[1] === value)) return null;
  const kept = attributes.filter(([name]) => !ACTION_ATTRIBUTE.test(name));
  attributes.splice(0, attributes.length, ...kept, ...after);
  return TEXT.actionsChanged(before.length / ACTION_FIELDS, actions.length);
}

function updateElement(element: Element, changes: readonly Attribute[], actions: readonly Action[] | null): { text: string; changed: string[] } {
  const attributes = element.attributes.map(([name, value]): [string, string] => [name, value]);
  const changed: string[] = [];
  for (const [name, raw] of changes) {
    const value = escapeXml(raw);
    const existing = attributes.find(([attribute]) => attribute === name);
    if (existing && existing[1] === value) continue;
    changed.push(TEXT.change(name, existing?.[1] ?? null, value));
    if (existing) existing[1] = value;
    else attributes.push([name, value]);
  }
  const actionChange = actions === null ? null : replaceActions(attributes, actions);
  if (actionChange !== null) changed.push(actionChange);
  if (changed.length === 0) return { text: element.text, changed };
  const lineEnd = element.text.endsWith(XML_LINE_END) ? XML_LINE_END : '';
  return { text: elementText(element.tag, attributes) + lineEnd, changed };
}

export function placeObjects(objects: readonly MapObject[], options: PlaceOptions): Placement {
  let stagingIndex = 0;
  const staging = (): Position => options.staging(stagingIndex++);
  const notes: string[] = [];
  const problems: string[] = [];
  const walls: string[] = [];
  const created: string[] = [];
  const declaresVarSync = objects.some((object) => object.mark === ENGINE_MARK.varSync);
  if (options.host === null) {
    const xml = objects.map((object) => {
      const text = createElement(object, staging);
      if (object.uid !== null) created.push(object.uid);
      return text + XML_LINE_END;
    }).join('');
    if (created.length > 0) notes.push(TEXT.writtenWithoutMap(created));
    return { host: null, xml, notes, problems, walls: [], declaresVarSync };
  }
  const pendingWalls = options.replacing ? [...options.previousWalls] : [];
  const elements: Element[] = [];
  const removed = new Set<number>();
  let position = 0;
  for (const match of options.host.matchAll(MAP_ELEMENT)) {
    const element = parseElement(match[0], position);
    position += 1;
    if (element === null) continue;
    const wall = pendingWalls.indexOf(element.text.trim());
    if (wall >= 0) {
      pendingWalls.splice(wall, 1);
      removed.add(element.index);
      continue;
    }
    elements.push(element);
  }
  const byUid = new Map<string, Element>();
  const marks = new Map<string, Element[]>();
  for (const element of elements) {
    const uid = element.attributes.find(([name]) => name === UID_ATTRIBUTE_NAME)?.[1];
    if (uid !== undefined && !byUid.has(uid)) byUid.set(uid, element);
    const mark = element.tag === ENGINE_MARK_TAG ? element.attributes.find(([name]) => name === MARK_ARGUMENT)?.[1] : undefined;
    if (mark !== undefined) marks.set(mark, [...(marks.get(mark) ?? []), element]);
  }
  const replaced = new Map<number, string>();
  const added: string[] = [];
  const update = (object: MapObject, element: Element): void => {
    const { text, changed } = updateElement(element, object.set, object.actions);
    if (changed.length === 0) return;
    replaced.set(element.index, text);
    notes.push(TEXT.changed(nameOf(object), changed));
  };
  const create = (object: MapObject): string => {
    const text = createElement(object, staging);
    added.push(text + XML_LINE_END);
    return text;
  };
  for (const object of objects) {
    if (object.uid !== null) {
      const element = byUid.get(object.uid);
      if (element === undefined) {
        create(object);
        notes.push(TEXT.added(object.constructorName, object.uid));
      } else if (element.tag !== object.tag) {
        problems.push(TEXT.otherTag(object.uid, element.tag, object.constructorName, object.line));
      } else {
        update(object, element);
      }
    } else if (object.mark !== null) {
      const found = marks.get(object.mark) ?? [];
      if (found.length === 0) {
        create(object);
        notes.push(TEXT.added(object.constructorName, object.mark));
      } else if (found.length > 1) {
        problems.push(TEXT.severalMarks(object.mark, found.map((element) => element.text.trim())));
      } else {
        update(object, found[0] as Element);
      }
    } else {
      walls.push(create(object));
    }
  }
  if (walls.length > 0 && !options.replacing) notes.push(TEXT.wallsAgain(walls.length));
  let index = 0;
  const host = options.host.replace(MAP_ELEMENT, (text) => {
    const current = index;
    index += 1;
    if (removed.has(current)) return '';
    return replaced.get(current) ?? text;
  });
  return { host, xml: added.join(''), notes, problems, walls, declaresVarSync };
}

const valueOf = (object: MapObject, name: string): string => new Map([...object.initial, ...object.set]).get(name) ?? tagRules(object.tag)?.defaults[name] ?? '';

export function mapTriggers(objects: readonly MapObject[]): Program {
  const triggers: Trigger[] = [];
  const timers: Timer[] = [];
  for (const object of objects) {
    if (object.uid === null) continue;
    const enabled = valueOf(object, TRIGGER_ATTRIBUTE.enabled) === TRUE_TEXT;
    const maxCalls = Number(valueOf(object, TRIGGER_ATTRIBUTE.maxCalls));
    if (object.tag === TRIGGER_TAG) triggers.push({ uid: object.uid, enabled, maxCalls, actions: object.actions ?? [] });
    if (object.tag === TIMER_TAG) {
      timers.push({ uid: object.uid, target: valueOf(object, TRIGGER_ATTRIBUTE.target), enabled, maxCalls, delay: Number(valueOf(object, TRIGGER_ATTRIBUTE.delay)) });
    }
  }
  return { triggers, timers };
}

export function withMapTriggers(program: Program, objects: readonly MapObject[]): Program {
  const extra = mapTriggers(objects);
  return { ...program, triggers: [...extra.triggers, ...program.triggers], timers: [...extra.timers, ...program.timers] };
}

export function regionsOf(objects: readonly MapObject[]): Record<string, Region> {
  const regions: Record<string, Region> = {};
  for (const object of objects) {
    if (object.uid === null || object.tag !== REGION_TAG) continue;
    const values = new Map([...object.initial, ...object.set]);
    const number = (name: string, fallback: string | null): number => Number(values.get(name) ?? fallback);
    const region = { x: number(POSITION_ATTRIBUTES.x, null), y: number(POSITION_ATTRIBUTES.y, null), w: number(SIZE_ATTRIBUTES.w, DEFAULT_SIZE), h: number(SIZE_ATTRIBUTES.h, DEFAULT_SIZE) };
    if (Object.values(region).every(Number.isFinite)) regions[object.uid] = region;
  }
  return regions;
}
