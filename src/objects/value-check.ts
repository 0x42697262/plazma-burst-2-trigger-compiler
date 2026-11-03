import { groupForKind, hasPlaceholder, mergedKinds, valueGroup, valueList, valueTable } from '../opcodes/values.ts';
import { CUSTOM_VALUES, OPEN_LISTS } from './keys.ts';
import { constructorForTag } from './properties.ts';
import { BOOL_TEXT, KIND_PART, NUMBER_KIND, NUMBER_LIMIT, REFERENCE_KINDS, TRIGGER_TAG, UID_MARK, WHOLE_KINDS } from './constants.ts';
import { TEXT } from './text.ts';

export type BuildValue =
  | { kind: 'text'; text: string }
  | { kind: 'object'; tag: string; uid: string | null }
  | { kind: 'name'; name: string }
  | { kind: 'raw'; text: string }
  | { kind: 'named'; group: string; text: string }
  | { kind: 'function'; name: string };

export type Checked = { kind: 'text'; text: string } | { kind: 'function'; name: string } | { kind: 'error'; message: string };

const ok = (text: string): Checked => ({ kind: 'text', text });
const error = (message: string): Checked => ({ kind: 'error', message });

const listLike = (kind: string): boolean => mergedKinds(kind).some((part) => Object.keys(valueTable(part)).length > 0);

const isNumberKind = (kind: string): boolean => NUMBER_KIND.test(kind);

const isWhole = (kind: string): boolean => kind.split(KIND_PART).some((part) => WHOLE_KINDS.includes(part));

const numberText = (text: string): number | null => {
  if (text.trim() === '') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

export function describeKind(kind: string): string {
  if (Object.hasOwn(REFERENCE_KINDS, kind)) {
    const tag = REFERENCE_KINDS[kind] ?? '';
    const names = [...valueList(kind).members.keys()].join(TEXT.or);
    return tag === TRIGGER_TAG ? TEXT.functionOr(names) : TEXT.objectOr(constructorForTag(tag) ?? tag, names);
  }
  if (kind === BOOL_TEXT.kind) return TEXT.boolKind;
  if (isNumberKind(kind)) {
    const limit = kind.includes(NUMBER_LIMIT.positive) ? TEXT.positive : kind.includes(NUMBER_LIMIT.notNegative) ? TEXT.notNegative : '';
    return isWhole(kind) ? TEXT.wholeNumber(limit) : TEXT.number(limit);
  }
  if (listLike(kind)) {
    const group = groupForKind(kind);
    return TEXT.listKind(group?.name ?? kind, OPEN_LISTS.has(mergedKinds(kind)[0] ?? kind), hasPlaceholder(kind));
  }
  return TEXT.textKind;
}

function checkNumber(kind: string, text: string): Checked {
  const number = numberText(text);
  if (number === null) return error(TEXT.notNumber(text, describeKind(kind)));
  if (kind.includes(NUMBER_LIMIT.positive) && number <= 0) return error(TEXT.notNumber(text, describeKind(kind)));
  if (kind.includes(NUMBER_LIMIT.notNegative) && number < 0) return error(TEXT.notNumber(text, describeKind(kind)));
  if (isWhole(kind) && !Number.isInteger(number)) return error(TEXT.notNumber(text, describeKind(kind)));
  return ok(String(number));
}

function checkBool(value: BuildValue): Checked {
  if (value.kind === 'name') {
    const raw = valueList(BOOL_TEXT.kind).members.get(value.name);
    return raw === undefined ? error(TEXT.notInList(value.name, describeKind(BOOL_TEXT.kind))) : ok(raw);
  }
  if (value.kind === 'named') return checkBool({ kind: 'text', text: value.text });
  if (value.kind !== 'text') return error(TEXT.notInList(TEXT.mapObject, describeKind(BOOL_TEXT.kind)));
  if (BOOL_TEXT.yes.includes(value.text)) return ok(BOOL_TEXT.true);
  if (BOOL_TEXT.no.includes(value.text)) return ok(BOOL_TEXT.false);
  return error(TEXT.notInList(value.text, describeKind(BOOL_TEXT.kind)));
}

function checkListText(kind: string, text: string): Checked {
  const known = mergedKinds(kind).some((part) => Object.hasOwn(valueTable(part), text));
  if (known) return ok(text);
  if (hasPlaceholder(kind) && numberText(text) !== null) return ok(String(Number(text)));
  if (isCustom(kind, text)) return ok(text);
  return error(TEXT.notInList(text, describeKind(kind)));
}

function isCustom(kind: string, text: string): boolean {
  const base = mergedKinds(kind)[0] ?? kind;
  return OPEN_LISTS.has(base) && (CUSTOM_VALUES[base]?.test(text) ?? false);
}

function checkReference(kind: string, value: BuildValue): Checked {
  const tag = REFERENCE_KINDS[kind] ?? '';
  switch (value.kind) {
    case 'object':
      if (value.tag !== tag) return error(TEXT.wrongObject(constructorForTag(value.tag) ?? value.tag, describeKind(kind)));
      return value.uid === null ? error(TEXT.noUid(describeKind(kind))) : ok(value.uid);
    case 'function':
      return tag === TRIGGER_TAG ? { kind: 'function', name: value.name } : error(TEXT.notInList(TEXT.functionReference(value.name), describeKind(kind)));
    case 'name': {
      const raw = valueList(kind).members.get(value.name);
      return raw === undefined ? error(TEXT.notInList(value.name, describeKind(kind))) : ok(raw);
    }
    case 'named':
    case 'text':
      if (value.text.startsWith(UID_MARK) || mergedKinds(kind).some((part) => Object.hasOwn(valueTable(part), value.text))) return ok(value.text);
      return error(TEXT.notInList(value.text, describeKind(kind)));
    default:
      return error(TEXT.textKind);
  }
}

export function checkValue(kind: string, value: BuildValue): Checked {
  if (value.kind === 'raw') return ok(value.text);
  if (Object.hasOwn(REFERENCE_KINDS, kind)) return checkReference(kind, value);
  if (value.kind === 'object') return error(TEXT.notInList(TEXT.mapObject, describeKind(kind)));
  if (value.kind === 'function') return error(TEXT.notInList(TEXT.functionReference(value.name), describeKind(kind)));
  if (kind === BOOL_TEXT.kind) return checkBool(value);
  if (value.kind === 'named') {
    const group = valueGroup(value.group);
    if (group && !group.kinds.some((part) => mergedKinds(kind).includes(part))) return error(TEXT.wrongGroup(value.group, describeKind(kind)));
    return listLike(kind) ? checkListText(kind, value.text) : isNumberKind(kind) ? checkNumber(kind, value.text) : ok(value.text);
  }
  if (value.kind === 'name') {
    const raw = listLike(kind) ? valueList(kind).members.get(value.name) : undefined;
    if (raw !== undefined) return ok(raw);
    return isCustom(kind, value.name) ? ok(value.name) : error(TEXT.notInList(value.name, describeKind(kind)));
  }
  if (isNumberKind(kind)) return checkNumber(kind, value.text);
  if (listLike(kind)) return checkListText(kind, value.text);
  return ok(value.text);
}
