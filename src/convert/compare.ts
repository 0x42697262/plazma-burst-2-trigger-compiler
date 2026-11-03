import { tagRules } from '../objects/properties.ts';
import { DEFAULT_SIZE } from '../objects/keys.ts';
import { ATTRIBUTE_NAME, TAG } from './keys.ts';
import { uidOf } from './map-file.ts';
import type { MapAction, MapElement } from './map-file.ts';
import type { Conversion } from './convert.ts';
import { TEXT } from './text.ts';

export type Report = { compileError: string | null; compared: number; matching: number; expected: Map<string, number>; unexpected: string[] };

const SIZE_ATTRIBUTES: ReadonlySet<string> = new Set([ATTRIBUTE_NAME.w, ATTRIBUTE_NAME.h]);
const POSITIONED_FOR_EDITOR: ReadonlySet<string> = new Set([TAG.trigger, TAG.timer, TAG.inf]);

export const emptyReport = (compileError: string | null): Report => ({ compileError, compared: 0, matching: 0, expected: new Map(), unexpected: [] });

export function compareMaps(
  rebuilt: readonly MapElement[], conversion: Conversion, functionUids: ReadonlyMap<string, string>, functionActions: ReadonlyMap<string, readonly MapAction[]>,
): Report {
  const report = emptyReport(null);
  const count = (reason: string): void => {
    report.expected.set(reason, (report.expected.get(reason) ?? 0) + 1);
  };
  const expectations = new Map<number, Map<string, string>>();
  for (const entry of conversion.expectations) expectations.set(entry.index, (expectations.get(entry.index) ?? new Map<string, string>()).set(entry.attribute, entry.reason));
  const kept = conversion.plans.filter((plan) => plan.kind === 'object' || plan.kind === 'rawTrigger' || plan.kind === 'rawTimer').map((plan) => plan.element);
  const referenced = new Set<string>();
  for (const element of kept) {
    for (const [, value] of element.attributes) referenced.add(value);
    for (const action of element.actions) referenced.add(action.targetA).add(action.targetB);
  }
  for (const plan of conversion.plans) {
    if (plan.kind === 'function') {
      const uid = uidOf(plan.element) ?? '';
      const compiled = functionActions.get(uid);
      if (compiled === undefined) {
        if (referenced.has(uid)) report.unexpected.push(TEXT.report.functionMissing(uid, plan.name));
        else count(TEXT.reasons.functionDropped);
        continue;
      }
      const lost = firstLost(plan.element.actions, compiled, functionUids);
      if (lost === null) count(TEXT.reasons.functionMade);
      else report.unexpected.push(TEXT.report.functionAction(uid, plan.name, lost + 1, describe(plan.element.actions[lost])));
    } else if (plan.kind === 'startTimer') {
      count(TEXT.reasons.startTimer);
    } else if (plan.kind === 'everyTimer') {
      count(TEXT.reasons.everyTimer);
    } else if (plan.kind === 'skipped') {
      count(plan.reason);
    }
  }
  const byTag = (list: readonly MapElement[]): Map<string, MapElement[]> => {
    const groups = new Map<string, MapElement[]>();
    for (const element of list) groups.set(element.tag, [...(groups.get(element.tag) ?? []), element]);
    return groups;
  };
  const keptGroups = byTag(kept);
  const rebuiltGroups = byTag(rebuilt);
  for (const [tag, elements] of keptGroups) {
    const others = rebuiltGroups.get(tag) ?? [];
    elements.forEach((element, position) => {
      const other = others[position];
      if (other === undefined) {
        report.unexpected.push(TEXT.report.missing(tag, element.index));
        return;
      }
      report.compared += 1;
      const differences = compareElement(element, other, expectations.get(element.index) ?? new Map(), functionUids, count);
      if (differences.length === 0) report.matching += 1;
      report.unexpected.push(...differences);
    });
    for (const extra of others.slice(elements.length)) report.unexpected.push(TEXT.report.extra(extra.tag));
  }
  for (const [tag, others] of rebuiltGroups) if (!keptGroups.has(tag)) for (const extra of others) report.unexpected.push(TEXT.report.extra(extra.tag));
  return report;
}

function compareElement(element: MapElement, other: MapElement, expected: ReadonlyMap<string, string>, functionUids: ReadonlyMap<string, string>, count: (reason: string) => void): string[] {
  const unexpected: string[] = [];
  const label = TEXT.report.label(element.index, uidOf(element));
  const otherValues = new Map(other.attributes);
  const ownValues = new Map(element.attributes);
  for (const [name, value] of element.attributes) {
    const now = otherValues.get(name);
    if (now === value) continue;
    const reason = expected.get(name);
    if (reason !== undefined && (reason !== TEXT.reasons.reference || functionUids.get(value) === now)) count(reason);
    else unexpected.push(TEXT.report.attribute(element.tag, label, name, value, now ?? TEXT.report.absent));
  }
  const defaults = tagRules(element.tag)?.defaults ?? {};
  for (const [name, value] of other.attributes) {
    if (ownValues.has(name)) continue;
    const reason = expected.get(name);
    if (reason !== undefined) count(reason);
    else if (POSITIONED_FOR_EDITOR.has(element.tag) && (name === ATTRIBUTE_NAME.x || name === ATTRIBUTE_NAME.y)) count(TEXT.reasons.positionAdded)
    else if (defaults[name] === value || (SIZE_ATTRIBUTES.has(name) && value === DEFAULT_SIZE) || (element.tag === TAG.inf && name === ATTRIBUTE_NAME.forteam && value === defaults[name])) count(TEXT.report.defaultAdded);
    else unexpected.push(TEXT.report.attribute(element.tag, label, name, TEXT.report.absent, value));
  }
  const length = Math.max(element.actions.length, other.actions.length);
  for (let position = 0; position < length; position++) {
    const before = element.actions[position];
    const after = other.actions[position];
    if (before !== undefined && after !== undefined && sameAction(before, after, functionUids)) {
      if (before.targetA !== after.targetA || before.targetB !== after.targetB) count(TEXT.reasons.reference);
      continue;
    }
    unexpected.push(TEXT.report.actions(element.tag, label, position + 1, describe(before), describe(after)));
  }
  return unexpected;
}

function firstLost(actions: readonly MapAction[], compiled: readonly MapAction[], functionUids: ReadonlyMap<string, string>): number | null {
  const unused = [...compiled];
  for (const [position, action] of actions.entries()) {
    const found = unused.findIndex((candidate) => sameAction(action, candidate, functionUids));
    if (found === -1) return position;
    unused.splice(found, 1);
  }
  return null;
}

const sameTarget = (before: string, after: string, functionUids: ReadonlyMap<string, string>): boolean => before === after || functionUids.get(before) === after;

const sameAction = (before: MapAction, after: MapAction, functionUids: ReadonlyMap<string, string>): boolean =>
  before.type === after.type && sameTarget(before.targetA, after.targetA, functionUids) && sameTarget(before.targetB, after.targetB, functionUids);

const describe = (action: MapAction | undefined): string => (action === undefined ? TEXT.report.absent : TEXT.report.actionText(action.type, action.targetA, action.targetB));
