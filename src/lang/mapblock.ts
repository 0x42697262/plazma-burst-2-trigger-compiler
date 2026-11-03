import type { Declaration, Expression, Location, MatchArm, SourceFile, Statement, TemplatePart } from './ast.ts';
import { SourceError } from './lexer.ts';
import { generate } from './codegen.ts';
import { compileModule, DEFAULT_OPTIONS } from '../compiler/compile.ts';
import { createNames } from '../compiler/names.ts';
import { Simulation } from '../sim/simulator.ts';
import { COMPILE_TIME_ACTIONS } from '../opcodes/constants.ts';
import { valueList } from '../opcodes/values.ts';
import { CONSTRUCTORS, MARK_ARGUMENT, MARK_VALUE, NO_VALUE_KIND, OBJECT_KINDS, OPEN_LISTS, UID_ARGUMENT } from '../objects/keys.ts';
import type { ConstructorInfo } from '../objects/keys.ts';
import { constructorOf, markValueKind, markValueKinds, propertyOf, tagsWithProperty } from '../objects/properties.ts';
import { checkValue } from '../objects/value-check.ts';
import type { BuildValue } from '../objects/value-check.ts';
import { COMPILE_TIME_MAX_STEPS } from './constants.ts';
import { escapeXml } from '../emit/xml-emitter.ts';
import { editorTurnsIntoNumber } from '../program/editor-text.ts';
import { callGraph, reachable } from './calls.ts';
import {
  BUILD_NAMES, BUILD_RECORD, BUILD_SUFFIX, BUILTIN, COMPILE_TIME_PREFIX, EVENT, FORBIDDEN_IN_MAP, MAP_MARK, MARK_KIND, MARK_TYPE, ONE_TEXT, OPEN_LIST, PROPERTY_ARITY, TEXT_KIND, UID_MARK, ZERO_TEXT,
} from './keys.ts';
import { MAP_TEXT as TEXT, TEXT as LANG_TEXT } from './text.ts';

export type AttributeValue = { kind: 'text'; text: string } | { kind: 'function'; name: string };
export type BuiltObject = {
  constructorName: string; tag: string; keyword: string | null; uid: string | null; mark: string | null;
  set: [string, AttributeValue][]; initial: [string, AttributeValue][]; location: Location;
};
export type MapBuild = { file: SourceFile; objects: BuiltObject[]; references: ReadonlySet<string>; functions: ReadonlySet<string>; warnings: string[] };

type ConstructSite = { kind: 'construct'; constructorName: string; info: ConstructorInfo; attributes: string[]; location: Location };
type PropertySite = { kind: 'property'; property: string; initial: boolean; location: Location };
type Site = ConstructSite | PropertySite;
type MapName = { name: string; array: boolean; location: Location };
type GlobalEntry = { kind: Declaration['kind']; keyword: string | null; uid: string | null; array: boolean };
type RawObject = { site: ConstructSite; values: BuildValue[]; properties: { site: PropertySite; value: BuildValue }[] };

const WHERE = (location: Location, message: string): string => LANG_TEXT.where(location.line, message, location.file);

const fail = (location: Location, message: string): never => {
  throw new SourceError(location.line, message, location.file);
};

const text = (value: string, location: Location): Expression => ({ kind: 'string', parts: [{ kind: 'text', text: value }], location });
const nameOf = (name: string, location: Location): Expression => ({ kind: 'name', name, location });
const call = (callee: string, args: Expression[], location: Location): Expression => ({ kind: 'call', callee, args, location });
const concat = (parts: Expression[], location: Location): Expression =>
  parts.slice(1).reduce((left, right): Expression => ({ kind: 'binary', operator: '..', left, right, location }), parts[0] ?? text('', location));
const appendLog = (log: string, parts: Expression[], location: Location): Statement =>
  ({ kind: 'assign', target: { kind: 'name', name: log }, operator: '..', value: concat(parts, location), location });
const marker = (type: string, fields: readonly string[]): string => MAP_MARK.start + type + fields.join(MAP_MARK.field);

const RESERVED_CHARACTERS: readonly string[] = [MAP_MARK.start, MAP_MARK.field, MAP_MARK.record, MAP_MARK.unit];

function namesInExpression(expression: Expression | null, found: Set<string>): void {
  if (expression === null) return;
  switch (expression.kind) {
    case 'name':
      found.add(expression.name);
      return;
    case 'index':
      found.add(expression.array);
      namesInExpression(expression.index, found);
      for (const more of expression.more ?? []) namesInExpression(more, found);
      return;
    case 'call':
      found.add(expression.callee);
      for (const argument of expression.args) namesInExpression(argument, found);
      return;
    case 'construct':
      for (const argument of expression.args) namesInExpression(argument, found);
      for (const argument of expression.named) namesInExpression(argument.value, found);
      return;
    case 'array':
      for (const element of expression.elements) namesInExpression(element, found);
      return;
    case 'member':
      found.add(expression.object);
      return;
    case 'unary':
      namesInExpression(expression.operand, found);
      return;
    case 'binary':
      namesInExpression(expression.left, found);
      namesInExpression(expression.right, found);
      return;
    case 'string':
      for (const part of expression.parts) if (part.kind === 'expression') namesInExpression(part.expression, found);
      return;
    default:
      return;
  }
}

function namesInStatements(statements: readonly Statement[], found: Set<string>): void {
  for (const statement of statements) {
    switch (statement.kind) {
      case 'let':
        found.add(statement.name);
        namesInExpression(statement.value, found);
        break;
      case 'assign':
        found.add(statement.target.kind === 'name' ? statement.target.name : statement.target.array);
        if (statement.target.kind === 'index') namesInExpression(statement.target.index, found);
        namesInExpression(statement.value, found);
        break;
      case 'property':
        found.add(statement.object);
        namesInExpression(statement.value, found);
        break;
      case 'expression':
        namesInExpression(statement.expression, found);
        break;
      case 'if':
        namesInExpression(statement.condition, found);
        namesInStatements(statement.then, found);
        namesInStatements(statement.otherwise ?? [], found);
        break;
      case 'while':
        namesInExpression(statement.condition, found);
        namesInStatements(statement.body, found);
        break;
      case 'for':
        namesInStatements(statement.init ? [statement.init] : [], found);
        namesInExpression(statement.condition, found);
        namesInStatements(statement.step ? [statement.step] : [], found);
        namesInStatements(statement.body, found);
        break;
      case 'forPlayer':
      case 'block':
        namesInStatements(statement.body, found);
        break;
      case 'match':
        namesInExpression(statement.subject, found);
        for (const arm of statement.arms) {
          for (const pattern of arm.patterns ?? []) namesInExpression(pattern, found);
          namesInStatements(arm.body, found);
        }
        break;
      case 'return':
        namesInExpression(statement.value, found);
        break;
      case 'wait':
        namesInExpression(statement.frames, found);
        break;
      default:
        break;
    }
  }
}

class Scopes {
  private readonly stack: Set<string>[] = [];

  enter(): void {
    this.stack.push(new Set());
  }

  leave(): void {
    this.stack.pop();
  }

  declare(name: string): void {
    this.stack[this.stack.length - 1]?.add(name);
  }

  has(name: string): boolean {
    return this.stack.some((scope) => scope.has(name));
  }

  within<T>(work: () => T): T {
    this.enter();
    try {
      return work();
    } finally {
      this.leave();
    }
  }
}

function collectMapNames(blocks: readonly Statement[][], globals: ReadonlyMap<string, GlobalEntry>): Map<string, MapName> {
  const found = new Map<string, MapName>();
  const scopes = new Scopes();
  const visit = (statements: readonly Statement[]): void => scopes.within(() => {
    for (const statement of statements) {
      switch (statement.kind) {
        case 'let':
          scopes.declare(statement.name);
          break;
        case 'assign': {
          if (statement.target.kind !== 'name') break;
          const name = statement.target.name;
          if (scopes.has(name) || globals.has(name)) break;
          const array = statement.value.kind === 'array';
          const known = found.get(name);
          if (known && known.array !== array) fail(statement.location, TEXT.arrayAndValue(name));
          if (!known) found.set(name, { name, array, location: statement.location });
          break;
        }
        case 'if':
          visit(statement.then);
          visit(statement.otherwise ?? []);
          break;
        case 'while':
        case 'forPlayer':
        case 'block':
          visit(statement.body);
          break;
        case 'for':
          scopes.within(() => {
            visit(statement.init ? [statement.init] : []);
            if (statement.init?.kind === 'let') scopes.declare(statement.init.name);
            visit(statement.step ? [statement.step] : []);
            visit(statement.body);
          });
          break;
        case 'match':
          for (const arm of statement.arms) visit(arm.body);
          break;
        default:
          break;
      }
    }
  });
  for (const block of blocks) visit(block);
  return found;
}

class MapTransformer {
  readonly sites: Site[] = [];
  readonly called = new Set<string>();
  readonly references = new Set<string>();
  readonly functionsCode: Declaration[] = [];
  private readonly scopes = new Scopes();
  private readonly globals: ReadonlyMap<string, GlobalEntry>;
  private readonly mapNames: ReadonlyMap<string, MapName>;
  private readonly names: Record<keyof typeof BUILD_NAMES, string>;

  constructor(globals: ReadonlyMap<string, GlobalEntry>, mapNames: ReadonlyMap<string, MapName>, names: Record<keyof typeof BUILD_NAMES, string>) {
    this.globals = globals;
    this.mapNames = mapNames;
    this.names = names;
  }

  private declared(name: string): boolean {
    return this.scopes.has(name) || this.mapNames.has(name) || this.globals.has(name);
  }

  block(statements: readonly Statement[], location: Location): Statement {
    return { kind: 'block', body: this.scopes.within(() => statements.map((statement) => this.statement(statement))), location };
  }

  private body(statements: readonly Statement[]): Statement[] {
    return this.scopes.within(() => statements.map((statement) => this.statement(statement)));
  }

  private statement(statement: Statement): Statement {
    switch (statement.kind) {
      case 'let':
        if (statement.value?.kind === 'array') fail(statement.location, TEXT.arrayNeedsName);
        this.scopes.declare(statement.name);
        return { ...statement, value: statement.value === null ? null : this.expression(statement.value) };
      case 'assign':
        return this.assign(statement);
      case 'property':
        return this.property(statement);
      case 'expression':
        return { ...statement, expression: this.expression(statement.expression) };
      case 'if':
        return { ...statement, condition: this.expression(statement.condition), then: this.body(statement.then), otherwise: statement.otherwise === null ? null : this.body(statement.otherwise) };
      case 'while':
        return { ...statement, condition: this.expression(statement.condition), body: this.body(statement.body) };
      case 'for':
        return this.scopes.within(() => {
          const init = statement.init === null ? null : this.statement(statement.init);
          return {
            ...statement, init, condition: statement.condition === null ? null : this.expression(statement.condition),
            step: statement.step === null ? null : this.statement(statement.step), body: this.body(statement.body),
          };
        });
      case 'block':
        return { ...statement, body: this.body(statement.body) };
      case 'match':
        return {
          ...statement, subject: this.expression(statement.subject),
          arms: statement.arms.map((arm): MatchArm => ({ ...arm, patterns: arm.patterns?.map((pattern) => this.expression(pattern)) ?? null, body: this.body(arm.body) })),
        };
      case 'break':
      case 'continue':
        return statement;
      case 'return':
      case 'wait':
      case 'forPlayer':
        return fail(statement.location, TEXT.notInMap(statement.kind));
      default:
        return statement;
    }
  }

  private assign(statement: Extract<Statement, { kind: 'assign' }>): Statement {
    const { target, location } = statement;
    if (target.kind === 'index') {
      const global = this.globals.get(target.array);
      if (global && !this.mapNames.has(target.array)) fail(location, TEXT.changesProgram(target.array));
      return { ...statement, target: { ...target, index: this.expression(target.index) }, value: this.expression(statement.value) };
    }
    const local = this.scopes.has(target.name);
    if (!local && !this.mapNames.has(target.name) && this.globals.has(target.name)) fail(location, TEXT.changesProgram(target.name));
    if (statement.value.kind !== 'array') return { ...statement, value: this.expression(statement.value) };
    if (local || statement.operator !== null) return fail(location, TEXT.arrayNeedsName);
    const elements = statement.value.elements.map((element): Statement => {
      if (element.kind === 'array') fail(element.location, TEXT.nestedArray);
      return { kind: 'expression', expression: call(BUILTIN.push, [nameOf(target.name, location), this.expression(element)], location), location };
    });
    return { kind: 'block', body: [{ kind: 'expression', expression: call(BUILTIN.clear, [nameOf(target.name, location)], location), location }, ...elements], location };
  }

  private property(statement: Extract<Statement, { kind: 'property' }>): Statement {
    const { object, property, location } = statement;
    const global = this.globals.get(object);
    if (!this.scopes.has(object) && !this.mapNames.has(object)) {
      if (global?.keyword) fail(location, TEXT.hostProperty(object));
      fail(location, TEXT.unknownMapName(object));
    }
    if (property === UID_ARGUMENT || property === MARK_ARGUMENT) fail(location, TEXT.positionalProperty(property));
    const tags = tagsWithProperty(property);
    if (tags.length === 0) fail(location, TEXT.unknownProperty(property));
    const candidates = new Set(tags.flatMap((tag) => this.candidatesFor(tag, property)));
    if (tags.some((tag) => this.isOpen(tag, property))) candidates.add(OPEN_LIST);
    const site: PropertySite = { kind: 'property', property, initial: statement.initial, location };
    this.sites.push(site);
    const callee = this.siteFunction(this.sites.length - 1, PROPERTY_ARITY, location);
    return { kind: 'expression', expression: call(callee, [nameOf(object, location), this.value(statement.value, candidates)], location), location };
  }

  private candidatesFor(tag: string, attribute: string): string[] {
    if (attribute === MARK_VALUE && tag === CONSTRUCTORS.EngineMark?.tag) return markValueKinds().flatMap((kind) => [...valueList(kind).members.keys()]);
    const kind = attribute === MARK_ARGUMENT ? MARK_KIND : propertyOf(tag, attribute)?.kind;
    return kind === undefined ? [] : [...valueList(kind).members.keys()];
  }

  private isOpen(tag: string, attribute: string): boolean {
    const kind = propertyOf(tag, attribute)?.kind;
    return kind !== undefined && OPEN_LISTS.has(kind);
  }

  private valueNames(tag: string, attribute: string): Set<string> {
    const names = new Set(this.candidatesFor(tag, attribute));
    if (this.isOpen(tag, attribute)) names.add(OPEN_LIST);
    return names;
  }

  private value(expression: Expression, candidates: ReadonlySet<string>): Expression {
    const location = expression.location;
    switch (expression.kind) {
      case 'name':
        if (!candidates.has(expression.name) && candidates.has(OPEN_LIST) && !this.declared(expression.name)) return text(marker(MARK_TYPE.name, [expression.name]), location);
        if (!candidates.has(expression.name)) return this.expression(expression);
        if (this.declared(expression.name)) return fail(location, TEXT.valueNameClash(expression.name));
        return text(marker(MARK_TYPE.name, [expression.name]), location);
      case 'named':
        return text(marker(MARK_TYPE.named, [expression.group, expression.text]), location);
      case 'reference':
        if (!this.globals.has(expression.name) || this.globals.get(expression.name)?.kind !== 'function') fail(location, TEXT.unknownFunction(expression.name));
        this.references.add(expression.name);
        return text(marker(MARK_TYPE.function, [expression.name]), location);
      default:
        return this.expression(expression);
    }
  }

  private expression(expression: Expression): Expression {
    const location = expression.location;
    switch (expression.kind) {
      case 'name': {
        if (this.scopes.has(expression.name) || this.mapNames.has(expression.name)) return expression;
        const global = this.globals.get(expression.name);
        if (global?.keyword && global.uid !== null) return text(marker(MARK_TYPE.host, [OBJECT_KINDS[global.keyword]?.tags[0] ?? global.keyword, global.uid]), location);
        if (global?.keyword) return fail(location, TEXT.hostArray(expression.name));
        return expression;
      }
      case 'string':
        return { ...expression, parts: expression.parts.map((part): TemplatePart => {
          if (part.kind === 'expression') return { kind: 'expression', expression: this.expression(part.expression) };
          if (RESERVED_CHARACTERS.some((character) => part.text.includes(character))) fail(location, TEXT.reservedCharacter);
          return part;
        }) };
      case 'index': {
        const global = this.globals.get(expression.array);
        if (global?.keyword && !this.mapNames.has(expression.array) && !this.scopes.has(expression.array)) fail(location, TEXT.hostArray(expression.array));
        return { ...expression, index: this.expression(expression.index), ...(expression.more ? { more: expression.more.map((more) => this.expression(more)) } : {}) };
      }
      case 'call':
        if (FORBIDDEN_IN_MAP.has(expression.callee)) fail(location, TEXT.forbiddenCall(expression.callee));
        if (this.globals.get(expression.callee)?.kind === 'function') this.called.add(expression.callee);
        return { ...expression, args: expression.args.map((argument) => this.expression(argument)) };
      case 'construct':
        return this.construct(expression);
      case 'array':
        return fail(location, TEXT.arrayNeedsName);
      case 'member':
        return fail(location, TEXT.propertyRead(expression.object, expression.property));
      case 'reference':
        return fail(location, TEXT.referenceOutsideValue);
      case 'unary':
        return { ...expression, operand: this.expression(expression.operand) };
      case 'binary':
        return { ...expression, left: this.expression(expression.left), right: this.expression(expression.right) };
      default:
        return expression;
    }
  }

  private construct(expression: Extract<Expression, { kind: 'construct' }>): Expression {
    const { location } = expression;
    const info = constructorOf(expression.name) ?? fail(location, TEXT.unknownConstructor(expression.name));
    if (expression.args.length > info.positional.length) fail(location, TEXT.tooManyPositional(expression.name, info.positional));
    const required = info.positional[0];
    if (expression.args.length === 0 && (required === UID_ARGUMENT || required === MARK_ARGUMENT)) fail(location, TEXT.missingPositional(expression.name, required));
    const attributes = info.positional.slice(0, expression.args.length);
    const values = expression.args.map((argument, position) => this.value(argument, this.valueNames(info.tag, info.positional[position] ?? '')));
    for (const argument of expression.named) {
      if (argument.name === UID_ARGUMENT || argument.name === MARK_ARGUMENT) fail(argument.location, TEXT.positionalProperty(argument.name));
      if (attributes.includes(argument.name)) fail(argument.location, TEXT.duplicateArgument(expression.name, argument.name));
      const known = argument.name === MARK_VALUE && info.tag === CONSTRUCTORS.EngineMark?.tag ? true : propertyOf(info.tag, argument.name) !== null;
      if (!known) fail(argument.location, TEXT.noSuchProperty(expression.name, argument.name, info.tag));
      attributes.push(argument.name);
      values.push(this.value(argument.value, this.valueNames(info.tag, argument.name)));
    }
    const site: ConstructSite = { kind: 'construct', constructorName: expression.name, info, attributes, location };
    this.sites.push(site);
    return call(this.siteFunction(this.sites.length - 1, values.length, location), values, location);
  }

  private siteFunction(index: number, arity: number, location: Location): string {
    const site = this.sites[index] as Site;
    const name = `${this.names.function}${index}`;
    const params = Array.from({ length: arity }, (_, position) => `${this.names.parameter}${position}`);
    const unit = text(MAP_MARK.unit, location);
    const fields = params.flatMap((parameter) => [unit, nameOf(parameter, location)]);
    const body: Statement[] = site.kind === 'construct'
      ? [
        { kind: 'assign', target: { kind: 'name', name: this.names.count }, operator: '+', value: { kind: 'number', text: ONE_TEXT, location }, location },
        appendLog(this.names.log, [text(MAP_MARK.record + BUILD_RECORD.object + MAP_MARK.unit + String(index), location), unit, nameOf(this.names.count, location), ...fields], location),
        { kind: 'return', value: concat([text(MAP_MARK.start + MARK_TYPE.object, location), nameOf(this.names.count, location)], location), location },
      ]
      : [appendLog(this.names.log, [text(MAP_MARK.record + BUILD_RECORD.property + MAP_MARK.unit + String(index), location), ...fields], location)];
    this.functionsCode.push({ kind: 'function', name, params, body, exported: false, location });
    return name;
  }
}

function freshNames(taken: ReadonlySet<string>): Record<keyof typeof BUILD_NAMES, string> {
  const result = {} as Record<keyof typeof BUILD_NAMES, string>;
  const used = new Set(taken);
  for (const [key, base] of Object.entries(BUILD_NAMES) as [keyof typeof BUILD_NAMES, string][]) {
    let candidate = base;
    while ([...used].some((name) => name === candidate || name.startsWith(candidate))) candidate += BUILD_SUFFIX;
    used.add(candidate);
    result[key] = candidate;
  }
  return result;
}

function globalsOf(file: SourceFile): Map<string, GlobalEntry> {
  const globals = new Map<string, GlobalEntry>();
  for (const declaration of file.declarations) {
    switch (declaration.kind) {
      case 'var':
        globals.set(declaration.name, { kind: declaration.kind, keyword: null, uid: null, array: declaration.array });
        break;
      case 'const':
      case 'extern':
      case 'function':
        globals.set(declaration.name, { kind: declaration.kind, keyword: null, uid: null, array: false });
        break;
      case 'object':
        globals.set(declaration.name, { kind: declaration.kind, keyword: declaration.keyword, uid: declaration.tree === null ? declaration.uid : null, array: declaration.tree !== null });
        break;
      default:
        break;
    }
  }
  return globals;
}

function parseValue(raw: string, objects: readonly RawObject[], location: Location): BuildValue {
  if (!raw.includes(MAP_MARK.start)) return { kind: 'text', text: raw };
  if (!raw.startsWith(MAP_MARK.start)) return fail(location, TEXT.markerInText);
  const type = raw.charAt(MAP_MARK.start.length);
  const fields = raw.slice(MAP_MARK.start.length + type.length).split(MAP_MARK.field);
  const [first = '', second = ''] = fields;
  switch (type) {
    case MARK_TYPE.object: {
      const object = objects[Number(first) - 1] ?? fail(location, TEXT.markerInText);
      return { kind: 'object', tag: object.site.info.tag, uid: uidOf(object) };
    }
    case MARK_TYPE.host:
      return { kind: 'object', tag: first, uid: second };
    case MARK_TYPE.name:
      return { kind: 'name', name: first };
    case MARK_TYPE.named:
      return { kind: 'named', group: first, text: second };
    case MARK_TYPE.function:
      return { kind: 'function', name: first };
    default:
      return fail(location, TEXT.markerInText);
  }
}

function uidOf(object: RawObject): string | null {
  const position = object.site.attributes.indexOf(UID_ARGUMENT);
  const value = object.values[position];
  return value?.kind === 'text' ? value.text : null;
}

function objectIndex(raw: string): number | null {
  const prefix = MAP_MARK.start + MARK_TYPE.object;
  return raw.startsWith(prefix) ? Number(raw.slice(prefix.length)) : null;
}

function resolveObject(object: RawObject): BuiltObject {
  const { site } = object;
  const { info, constructorName, location } = site;
  const take = (attribute: string): BuildValue | null => {
    const position = site.attributes.indexOf(attribute);
    return position < 0 ? null : object.values[position] ?? null;
  };
  let uid: string | null = null;
  if (info.positional.includes(UID_ARGUMENT)) {
    const value = take(UID_ARGUMENT);
    if (value?.kind !== 'text' || !value.text.startsWith(UID_MARK) || value.text.length === UID_MARK.length) fail(location, TEXT.badUid(constructorName));
    uid = value?.kind === 'text' ? value.text : null;
  }
  let mark: string | null = null;
  if (info.positional.includes(MARK_ARGUMENT)) {
    const checked = checkValue(MARK_KIND, take(MARK_ARGUMENT) ?? { kind: 'text', text: '' });
    if (checked.kind !== 'text') fail(location, TEXT.badValue(constructorName, MARK_ARGUMENT, checked.kind === 'error' ? checked.message : ''));
    mark = checked.kind === 'text' ? checked.text : null;
  }
  const resolve = (attribute: string, value: BuildValue, at: Location): AttributeValue => {
    const kind = attribute === MARK_VALUE && mark !== null ? markValueKind(mark) : propertyOf(info.tag, attribute)?.kind ?? '';
    if (attribute === MARK_VALUE && mark !== null && kind === NO_VALUE_KIND) fail(at, TEXT.markTakesNoValue(mark));
    const checked = checkValue(kind, value);
    if (checked.kind === 'error') return fail(at, TEXT.badValue(constructorName, attribute, checked.message));
    return checked.kind === 'text' ? { kind: 'text', text: checked.text } : { kind: 'function', name: checked.name };
  };
  const set: [string, AttributeValue][] = [];
  const initial: [string, AttributeValue][] = [];
  if (mark !== null) set.push([MARK_ARGUMENT, { kind: 'text', text: mark }]);
  site.attributes.forEach((attribute, position) => {
    if (attribute === UID_ARGUMENT || attribute === MARK_ARGUMENT) return;
    set.push([attribute, resolve(attribute, object.values[position] ?? { kind: 'text', text: '' }, location)]);
  });
  for (const { site: propertySite, value } of object.properties) {
    if (propertyOf(info.tag, propertySite.property) === null && !(propertySite.property === MARK_VALUE && mark !== null)) {
      fail(propertySite.location, TEXT.noSuchProperty(constructorName, propertySite.property, info.tag));
    }
    (propertySite.initial ? initial : set).push([propertySite.property, resolve(propertySite.property, value, propertySite.location)]);
  }
  return { constructorName, tag: info.tag, keyword: info.keyword, uid, mark, set, initial, location };
}

function bindings(mapNames: readonly MapName[], records: readonly string[][], objects: readonly RawObject[], built: readonly BuiltObject[]): Declaration[] {
  const values = new Map<number, string[]>();
  for (const fields of records) {
    const [type, index = '', value = ''] = fields;
    if (type !== BUILD_RECORD.bind && type !== BUILD_RECORD.element) continue;
    values.set(Number(index), [...(values.get(Number(index)) ?? []), value]);
  }
  const declarations: Declaration[] = [];
  mapNames.forEach((entry, index) => {
    const found = values.get(index) ?? [];
    const parsed = found.map((raw) => ({ raw, value: parseValue(raw, objects, entry.location) }));
    const objectValues = parsed.filter((item) => item.value.kind === 'object');
    if (objectValues.length === 0) return;
    if (objectValues.length !== parsed.length) fail(entry.location, TEXT.mixedValues(entry.name));
    const described = objectValues.map(({ raw, value }) => {
      const mapIndex = objectIndex(raw);
      const object = mapIndex === null ? null : built[mapIndex - 1] ?? null;
      const tag = value.kind === 'object' ? value.tag : '';
      const keyword = object ? object.keyword : Object.entries(OBJECT_KINDS).find(([, info]) => info.tags.includes(tag))?.[0] ?? null;
      return { keyword, uid: value.kind === 'object' ? value.uid : null, built: object !== null, constructorName: object?.constructorName ?? tag };
    });
    const withoutUid = described.find((item) => item.keyword === null || item.uid === null);
    if (withoutUid) {
      if (!entry.array) return;
      fail(entry.location, TEXT.noUidInArray(entry.name, withoutUid.constructorName));
    }
    const first = described[0];
    const other = described.findIndex((item) => item.keyword !== first?.keyword);
    if (other >= 0) fail(entry.location, TEXT.mixedKinds(entry.name, first?.keyword ?? '', other, described[other]?.keyword ?? ''));
    const keyword = first?.keyword ?? '';
    const isBuilt = described.some((item) => item.built);
    if (entry.array) declarations.push({ kind: 'object', keyword, name: entry.name, uid: '', x: null, y: null, tree: described.map((item) => item.uid ?? ''), built: isBuilt, location: entry.location });
    else declarations.push({ kind: 'object', keyword, name: entry.name, uid: first?.uid ?? '', x: null, y: null, tree: null, built: isBuilt, location: entry.location });
  });
  return declarations;
}

export function buildMaps(file: SourceFile): MapBuild {
  const blocks = file.declarations.flatMap((declaration) => (declaration.kind === 'map' ? [declaration] : []));
  if (blocks.length === 0) return { file, objects: [], references: new Set(), functions: new Set(), warnings: [] };
  const first = blocks[0] as Extract<Declaration, { kind: 'map' }>;
  const globals = globalsOf(file);
  const mapNames = collectMapNames(blocks.map((block) => block.body), globals);
  const taken = new Set<string>([...globals.keys(), ...mapNames.keys()]);
  namesInStatements(blocks.flatMap((block) => block.body), taken);
  const names = freshNames(taken);
  const transformer = new MapTransformer(globals, mapNames, names);
  const location = first.location;
  const body = blocks.map((block) => transformer.block(block.body, block.location));
  const mapNameList = [...mapNames.values()];
  mapNameList.forEach((entry, index) => {
    const tag = text(MAP_MARK.record + (entry.array ? BUILD_RECORD.element : BUILD_RECORD.bind) + MAP_MARK.unit + String(index) + MAP_MARK.unit, location);
    if (!entry.array) {
      body.push(appendLog(names.log, [tag, nameOf(entry.name, location)], location));
      return;
    }
    const counter = names.counter;
    body.push({
      kind: 'for', location,
      init: { kind: 'let', name: counter, value: { kind: 'number', text: ZERO_TEXT, location }, location },
      condition: { kind: 'binary', operator: '<', left: nameOf(counter, location), right: call(BUILTIN.len, [nameOf(entry.name, location)], location), location },
      step: { kind: 'assign', target: { kind: 'name', name: counter }, operator: '+', value: { kind: 'number', text: ONE_TEXT, location }, location },
      body: [appendLog(names.log, [tag, { kind: 'index', array: entry.name, index: nameOf(counter, location), location }], location)],
    });
  });
  const reach = reachable(callGraph(file));
  const needed = new Set<string>();
  for (const name of transformer.called) {
    needed.add(name);
    for (const callee of reach.get(name) ?? []) needed.add(callee);
  }
  const mentioned = new Set<string>();
  namesInStatements(blocks.flatMap((block) => block.body), mentioned);
  for (const declaration of file.declarations) if (declaration.kind === 'function' && needed.has(declaration.name)) namesInStatements(declaration.body, mentioned);
  const kept = file.declarations.flatMap((declaration): Declaration[] => {
    switch (declaration.kind) {
      case 'const':
      case 'extern':
      case 'object':
        return [declaration];
      case 'var':
        return [mentioned.has(declaration.name) ? declaration : { ...declaration, value: null }];
      case 'function':
        return needed.has(declaration.name) ? [declaration] : [];
      default:
        return [];
    }
  });
  const program: SourceFile = {
    imports: [],
    declarations: [
      ...kept,
      { kind: 'var', name: names.log, array: false, value: text('', location), exported: false, location },
      { kind: 'var', name: names.count, array: false, value: { kind: 'number', text: ZERO_TEXT, location }, exported: false, location },
      ...mapNameList.map((entry): Declaration => ({ kind: 'var', name: entry.name, array: entry.array, value: null, exported: false, location: entry.location })),
      ...transformer.functionsCode,
      { kind: 'on', event: EVENT.start, body, location },
    ],
  };
  const compileNames = createNames(COMPILE_TIME_PREFIX);
  let simulation: Simulation;
  try {
    const compiled = compileModule(generate(program, compileNames, { protectNumberText: false, directIndex: false }), compileNames, { ...DEFAULT_OPTIONS, loopGuard: null });
    simulation = new Simulation(compiled.program, { allowedActions: COMPILE_TIME_ACTIONS, maxSteps: COMPILE_TIME_MAX_STEPS });
    simulation.tick();
  } catch (error) {
    if (error instanceof SourceError) throw error;
    return fail(location, TEXT.buildFailed(error instanceof Error ? error.message : String(error)));
  }
  const [problem] = simulation.errors;
  if (problem !== undefined) fail(location, TEXT.buildFailed(problem));
  const logValue = simulation.variables[compileNames.variable(names.log)];
  const log = typeof logValue === 'string' ? logValue : '';
  const records = log.split(MAP_MARK.record).slice(1).map((record) => record.split(MAP_MARK.unit));
  const objects: RawObject[] = [];
  for (const fields of records) {
    const [type, siteText = '', ...rest] = fields;
    const site = transformer.sites[Number(siteText)];
    if (type === BUILD_RECORD.object && site?.kind === 'construct') {
      const [, ...values] = rest;
      objects.push({ site, values: values.map((raw) => parseValue(raw, objects, site.location)), properties: [] });
    } else if (type === BUILD_RECORD.property && site?.kind === 'property') {
      const [target = '', raw = ''] = rest;
      const index = objectIndex(target);
      const object = index === null ? null : objects[index - 1] ?? null;
      if (object === null) fail(site.location, target.startsWith(MAP_MARK.start) ? TEXT.hostPropertyValue : TEXT.notAMapObject(site.property));
      object?.properties.push({ site, value: parseValue(raw, objects, site.location) });
    }
  }
  const built = objects.map(resolveObject);
  const seenUids = new Map<string, Location>();
  const seenMarks = new Map<string, Location>();
  for (const object of built) {
    const key = object.uid ?? object.mark;
    const seen = object.uid !== null ? seenUids : object.mark !== null ? seenMarks : null;
    if (key === null || seen === null) continue;
    const earlier = seen.get(key);
    if (earlier) fail(object.location, TEXT.createdTwice(key, earlier.line));
    seen.set(key, object.location);
  }
  const declarations = bindings(mapNameList, records, objects, built);
  const index = file.declarations.indexOf(first);
  const rest = file.declarations.filter((declaration) => declaration.kind !== 'map');
  const position = file.declarations.slice(0, index).filter((declaration) => declaration.kind !== 'map').length;
  return {
    file: { ...file, declarations: [...rest.slice(0, position), ...declarations, ...rest.slice(position)] },
    objects: built,
    references: transformer.references,
    functions: needed,
    warnings: built.flatMap(textWarnings),
  };
}

function textWarnings(object: BuiltObject): string[] {
  const warnings: string[] = [];
  for (const [attribute, value] of [...object.set, ...object.initial]) {
    if (value.kind !== 'text') continue;
    const kind = attribute === MARK_VALUE && object.mark !== null ? markValueKind(object.mark) : propertyOf(object.tag, attribute)?.kind;
    if (kind !== TEXT_KIND) continue;
    const where = (message: string): string => WHERE(object.location, message);
    const name = object.uid ?? object.mark ?? object.constructorName;
    if (escapeXml(value.text) !== value.text) warnings.push(where(TEXT.entityValue(name, attribute, value.text)));
    if (editorTurnsIntoNumber(value.text)) warnings.push(where(TEXT.numberText(name, attribute, value.text)));
    if (value.text.startsWith(UID_MARK)) warnings.push(where(TEXT.hashValue(name, attribute, value.text)));
  }
  return warnings;
}
