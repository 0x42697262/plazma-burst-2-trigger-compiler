import { ACTION_ATTRIBUTE, ACTION_FIELD, ATTRIBUTE, ATTRIBUTE_NAME, ELEMENT, ENTITIES } from './keys.ts';
import { NO_ACTION } from './constants.ts';

export type MapAction = { type: number; targetA: string; targetB: string };
export type MapElement = { index: number; tag: string; attributes: [string, string][]; actions: MapAction[] };

export const decodeEntities = (text: string): string => ENTITIES.reduce((result, [entity, character]) => result.split(entity).join(character), text);

export const attributeOf = (element: MapElement, name: string): string | undefined => element.attributes.find(([attribute]) => attribute === name)?.[1];

export const uidOf = (element: MapElement): string | undefined => attributeOf(element, ATTRIBUTE_NAME.uid);

export function parseMap(xml: string): MapElement[] {
  const elements: MapElement[] = [];
  for (const match of xml.matchAll(ELEMENT)) {
    const attributes: [string, string][] = [];
    const slots = new Map<number, MapAction>();
    for (const [, name = '', value = ''] of (match[2] ?? '').matchAll(ATTRIBUTE)) {
      const action = ACTION_ATTRIBUTE.exec(name);
      if (action === null) {
        attributes.push([name, decodeEntities(value)]);
        continue;
      }
      const slot = Number(action[1]);
      const entry = slots.get(slot) ?? { type: NO_ACTION, targetA: '', targetB: '' };
      if (action[2] === ACTION_FIELD.type) entry.type = Number(value);
      else if (action[2] === ACTION_FIELD.targetA) entry.targetA = decodeEntities(value);
      else entry.targetB = decodeEntities(value);
      slots.set(slot, entry);
    }
    const ordered = [...slots].sort(([first], [second]) => first - second).map(([, action]) => action);
    while (ordered.length > 0 && ordered[ordered.length - 1]?.type === NO_ACTION) ordered.pop();
    elements.push({ index: elements.length, tag: match[1] ?? '', attributes, actions: ordered });
  }
  return elements;
}
