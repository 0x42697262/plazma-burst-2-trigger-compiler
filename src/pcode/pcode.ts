import type { Action, Trigger } from '../program/types.ts';
import { UNLIMITED_CALLS } from '../program/constants.ts';
import { OPCODE, SKIPS_NEXT } from '../opcodes/constants.ts';
import { opcodeByNumber } from '../opcodes/table.ts';
import type { Condition, Instruction, Operand, Value } from '../compiler/ir.ts';
import type { Names } from '../compiler/names.ts';
import { CompileError } from '../compiler/names.ts';
import { TRIGGER_MARK, VARIABLE_MARK } from '../compiler/keys.ts';
import { OPERATIONS, SWITCHES } from './operations.ts';
import type { Access } from './operations.ts';
import {
  EMPTY, EXIT_MARK, FIELD_STEM, FIELD_SUFFIXES, MINUS_ONE, ONE, PURE_NAME, READY_MARK, SEPARATOR, STACK_END, STACK_STEM, STOPS_TRIGGER, TWO,
  VM_LABEL, VM_VARIABLE, ZERO,
} from './keys.ts';
import { FIELD, FIRST_OPERAND, OPERAND_FIELDS, RADIX } from './constants.ts';
import { TEXT } from './text.ts';

type Param = { mode: 'field'; access: Exclude<Access, 'fixed'> } | { mode: 'fixed'; text: string };
type Kind = 'variable' | 'literal';
type Handler =
  | { kind: 'action'; opcode: number; params: [Param, Param]; stops: boolean }
  | { kind: 'set'; number: boolean }
  | { kind: 'jump' }
  | { kind: 'call' }
  | { kind: 'return' }
  | { kind: 'branch'; condition: Condition; left: Kind; right: Kind };

export type PcodeResult = { triggers: Trigger[]; uidOf: (label: string) => string; vmUids: ReadonlySet<string>; baseUid: string; handlerUids: readonly string[] };

export type PcodeObfuscation = { initUid: string; check: string; base: string; size: string; failed: string; expected: number; shuffle: <Item>(items: readonly Item[]) => Item[] };

const isWholeNumber = (text: string): boolean => String(parseInt(text, RADIX)) === text;

export function buildPcode(instructions: readonly Instruction[], names: Names, extraEntries: readonly string[], obfuscation: PcodeObfuscation | null = null): PcodeResult {
  const internal = (name: string): string => names.internalVariable(name);
  const opening = (stem: string): string => internal(stem).slice(0, -VARIABLE_MARK.length);
  const pc = internal(VM_VARIABLE.pc);
  const key = internal(VM_VARIABLE.key);
  const work = internal(VM_VARIABLE.work);
  const sp = internal(VM_VARIABLE.sp);
  const stackEnd = internal(VM_VARIABLE.stackEnd);
  const value = internal(VM_VARIABLE.value);
  const stop = internal(VM_VARIABLE.stop);
  const fields = VM_VARIABLE.fields.map(internal);
  const registers = VM_VARIABLE.registers.map(internal);
  const suffixes = VM_VARIABLE.suffixes.map(internal);
  const loopUid = names.triggerUid(VM_LABEL.loop);
  const loadUid = names.triggerUid(VM_LABEL.load);
  const unpackUid = names.triggerUid(VM_LABEL.unpack);
  const readyUid = names.triggerUid(VM_LABEL.ready);

  const labelPc = new Map<string, number>();
  const body: Exclude<Instruction, { kind: 'label' }>[] = [];
  const stubs = new Set<string>(extraEntries);
  for (const instruction of instructions) {
    if (instruction.kind === 'label') {
      labelPc.set(instruction.label, body.length);
      if (instruction.entry) stubs.add(instruction.label);
      continue;
    }
    body.push(instruction);
    if (instruction.kind === 'action') for (const operand of [instruction.targetA, instruction.targetB]) if (operand.kind === 'label') stubs.add(operand.label);
  }
  body.push({ kind: 'return', location: null });
  const pcOf = (label: string): string => {
    const found = labelPc.get(label);
    if (found === undefined) throw new CompileError(TEXT.unknownLabel(label));
    return String(found);
  };

  const handlers = new Map<string, { index: number; handler: Handler }>();
  const handlerIndex = (handler: Handler): string => {
    const id = JSON.stringify(handler);
    let entry = handlers.get(id);
    if (!entry) {
      entry = { index: handlers.size, handler };
      handlers.set(id, entry);
    }
    return String(entry.index);
  };
  const pool = new Map<string, string>();
  const pooled = (text: string): string => {
    let name = pool.get(text);
    if (name === undefined) {
      name = internal(VM_VARIABLE.pool(pool.size));
      pool.set(text, name);
    }
    return name;
  };
  const operandText = (operand: Operand): string => (operand.kind === 'text' ? operand.text : names.triggerUid(operand.label));
  const valueField = (side: Value): { kind: Kind; text: string } => {
    if (side.kind === 'variable') return { kind: 'variable', text: side.name };
    if (side.text.startsWith(TRIGGER_MARK)) return { kind: 'variable', text: pooled(side.text) };
    return { kind: 'literal', text: side.text };
  };

  const encodeAction = (instruction: Extract<Instruction, { kind: 'action' }>): string[] => {
    const line = instruction.location?.line ?? 0;
    const description = opcodeByNumber(instruction.opcode)?.description ?? EMPTY;
    if (SWITCHES.has(instruction.opcode)) throw new CompileError(TEXT.stopsTrigger(instruction.opcode, line));
    const stops = STOPS_TRIGGER.test(description);
    if (stops) handlerIndex({ kind: 'return' });
    const { targetA, targetB } = instruction;
    if (instruction.opcode === OPCODE.setVariable && targetA.kind === 'text' && targetB.kind === 'text' && PURE_NAME.test(targetA.text)) {
      if (targetB.text.startsWith(TRIGGER_MARK)) {
        return [handlerIndex({ kind: 'action', opcode: OPCODE.copyVariable, params: [{ mode: 'field', access: 'write' }, { mode: 'field', access: 'read' }], stops: false }), targetA.text, pooled(targetB.text)];
      }
      return [handlerIndex({ kind: 'set', number: isWholeNumber(targetB.text) }), targetA.text, targetB.text];
    }
    const accesses = OPERATIONS.get(instruction.opcode) ?? ['fixed', 'fixed'];
    const operandFields: string[] = [];
    const params = [targetA, targetB].map((operand, side): Param => {
      const access = accesses[side] ?? 'fixed';
      if (access !== 'fixed' && operand.kind === 'text' && PURE_NAME.test(operand.text)) {
        operandFields.push(operand.text);
        return { mode: 'field', access };
      }
      return { mode: 'fixed', text: operandText(operand) };
    }) as [Param, Param];
    return [handlerIndex({ kind: 'action', opcode: instruction.opcode, params, stops }), ...operandFields];
  };

  const encode = (instruction: Exclude<Instruction, { kind: 'label' }>): string[] => {
    switch (instruction.kind) {
      case 'action':
        return encodeAction(instruction);
      case 'jump':
        return [handlerIndex({ kind: 'jump' }), pcOf(instruction.label)];
      case 'call':
        return [handlerIndex({ kind: 'call' }), pcOf(instruction.label)];
      case 'return':
        return [handlerIndex({ kind: 'return' })];
      case 'branch': {
        const left = valueField(instruction.left);
        const right = valueField(instruction.right);
        return [handlerIndex({ kind: 'branch', condition: instruction.condition, left: left.kind, right: right.kind }), left.text, right.text, pcOf(instruction.label)];
      }
    }
  };

  const encodedBody = body.map((instruction) => {
    const encoded = encode(instruction);
    while (encoded.length < OPERAND_FIELDS + FIRST_OPERAND) encoded.push(EMPTY);
    if (encoded.some((field) => field.includes(SEPARATOR))) throw new CompileError(TEXT.separatorInText(instruction.location?.line ?? 0));
    return encoded;
  });
  const handlerOrder = [...handlers.values()].map((entry) => entry.index);
  const order = obfuscation === null ? handlerOrder : obfuscation.shuffle(handlerOrder);
  const positionOf = new Map(order.map((index, position) => [index, position]));
  const opText = (field: string): string => {
    const position = positionOf.get(Number(field)) ?? 0;
    return String(obfuscation === null ? position : ((position - obfuscation.expected) % order.length + order.length) % order.length);
  };
  const code = encodedBody.map(([op, ...rest]) => [opText(op ?? EMPTY), ...rest].join(SEPARATOR)).join(SEPARATOR);
  const baseUid = names.triggerUid(VM_LABEL.handler(order[0] ?? 0));

  const act = (opcode: number, targetA: string, targetB: string = ZERO): Action => ({ opcode, targetA, targetB });
  const trigger = (uid: string, actions: Action[]): Trigger => ({ uid, enabled: true, maxCalls: UNLIMITED_CALLS, actions });
  const next = (): Action[] => [act(OPCODE.addValue, pc, ONE), act(OPCODE.switchToTrigger, loopUid)];
  const fetch = (field: number, destination: string): Action[] => [
    act(OPCODE.copyVariable, work, key), act(OPCODE.appendString, work, suffixes[field] ?? EMPTY), act(OPCODE.loadIndirect, destination, work),
  ];
  const stackName = (): Action[] => [act(OPCODE.setVariable, work, opening(STACK_STEM)), act(OPCODE.appendString, work, sp), act(OPCODE.appendString, work, stackEnd)];
  const push = (source: string): Action[] => [...stackName(), act(OPCODE.storeIndirect, work, source), act(OPCODE.addValue, sp, ONE)];
  const pop = (destination: string): Action[] => [act(OPCODE.addValue, sp, MINUS_ONE), ...stackName(), act(OPCODE.loadIndirect, destination, work)];
  const field = (index: number): string => fields[index] ?? EMPTY;
  const register = (index: number): string => registers[index] ?? EMPTY;

  const stopHelpers: Trigger[] = [];
  const flag = internal(VM_VARIABLE.flag);
  const handlerUid = (handler: Handler): string => names.triggerUid(VM_LABEL.handler(handlers.get(JSON.stringify(handler))?.index ?? 0));

  const actionHandler = (handler: Extract<Handler, { kind: 'action' }>, index: number): Action[] => {
    const actions: Action[] = [];
    let position = 0;
    const targets = handler.params.map((param, side) => {
      if (param.mode === 'fixed') return param.text;
      position += 1;
      actions.push(...fetch(position, field(side)));
      if (param.access !== 'write') actions.push(act(OPCODE.loadIndirect, register(side), field(side)));
      return register(side);
    });
    const skips = SKIPS_NEXT.has(handler.opcode);
    const operation = act(handler.opcode, targets[0] ?? ZERO, targets[1] ?? ZERO);
    if (handler.stops) {
      const helper = trigger(names.triggerUid(VM_LABEL.stopHelper(index)), [operation, act(OPCODE.setVariable, flag, ZERO)]);
      stopHelpers.push(helper);
      return [
        ...actions, act(OPCODE.setVariable, flag, ONE), act(OPCODE.executeTrigger, helper.uid), act(OPCODE.skipIfNotEqualValue, flag, ONE),
        act(OPCODE.switchToTrigger, handlerUid({ kind: 'return' })), ...next(),
      ];
    }
    if (skips) actions.push(act(OPCODE.addValue, pc, TWO));
    actions.push(operation);
    if (skips) return [...actions, act(OPCODE.addValue, pc, MINUS_ONE), act(OPCODE.switchToTrigger, loopUid)];
    for (const side of [1, 0]) {
      const param = handler.params[side];
      if (param?.mode === 'field' && param.access !== 'read') actions.push(act(OPCODE.storeIndirect, field(side), register(side)));
    }
    return [...actions, ...next()];
  };

  const SKIP_TAKEN: Record<Condition, { opcode: number; jumpWhenSkipped: boolean }> = {
    eq: { opcode: OPCODE.skipIfEqual, jumpWhenSkipped: true },
    ne: { opcode: OPCODE.skipIfEqual, jumpWhenSkipped: false },
    gt: { opcode: OPCODE.skipIfGreater, jumpWhenSkipped: true },
    le: { opcode: OPCODE.skipIfGreater, jumpWhenSkipped: false },
    lt: { opcode: OPCODE.skipIfLess, jumpWhenSkipped: true },
    ge: { opcode: OPCODE.skipIfLess, jumpWhenSkipped: false },
  };

  const branchHandler = (handler: Extract<Handler, { kind: 'branch' }>): Action[] => {
    const actions: Action[] = [];
    [handler.left, handler.right].forEach((kind, side) => {
      if (kind === 'variable') actions.push(...fetch(side + FIRST_OPERAND, field(side)), act(OPCODE.loadIndirect, register(side), field(side)));
      else actions.push(...fetch(side + FIRST_OPERAND, register(side)));
    });
    const target = register(FIELD.third - FIRST_OPERAND);
    actions.push(...fetch(FIELD.third, target), act(OPCODE.addValue, pc, ONE));
    const test = SKIP_TAKEN[handler.condition];
    actions.push(act(test.opcode, register(0), register(1)));
    if (test.jumpWhenSkipped) actions.push(act(OPCODE.switchToTrigger, loopUid));
    return [...actions, act(OPCODE.copyVariable, pc, target), act(OPCODE.switchToTrigger, loopUid)];
  };

  const handlerActions = (handler: Handler, index: number): Action[] => {
    switch (handler.kind) {
      case 'action':
        return actionHandler(handler, index);
      case 'set': {
        const actions = [...fetch(FIELD.first, field(0)), ...fetch(FIELD.second, register(1))];
        if (handler.number) actions.push(act(OPCODE.addValue, register(1), ZERO));
        return [...actions, act(OPCODE.storeIndirect, field(0), register(1)), ...next()];
      }
      case 'jump':
        return [...fetch(FIELD.first, register(0)), act(OPCODE.copyVariable, pc, register(0)), act(OPCODE.switchToTrigger, loopUid)];
      case 'call':
        return [
          ...fetch(FIELD.first, register(0)), act(OPCODE.copyVariable, register(1), pc), act(OPCODE.addValue, register(1), ONE), ...push(register(1)),
          act(OPCODE.copyVariable, pc, register(0)), act(OPCODE.switchToTrigger, loopUid),
        ];
      case 'return':
        return [...pop(pc), act(OPCODE.skipIfNotEqualValue, pc, EXIT_MARK), act(OPCODE.continueIfGreater, stop, stop), act(OPCODE.switchToTrigger, loopUid)];
      case 'branch':
        return branchHandler(handler);
    }
  };

  const op = internal(VM_VARIABLE.op);
  const dispatch = obfuscation === null
    ? [act(OPCODE.copyVariable, work, internal(VM_VARIABLE.base)), act(OPCODE.addVariable, work, op)]
    : [
      act(OPCODE.copyVariable, work, obfuscation.check), act(OPCODE.addVariable, work, op), act(OPCODE.moduloVariable, work, obfuscation.size),
      act(OPCODE.addVariable, work, obfuscation.base),
    ];
  const loop = trigger(loopUid, [
    act(OPCODE.setVariable, key, opening(FIELD_STEM)), act(OPCODE.appendString, key, pc), ...fetch(FIELD.op, op), ...dispatch, act(OPCODE.switchToTriggerIndex, work),
  ]);
  const handlerByIndex = new Map([...handlers.values()].map((entry) => [entry.index, entry.handler]));
  const handlerTriggers = order.map((index) => trigger(names.triggerUid(VM_LABEL.handler(index)), handlerActions(handlerByIndex.get(index) as Handler, index)));
  const codeVariable = internal(VM_VARIABLE.code);
  const index = internal(VM_VARIABLE.index);
  const count = internal(VM_VARIABLE.count);
  const number = internal(VM_VARIABLE.number);
  const item = internal(VM_VARIABLE.item);
  const ready = internal(VM_VARIABLE.ready);
  const load = trigger(loadUid, [
    ...(obfuscation === null ? [] : [act(OPCODE.executeTrigger, obfuscation.initUid)]),
    act(OPCODE.skipIfNotEqualValue, ready, READY_MARK), act(OPCODE.switchToTrigger, readyUid),
    ...suffixes.map((suffix, position) => act(OPCODE.setVariable, suffix, FIELD_SUFFIXES[position] ?? EMPTY)),
    act(OPCODE.setVariable, stackEnd, STACK_END), ...(obfuscation === null ? [act(OPCODE.setVariable, internal(VM_VARIABLE.base), baseUid)] : []), act(OPCODE.setIfUndefined, sp, ZERO),
    ...[...pool].map(([text, name]) => act(OPCODE.setVariable, name, text)),
    act(OPCODE.setVariable, codeVariable, code), act(OPCODE.splitByValue, codeVariable, SEPARATOR), act(OPCODE.length, count, codeVariable),
    act(OPCODE.setVariable, index, ZERO), act(OPCODE.setVariable, number, ZERO), act(OPCODE.switchToTrigger, unpackUid),
  ]);
  const unpack = trigger(unpackUid, [
    act(OPCODE.skipIfLess, index, count), act(OPCODE.switchToTrigger, readyUid),
    ...FIELD_SUFFIXES.flatMap((_suffix, position) => [
      act(OPCODE.copyVariable, item, codeVariable), act(OPCODE.arrayGetIndex, item, index), act(OPCODE.setVariable, work, opening(FIELD_STEM)),
      act(OPCODE.appendString, work, number), act(OPCODE.appendString, work, suffixes[position] ?? EMPTY), act(OPCODE.storeIndirect, work, item),
      act(OPCODE.addValue, index, ONE),
    ]),
    act(OPCODE.addValue, number, ONE), act(OPCODE.switchToTrigger, unpackUid),
  ]);
  const readyTrigger = trigger(readyUid, [act(OPCODE.setVariable, ready, READY_MARK)]);
  const stubTriggers = [...stubs].map((label) => trigger(names.triggerUid(label), [
    act(OPCODE.executeTrigger, loadUid), ...(obfuscation === null ? [] : [act(OPCODE.continueIfLessValue, obfuscation.failed, ONE)]), ...push(pc), act(OPCODE.setVariable, value, EXIT_MARK), ...push(value),
    act(OPCODE.setVariable, pc, pcOf(label)), act(OPCODE.executeTrigger, loopUid), ...pop(pc),
  ]));
  const vmTriggers = [loop, ...handlerTriggers, ...stopHelpers, load, unpack, readyTrigger];
  return {
    triggers: [...vmTriggers, ...stubTriggers],
    uidOf: (label) => {
      if (!stubs.has(label)) throw new CompileError(TEXT.unknownLabel(label));
      return names.triggerUid(label);
    },
    vmUids: new Set(vmTriggers.map((entry) => entry.uid)),
    baseUid,
    handlerUids: handlerTriggers.map((entry) => entry.uid),
  };
}
