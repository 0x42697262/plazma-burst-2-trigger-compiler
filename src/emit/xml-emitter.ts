import type { Action, Program, Timer, Trigger } from '../program/types.ts';
import { DEFAULT_LAYOUT, FIRST_ACTION_NUMBER } from './constants.ts';
import { ATTRIBUTE_SEPARATOR, XML_ESCAPES, XML_LINE_END } from './keys.ts';
import { ENGINE_MARK, TRIGGER_ATTRIBUTE } from './attributes.ts';
import { TEXT } from './text.ts';
import { checkProgram } from './check.ts';

export type Layout = { originX: number; originY: number; spacing: number; columns: number };
type Position = { x: number; y: number };

export const escapeXml = (value: string): string => XML_ESCAPES.reduce((text, [raw, escaped]) => text.split(raw).join(escaped), value);

const attribute = (name: string, value: string | number | boolean): string => TEXT.xmlAttribute(name, escapeXml(String(value)));

const positionOf = (index: number, layout: Layout): Position => ({
  x: layout.originX + (index % layout.columns) * layout.spacing,
  y: layout.originY + Math.floor(index / layout.columns) * layout.spacing,
});

const actionAttributes = (action: Action, index: number): string[] => {
  const position = index + FIRST_ACTION_NUMBER;
  return [
    attribute(TEXT.actionAttribute(position, TRIGGER_ATTRIBUTE.type), action.opcode),
    attribute(TEXT.actionAttribute(position, TRIGGER_ATTRIBUTE.targetA), action.targetA),
    attribute(TEXT.actionAttribute(position, TRIGGER_ATTRIBUTE.targetB), action.targetB),
  ];
};

const triggerElement = (trigger: Trigger, position: Position): string => TEXT.xmlTrigger([
  attribute(TRIGGER_ATTRIBUTE.uid, trigger.uid),
  attribute(TRIGGER_ATTRIBUTE.x, position.x),
  attribute(TRIGGER_ATTRIBUTE.y, position.y),
  attribute(TRIGGER_ATTRIBUTE.enabled, trigger.enabled),
  attribute(TRIGGER_ATTRIBUTE.maxCalls, trigger.maxCalls),
  ...trigger.actions.flatMap(actionAttributes),
].join(ATTRIBUTE_SEPARATOR));

const timerElement = (timer: Timer, position: Position): string => TEXT.xmlTimer([
  attribute(TRIGGER_ATTRIBUTE.uid, timer.uid),
  attribute(TRIGGER_ATTRIBUTE.x, position.x),
  attribute(TRIGGER_ATTRIBUTE.y, position.y),
  attribute(TRIGGER_ATTRIBUTE.enabled, timer.enabled),
  attribute(TRIGGER_ATTRIBUTE.maxCalls, timer.maxCalls),
  attribute(TRIGGER_ATTRIBUTE.target, timer.target),
  attribute(TRIGGER_ATTRIBUTE.delay, timer.delay),
].join(ATTRIBUTE_SEPARATOR));

const varSyncElement = (position: Position): string => TEXT.xmlEngineMark([
  attribute(TRIGGER_ATTRIBUTE.x, position.x),
  attribute(TRIGGER_ATTRIBUTE.y, position.y),
  attribute(ENGINE_MARK.markAttribute, ENGINE_MARK.varSync),
  attribute(ENGINE_MARK.teamAttribute, ENGINE_MARK.anyTeam),
].join(ATTRIBUTE_SEPARATOR));

export function emitXml(program: Program, layout: Layout = DEFAULT_LAYOUT): string {
  checkProgram(program);
  const elements = program.triggers.map((trigger, index) => triggerElement(trigger, positionOf(index, layout)));
  program.timers.forEach((timer, index) => elements.push(timerElement(timer, positionOf(program.triggers.length + index, layout))));
  if (program.varSyncMark) elements.push(varSyncElement(positionOf(program.triggers.length + program.timers.length, layout)));
  return elements.map((element) => element + XML_LINE_END).join('');
}
