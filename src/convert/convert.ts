import { opcodeByNumber } from '../opcodes/table.ts';
import { valueGroup, valueList } from '../opcodes/values.ts';
import { AREA_ARGUMENTS, CONSTRUCTORS, MARK_ARGUMENT, MARK_VALUE, OBJECT_KINDS, UID_ARGUMENT } from '../objects/keys.ts';
import { constructorForTag, markValueKind, propertyOf, tagRules } from '../objects/properties.ts';
import { checkValue } from '../objects/value-check.ts';
import { attributeOf, parseMap, uidOf } from './map-file.ts';
import type { MapAction, MapElement } from './map-file.ts';
import { Namer } from './names.ts';
import {
  ARGUMENT_SEPARATOR, ATTRIBUTE_NAME, BOOL_KIND, CALLS_SUFFIX, COPY_SUFFIX, DONE_SUFFIX, ESCAPES, FALSE_TEXT, IDENTIFIER, IN_FRONT_MODELS, IN_FRONT_VALUE, INDENT, LINE_END,
  NO_VALUE_KIND, NONE, ONCE, QUOTE, REFERENCE_ATTRIBUTES, STOPPING_DESCRIPTION, STYLE, TAG, TIMER_KIND, TRIGGER_KIND, TRUE_TEXT, UID_MARK, UNLIMITED, UNREAD_ATTRIBUTES,
} from './keys.ts';
import { SHOW_TEXT, SWITCH_BY_INDEX, SWITCH_TO_TRIGGER, TRIGGER_STATE_ACTIONS } from './constants.ts';
import { TEXT } from './text.ts';

export type Style = (typeof STYLE)[keyof typeof STYLE];
export type ConvertOptions = { style: Style; label: string };
export type Expectation = { index: number; attribute: string; reason: string };
export type Plan =
  | { kind: 'object'; element: MapElement; uid: string | null }
  | { kind: 'rawTrigger'; element: MapElement; uid: string }
  | { kind: 'rawTimer'; element: MapElement; uid: string }
  | { kind: 'function'; element: MapElement; name: string }
  | { kind: 'startTimer'; element: MapElement; functionName: string; delay: number }
  | { kind: 'everyTimer'; element: MapElement; functionName: string; delay: number }
  | { kind: 'skipped'; element: MapElement; reason: string };
export type Conversion = {
  source: string; notes: string[]; plans: Plan[]; functions: ReadonlyMap<string, string>; expectations: Expectation[]; positional: boolean;
};

const quote = (text: string): string => QUOTE + ESCAPES.reduce((result, [raw, escaped]) => result.split(raw).join(escaped), text) + QUOTE;
const isCanonicalNumber = (text: string): boolean => Number.isFinite(Number(text)) && String(Number(text)) === text;
const isWholeNumber = (text: string): boolean => isCanonicalNumber(text) && Number.isInteger(Number(text));
const opcodeKinds = (action: MapAction): readonly [string, string] => {
  const opcode = opcodeByNumber(action.type);
  return [opcode?.paramA ?? NO_VALUE_KIND, opcode?.paramB ?? NO_VALUE_KIND];
};
const stops = (action: MapAction): boolean => action.type === SWITCH_TO_TRIGGER || STOPPING_DESCRIPTION.test(opcodeByNumber(action.type)?.description ?? '');

class Converter {
  private readonly elements: MapElement[];
  private readonly options: ConvertOptions;
  private readonly namer = new Namer();
  private readonly notes: string[] = [];
  private readonly expectations: Expectation[] = [];
  private readonly finalUid = new Map<number, string>();
  private readonly firstByUid = new Map<string, MapElement>();
  private readonly functions = new Map<string, string>();
  private readonly names = new Map<number, string>();
  private readonly plans = new Map<number, Plan>();
  private positional = false;

  constructor(xml: string, options: ConvertOptions) {
    this.elements = parseMap(xml);
    this.options = options;
  }

  run(): Conversion {
    this.assignUids();
    this.positional = this.options.style === STYLE.raw || this.usesPositions();
    if (this.positional && this.options.style !== STYLE.raw) this.notes.push(TEXT.notes.positional);
    this.planTriggers();
    this.planTimers();
    this.planObjects();
    this.nameReferencedObjects();
    const plans = this.elements.map((element) => this.plans.get(element.index) as Plan);
    return { source: this.write(plans), notes: this.notes, plans, functions: this.functions, expectations: this.expectations, positional: this.positional };
  }

  private expect(element: MapElement, attribute: string, reason: string): void {
    this.expectations.push({ index: element.index, attribute, reason });
  }

  private assignUids(): void {
    const used = new Set<string>();
    for (const element of this.elements) {
      for (const [, value] of element.attributes) used.add(value);
      for (const action of element.actions) used.add(action.targetA).add(action.targetB);
    }
    const counters = new Map<string, number>();
    const fresh = (base: string, separator: string): string => {
      let number = counters.get(base) ?? 1;
      while (used.has(base + separator + String(number))) number++;
      counters.set(base, number + 1);
      const uid = base + separator + String(number);
      used.add(uid);
      return uid;
    };
    for (const element of this.elements) {
      const constructorName = constructorForTag(element.tag);
      const needsUid = constructorName !== null && CONSTRUCTORS[constructorName]?.positional.includes(UID_ARGUMENT) === true;
      const uid = uidOf(element);
      if (uid !== undefined && !this.firstByUid.has(uid)) this.firstByUid.set(uid, element);
      if (!needsUid) continue;
      if (uid === undefined || uid === '' || !uid.startsWith(UID_MARK)) {
        const made = fresh(UID_MARK + element.tag, COPY_SUFFIX);
        this.finalUid.set(element.index, made);
        this.expect(element, ATTRIBUTE_NAME.uid, TEXT.reasons.uidAdded);
      } else if (this.firstByUid.get(uid) !== element) {
        const made = fresh(uid, COPY_SUFFIX);
        this.finalUid.set(element.index, made);
        this.expect(element, ATTRIBUTE_NAME.uid, TEXT.reasons.uidRenamed);
      } else {
        this.finalUid.set(element.index, uid);
      }
    }
    const added = this.expectations.filter((entry) => entry.reason === TEXT.reasons.uidAdded).length;
    const renamed = this.expectations.filter((entry) => entry.reason === TEXT.reasons.uidRenamed).length;
    if (added > 0) this.notes.push(TEXT.notes.uidsAdded(added));
    if (renamed > 0) this.notes.push(TEXT.notes.uidsRenamed(renamed));
  }

  private usesPositions(): boolean {
    for (const element of this.elements) {
      for (const action of element.actions) {
        if (action.type === SWITCH_BY_INDEX) return true;
        const kinds = opcodeKinds(action);
        if ([action.targetA, action.targetB].some((value, side) => kinds[side] === TRIGGER_KIND && value !== NONE && !value.startsWith(UID_MARK))) return true;
      }
      for (const attribute of REFERENCE_ATTRIBUTES[element.tag] ?? []) {
        const value = attributeOf(element, attribute);
        if (value !== undefined && value !== NONE && !value.startsWith(UID_MARK)) return true;
      }
    }
    return false;
  }

  private canBeFunction(element: MapElement, stateTargets: ReadonlySet<string>): boolean {
    const uid = uidOf(element);
    if (this.positional || uid === undefined || this.firstByUid.get(uid) !== element || stateTargets.has(uid)) return false;
    if (attributeOf(element, ATTRIBUTE_NAME.enabled) === FALSE_TEXT || attributeOf(element, ATTRIBUTE_NAME.execute) === TRUE_TEXT) return false;
    const calls = attributeOf(element, ATTRIBUTE_NAME.maxcalls) ?? ONCE;
    if (calls !== UNLIMITED && !(isWholeNumber(calls) && Number(calls) >= 1)) return false;
    return element.actions.every((action) => opcodeByNumber(action.type) !== null);
  }

  private planTriggers(): void {
    const stateTargets = new Set<string>();
    for (const element of this.elements) {
      for (const action of element.actions) {
        if (TRIGGER_STATE_ACTIONS.has(action.type)) stateTargets.add(action.targetA);
        const kinds = opcodeKinds(action);
        if (kinds[0] !== TRIGGER_KIND) stateTargets.add(action.targetA);
        if (kinds[1] !== TRIGGER_KIND) stateTargets.add(action.targetB);
      }
      const references = REFERENCE_ATTRIBUTES[element.tag] ?? [];
      for (const [name, value] of element.attributes) if (name !== ATTRIBUTE_NAME.uid && !references.includes(name)) stateTargets.add(value);
    }
    for (const element of this.elements) {
      if (element.tag !== TAG.trigger) continue;
      if (this.canBeFunction(element, stateTargets)) {
        const name = this.namer.fromUid(uidOf(element) ?? '', true);
        this.functions.set(uidOf(element) ?? '', name);
        this.plans.set(element.index, { kind: 'function', element, name });
      } else {
        this.plans.set(element.index, { kind: 'rawTrigger', element, uid: this.finalUid.get(element.index) ?? '' });
      }
    }
    const raw = [...this.plans.values()].filter((plan) => plan.kind === 'rawTrigger').length;
    if (this.functions.size > 0) this.notes.push(TEXT.notes.functions(this.functions.size));
    if (raw > 0) this.notes.push(TEXT.notes.rawTriggers(raw));
  }

  private planTimers(): void {
    const referenced = new Set<string>();
    for (const element of this.elements) {
      for (const [name, value] of element.attributes) if (!(element.tag === TAG.timer && name === ATTRIBUTE_NAME.uid)) referenced.add(value);
      for (const action of element.actions) referenced.add(action.targetA).add(action.targetB);
    }
    let start = 0;
    let every = 0;
    for (const element of this.elements) {
      if (element.tag !== TAG.timer) continue;
      const uid = uidOf(element) ?? '';
      const target = attributeOf(element, ATTRIBUTE_NAME.target) ?? NONE;
      const functionName = this.firstByUid.get(uid) === element && !referenced.has(uid) ? this.functions.get(target) : undefined;
      const delay = attributeOf(element, ATTRIBUTE_NAME.delay) ?? '';
      const calls = attributeOf(element, ATTRIBUTE_NAME.maxcalls);
      const enabled = attributeOf(element, ATTRIBUTE_NAME.enabled) !== FALSE_TEXT;
      const targetElement = this.firstByUid.get(target);
      const safeToJoin = targetElement !== undefined && !targetElement.actions.some(stops);
      if (functionName !== undefined && enabled && isWholeNumber(delay) && Number(delay) >= 0 && calls === ONCE && safeToJoin) {
        this.plans.set(element.index, { kind: 'startTimer', element, functionName, delay: Number(delay) });
        start++;
      } else if (functionName !== undefined && enabled && isWholeNumber(delay) && Number(delay) > 0 && calls === UNLIMITED) {
        this.plans.set(element.index, { kind: 'everyTimer', element, functionName, delay: Number(delay) });
        every++;
      } else {
        this.plans.set(element.index, { kind: 'rawTimer', element, uid: this.finalUid.get(element.index) ?? '' });
      }
    }
    if (start > 0) this.notes.push(TEXT.notes.startTimers(start));
    if (every > 0) this.notes.push(TEXT.notes.everyTimers(every));
  }

  private planObjects(): void {
    const lastMark = new Map<string, number>();
    for (const element of this.elements) if (element.tag === TAG.inf) lastMark.set(attributeOf(element, ATTRIBUTE_NAME.mark) ?? '', element.index);
    for (const element of this.elements) {
      if (this.plans.has(element.index)) continue;
      if (constructorForTag(element.tag) === null) {
        this.plans.set(element.index, { kind: 'skipped', element, reason: TEXT.reasons.unknownTag(element.tag) });
        this.notes.push(TEXT.notes.unknownTag(element.tag));
        continue;
      }
      if (element.tag === TAG.inf && lastMark.get(attributeOf(element, ATTRIBUTE_NAME.mark) ?? '') !== element.index) {
        this.plans.set(element.index, { kind: 'skipped', element, reason: TEXT.reasons.markRepeated });
        this.notes.push(TEXT.notes.markRepeated(attributeOf(element, ATTRIBUTE_NAME.mark) ?? ''));
        continue;
      }
      this.plans.set(element.index, { kind: 'object', element, uid: this.finalUid.get(element.index) ?? null });
    }
  }

  private nameReferencedObjects(): void {
    const wanted = new Set<string>();
    for (const plan of this.plans.values()) {
      if (plan.kind !== 'function') continue;
      for (const action of plan.element.actions) for (const value of [action.targetA, action.targetB]) if (value.startsWith(UID_MARK)) wanted.add(value);
    }
    for (const uid of wanted) {
      const element = this.firstByUid.get(uid);
      const plan = element ? this.plans.get(element.index) : undefined;
      if (!element || !plan || (plan.kind !== 'object' && plan.kind !== 'rawTrigger' && plan.kind !== 'rawTimer')) continue;
      this.names.set(element.index, this.namer.fromUid(uid));
    }
    for (const plan of this.plans.values()) {
      if (plan.kind === 'function') {
        const calls = attributeOf(plan.element, ATTRIBUTE_NAME.maxcalls) ?? ONCE;
        if (calls === ONCE) this.namer.claim(plan.name + DONE_SUFFIX);
        else if (calls !== UNLIMITED) this.namer.claim(plan.name + CALLS_SUFFIX);
      }
    }
  }

  private keywordOf(tag: string): string | null {
    return Object.entries(OBJECT_KINDS).find(([, info]) => info.tags.includes(tag))?.[0] ?? null;
  }

  private objectArgument(value: string, kind: string): string {
    if (!value.startsWith(UID_MARK)) return this.plainArgument(value);
    if (kind === TRIGGER_KIND && this.functions.has(value)) return TEXT.reference(this.functions.get(value) ?? '');
    const element = this.firstByUid.get(value);
    const name = element ? this.names.get(element.index) : undefined;
    const keyword = element ? this.keywordOf(element.tag) : null;
    if (name !== undefined && keyword !== null && OBJECT_KINDS[keyword]?.paramKind === kind) return name;
    return quote(value);
  }

  private plainArgument(value: string): string {
    return isCanonicalNumber(value) ? value : quote(value);
  }

  private rawArgument(value: string, kind: string): string {
    if (kind === TRIGGER_KIND && value.startsWith(UID_MARK) && this.functions.has(value)) return TEXT.reference(this.functions.get(value) ?? '');
    return this.plainArgument(value);
  }

  private actionName(type: number): string {
    const alias = opcodeByNumber(type)?.alias;
    return alias !== null && alias !== undefined && IDENTIFIER.test(alias) ? alias : String(type);
  }

  private propertyValue(element: MapElement, attribute: string, raw: string, kind: string): string {
    if (raw.startsWith(UID_MARK) && this.functions.has(raw) && (REFERENCE_ATTRIBUTES[element.tag] ?? []).includes(attribute)) {
      this.expect(element, attribute, TEXT.reasons.reference);
      return TEXT.reference(this.functions.get(raw) ?? '');
    }
    const checked = checkValue(kind, { kind: 'text', text: raw });
    if (checked.kind !== 'text' || checked.text !== raw) return quote(raw);
    if (kind === BOOL_KIND && (raw === TRUE_TEXT || raw === FALSE_TEXT)) return raw;
    const entry = valueList(kind).entries.find((item) => item.value === raw);
    const name = entry?.names[0];
    if (name !== undefined && IDENTIFIER.test(name) && !this.namer.has(name)) return name;
    const group = entry ? valueGroup(valueList(kind).name) : null;
    if (name !== undefined && group !== null && group.members.get(name) === raw) return TEXT.qualified(group.name, name);
    return isCanonicalNumber(raw) ? raw : quote(raw);
  }

  private objectLine(plan: Extract<Plan, { kind: 'object' | 'rawTrigger' | 'rawTimer' }>): string[] {
    const { element } = plan;
    const constructorName = constructorForTag(element.tag) ?? '';
    const info = CONSTRUCTORS[constructorName];
    const rules = tagRules(element.tag);
    const defaults = rules?.defaults ?? {};
    const handled = new Set<string>([ATTRIBUTE_NAME.uid]);
    if (info?.positional[0] !== UID_ARGUMENT && uidOf(element) !== undefined) this.expect(element, ATTRIBUTE_NAME.uid, TEXT.reasons.unreadUid);
    const args: string[] = [];
    if (info?.positional[0] === UID_ARGUMENT) args.push(quote(this.finalUid.get(element.index) ?? ''));
    if (info?.positional[0] === MARK_ARGUMENT) {
      const mark = attributeOf(element, ATTRIBUTE_NAME.mark) ?? '';
      args.push(valueList(TEXT.markKind).members.get(mark) === mark && IDENTIFIER.test(mark) ? mark : quote(mark));
      handled.add(ATTRIBUTE_NAME.mark);
    }
    if (info?.positional === AREA_ARGUMENTS && info.positional.every((name) => attributeOf(element, name) !== undefined)) {
      for (const name of info.positional) args.push(this.propertyValue(element, name, attributeOf(element, name) ?? '', propertyOf(element.tag, name)?.kind ?? ''));
      for (const name of info.positional) handled.add(name);
    }
    const unread = UNREAD_ATTRIBUTES[element.tag] ?? [];
    for (const [name, raw] of element.attributes) {
      if (handled.has(name)) continue;
      handled.add(name);
      if (unread.includes(name)) {
        this.expect(element, name, TEXT.reasons.unread);
        continue;
      }
      if (element.tag === TAG.inf && name === MARK_VALUE) {
        const kind = markValueKind(attributeOf(element, ATTRIBUTE_NAME.mark) ?? '');
        if (kind === NO_VALUE_KIND && raw === defaults[name]) continue;
        args.push(TEXT.named(name, kind === NO_VALUE_KIND ? quote(raw) : this.propertyValue(element, name, raw, kind)));
        continue;
      }
      const property = propertyOf(element.tag, name);
      if (property === null) {
        this.expect(element, name, TEXT.reasons.unknownAttribute);
        this.notes.push(TEXT.notes.unknownAttribute(element.tag, name));
        continue;
      }
      if (defaults[name] === raw) continue;
      args.push(TEXT.named(name, this.propertyValue(element, name, raw, property.kind)));
    }
    if (element.tag === TAG.decor && attributeOf(element, ATTRIBUTE_NAME.front) === undefined && IN_FRONT_MODELS.has(attributeOf(element, ATTRIBUTE_NAME.model) ?? '')) {
      args.push(TEXT.named(ATTRIBUTE_NAME.front, quote(IN_FRONT_VALUE)));
      this.expect(element, ATTRIBUTE_NAME.front, TEXT.reasons.inFront);
    }
    const name = this.names.get(element.index);
    const call = TEXT.call(constructorName, args.join(ARGUMENT_SEPARATOR));
    const head = name === undefined ? call : TEXT.assign(name, call);
    if (plan.kind !== 'rawTrigger') return [INDENT + head + TEXT.end];
    const body = plan.element.actions.map((action) => {
      const [kindA, kindB] = opcodeKinds(action);
      return INDENT + INDENT + TEXT.action(this.actionName(action.type), [this.rawArgument(action.targetA, kindA), this.rawArgument(action.targetB, kindB)].join(ARGUMENT_SEPARATOR));
    });
    return [INDENT + head + TEXT.blockOpen, ...body, INDENT + TEXT.blockClose];
  }

  private functionLines(plan: Extract<Plan, { kind: 'function' }>): string[] {
    const { element, name } = plan;
    const calls = attributeOf(element, ATTRIBUTE_NAME.maxcalls) ?? ONCE;
    const lines = [TEXT.functionComment(uidOf(element) ?? '', this.callers(uidOf(element) ?? '')), TEXT.functionOpen(name)];
    if (calls === ONCE) lines.push(...TEXT.onceGuard(name + DONE_SUFFIX).map((line) => INDENT + line));
    else if (calls !== UNLIMITED) lines.push(...TEXT.countGuard(name + CALLS_SUFFIX, calls).map((line) => INDENT + line));
    for (const action of element.actions) {
      const [kindA, kindB] = opcodeKinds(action);
      if (action.type === SHOW_TEXT && TEXT.sayColor.test(action.targetB)) {
        lines.push(INDENT + TEXT.say(quote(action.targetA), this.plainArgument(action.targetB)));
        continue;
      }
      const opcode = opcodeByNumber(action.type);
      const argumentA = kindA === TRIGGER_KIND || kindA === TIMER_KIND || isObjectKind(kindA) ? this.objectArgument(action.targetA, kindA) : this.plainArgument(action.targetA);
      const argumentB = kindB === TRIGGER_KIND || kindB === TIMER_KIND || isObjectKind(kindB) ? this.objectArgument(action.targetB, kindB) : this.plainArgument(action.targetB);
      const comment = opcode?.alias === undefined || opcode.alias === null ? TEXT.describe(opcode?.description ?? '') : '';
      lines.push(INDENT + TEXT.action(this.actionName(action.type), [argumentA, argumentB].join(ARGUMENT_SEPARATOR)) + comment);
    }
    lines.push(TEXT.blockClose);
    return lines;
  }

  private callers(uid: string): string {
    const found: string[] = [];
    for (const element of this.elements) {
      if (uidOf(element) === uid && element.tag === TAG.trigger) continue;
      if (element.attributes.some(([, value]) => value === uid) || element.actions.some((action) => action.targetA === uid || action.targetB === uid)) {
        found.push(uidOf(element) ?? element.tag);
      }
    }
    return found.join(ARGUMENT_SEPARATOR);
  }

  private write(plans: readonly Plan[]): string {
    const lines: string[] = [...TEXT.header(this.options.label), ...this.notes.map(TEXT.comment), ''];
    const guards: string[] = [];
    for (const plan of plans) {
      if (plan.kind !== 'function') continue;
      const calls = attributeOf(plan.element, ATTRIBUTE_NAME.maxcalls) ?? ONCE;
      if (calls === ONCE) guards.push(TEXT.variable(plan.name + DONE_SUFFIX));
      else if (calls !== UNLIMITED) guards.push(TEXT.variable(plan.name + CALLS_SUFFIX));
    }
    if (guards.length > 0) lines.push(...guards, '');
    lines.push(TEXT.mapOpen);
    for (const plan of plans) {
      if (plan.kind === 'object' || plan.kind === 'rawTrigger' || plan.kind === 'rawTimer') lines.push(...this.objectLine(plan));
      else if (plan.kind === 'skipped') lines.push(INDENT + TEXT.comment(TEXT.skipped(plan.element.tag, plan.reason)));
    }
    lines.push(TEXT.blockClose);
    const starts = plans.filter((plan): plan is Extract<Plan, { kind: 'startTimer' }> => plan.kind === 'startTimer').sort((first, second) => first.delay - second.delay);
    if (starts.length > 0) {
      lines.push('', TEXT.startOpen);
      let waited = 0;
      for (const plan of starts) {
        if (plan.delay > waited) lines.push(INDENT + TEXT.wait(plan.delay - waited));
        waited = Math.max(waited, plan.delay);
        lines.push(INDENT + TEXT.callFunction(plan.functionName));
      }
      lines.push(TEXT.blockClose);
    }
    for (const plan of plans) {
      if (plan.kind === 'everyTimer') lines.push('', TEXT.every(plan.delay, plan.functionName));
    }
    for (const plan of plans) if (plan.kind === 'function') lines.push('', ...this.functionLines(plan));
    return lines.join(LINE_END) + LINE_END;
  }
}

const isObjectKind = (kind: string): boolean => Object.values(OBJECT_KINDS).some((info) => info.paramKind === kind);

export const convertMap = (xml: string, options: ConvertOptions): Conversion => new Converter(xml, options).run();

