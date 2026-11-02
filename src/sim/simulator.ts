import type { Program } from '../program/types.ts';
import { OPCODE } from '../opcodes/constants.ts';
import {
  DEFAULT_MAX_STEPS, FALSE_FLAG, MAX_FRAMES, NOT_FOUND, RANDOM_INCREMENT, RANDOM_MODULUS, RANDOM_MULTIPLIER, RANDOM_SEED, TRUE_FLAG, UNLIMITED,
} from './constants.ts';
import { UNKNOWN_PLAYER_NAME } from './keys.ts';
import { TEXT } from './text.ts';
import { add, loadValue, replaceVariables, stringOf, toFloat, toIndex, toNumber } from './values.ts';
import type { Registry } from './values.ts';

export type Player = { slot: number; name: string; active: boolean };

export type SimulationOptions = {
  maxSteps: number;
  players: readonly Player[];
  currentSlot: number;
  initiatorSlot: number;
  frameSpeed: number;
};

export const DEFAULT_SIMULATION: SimulationOptions = Object.freeze({
  maxSteps: DEFAULT_MAX_STEPS, players: [], currentSlot: 0, initiatorSlot: 0, frameSpeed: 1,
});

type LoadedAction = { opcode: number; targetA: unknown; targetB: unknown };
type LoadedTrigger = { uid: string; enabled: boolean; calls: number; actions: LoadedAction[] };
type LoadedTimer = { uid: string; enabled: boolean; calls: number; delay: number; counter: number; target: unknown };
type Control = { index: number; position: number; push: (target: number) => void };

export class StepLimitError extends Error {}

const ARRAY_GUARD = (value: unknown): unknown[] => value as unknown[];
const STRING_GUARD = (value: unknown): string => value as string;

export class Simulation {
  readonly variables: Record<string, unknown> = {};
  readonly chat: string[] = [];
  readonly errors: string[] = [];
  readonly triggers: LoadedTrigger[];
  readonly timers: LoadedTimer[];
  private readonly options: SimulationOptions;
  private readonly registry: Registry = { uids: [], ids: [] };
  private joinTrigger: number | null = null;
  private steps = 0;
  private frames = 0;
  private seed = RANDOM_SEED;

  constructor(program: Program, options: Partial<SimulationOptions> = {}) {
    this.options = { ...DEFAULT_SIMULATION, ...options };
    program.triggers.forEach((trigger, index) => this.register(trigger.uid, index));
    program.timers.forEach((timer, index) => this.register(timer.uid, index));
    this.triggers = program.triggers.map((trigger) => ({
      uid: trigger.uid,
      enabled: trigger.enabled,
      calls: trigger.maxCalls,
      actions: trigger.actions.map((action) => ({
        opcode: action.opcode,
        targetA: loadValue(action.targetA, this.registry),
        targetB: loadValue(action.targetB, this.registry),
      })),
    }));
    this.timers = program.timers.map((timer) => ({
      uid: timer.uid, enabled: timer.enabled, calls: timer.maxCalls, delay: timer.delay, counter: 0, target: loadValue(timer.target, this.registry),
    }));
  }

  get actionCount(): number {
    return this.steps;
  }

  get frameCount(): number {
    return this.frames;
  }

  runUid(uid: string): void {
    const index = this.triggers.findIndex((trigger) => trigger.uid === uid);
    if (index === NOT_FOUND) throw new Error(TEXT.noSuchUid(uid));
    this.run(index);
  }

  playerJoins(): void {
    if (this.joinTrigger !== null) this.run(this.joinTrigger);
  }

  tick(count = 1): void {
    for (let frame = 0; frame < count; frame++) {
      this.frames += 1;
      for (const timer of this.timers) this.tickTimer(timer);
    }
  }

  run(start: number): void {
    const stack: [number, number][] = [[start, 0]];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as [number, number];
      const [index, position] = frame;
      try {
        if (stack.length > MAX_FRAMES) throw new Error(TEXT.stackOverflow);
        const trigger = this.triggers[index];
        if (!trigger) {
          this.errors.push(TEXT.missingTrigger(index));
          stack.pop();
          continue;
        }
        const canStart = trigger.enabled && (trigger.calls === UNLIMITED || trigger.calls > 0);
        if (position === 0 && !canStart) {
          stack.pop();
          continue;
        }
        const action = trigger.actions[position];
        if (!action) {
          if (trigger.calls !== UNLIMITED) trigger.calls -= 1;
          stack.pop();
          continue;
        }
        this.countStep();
        const control: Control = { index, position, push: (target) => stack.push([target, 0]) };
        this.execute(action, control);
        frame[0] = control.index;
        frame[1] = control.position + 1;
      } catch (error) {
        if (error instanceof StepLimitError) throw error;
        const uid = this.triggers[index]?.uid ?? String(index);
        this.errors.push(TEXT.actionError(uid, position + 1, error instanceof Error ? error.message : String(error)));
        stack.pop();
      }
    }
  }

  private register(uid: string, id: number): void {
    this.registry.uids.push(uid);
    this.registry.ids.push(id);
  }

  private tickTimer(timer: LoadedTimer): void {
    if (!timer.enabled || !(timer.calls > 0 || timer.calls === UNLIMITED)) return;
    timer.counter += this.options.frameSpeed;
    if (timer.counter < timer.delay) return;
    timer.counter = 0;
    if (timer.calls !== UNLIMITED) {
      timer.calls -= 1;
      if (timer.calls <= 0) timer.enabled = false;
    }
    if (timer.target !== UNLIMITED) this.run(timer.target as number);
  }

  private countStep(): void {
    this.steps += 1;
    if (this.steps > this.options.maxSteps) throw new StepLimitError(TEXT.stepLimit(this.options.maxSteps));
  }

  private random(): number {
    this.seed = (this.seed * RANDOM_MULTIPLIER + RANDOM_INCREMENT) % RANDOM_MODULUS;
    return this.seed / RANDOM_MODULUS;
  }

  private triggerAt(value: unknown): LoadedTrigger {
    const trigger = this.triggers[toIndex(value)];
    if (!trigger) throw new Error(TEXT.missingTrigger(value));
    return trigger;
  }

  private timerAt(value: unknown): LoadedTimer {
    const timer = this.timers[toIndex(value)];
    if (!timer) throw new Error(TEXT.missingTimer(value));
    return timer;
  }

  private playerName(slot: number): string {
    const player = this.options.players.find((entry) => entry.slot === slot);
    return player?.active ? player.name : UNKNOWN_PLAYER_NAME;
  }

  private activeSlots(): unknown {
    let result: unknown = [];
    for (const player of [...this.options.players].sort((first, second) => first.slot - second.slot)) {
      if (player.active) result = add(result, player.slot);
    }
    return result;
  }

  private execute(action: LoadedAction, control: Control): void {
    const vars = this.variables;
    const nameA = action.targetA as string;
    const nameB = action.targetB as string;
    const valueB = action.targetB;
    const stop = (): void => {
      control.position = Number.MAX_SAFE_INTEGER - 1;
    };
    const skip = (): void => {
      control.position += 1;
    };
    switch (action.opcode) {
      case OPCODE.showText:
        this.chat.push(replaceVariables(stringOf(action.targetA), vars));
        break;
      case OPCODE.disableTrigger:
        this.triggerAt(action.targetA).enabled = false;
        break;
      case OPCODE.enableTrigger:
        this.triggerAt(action.targetA).enabled = true;
        break;
      case OPCODE.setTriggerCalls:
        this.triggerAt(action.targetA).calls = toIndex(valueB);
        break;
      case OPCODE.enableTimer:
        this.timerAt(action.targetA).enabled = true;
        break;
      case OPCODE.disableTimer:
        this.timerAt(action.targetA).enabled = false;
        break;
      case OPCODE.resetTimer:
        this.timerAt(action.targetA).counter = 0;
        break;
      case OPCODE.executeTrigger:
        control.push(toIndex(action.targetA));
        break;
      case OPCODE.setVariable:
        vars[nameA] = valueB;
        break;
      case OPCODE.setIfUndefined:
        if (vars[nameA] === undefined) vars[nameA] = valueB;
        break;
      case OPCODE.addValue:
        vars[nameA] = toFloat(vars[nameA]) + toFloat(valueB);
        break;
      case OPCODE.multiplyValue:
        vars[nameA] = toNumber(vars[nameA]) * toFloat(valueB);
        break;
      case OPCODE.addVariable:
        vars[nameA] = add(vars[nameA], toFloat(vars[nameB]));
        break;
      case OPCODE.multiplyVariable:
        vars[nameA] = toNumber(vars[nameA]) * toFloat(vars[nameB]);
        break;
      case OPCODE.randomFloat:
        vars[nameA] = this.random() * toFloat(valueB);
        break;
      case OPCODE.randomInteger:
        vars[nameA] = Math.floor(this.random() * toFloat(valueB));
        break;
      case OPCODE.round:
        vars[nameA] = Math.round(toNumber(vars[nameA]));
        break;
      case OPCODE.floor:
        vars[nameA] = Math.floor(toNumber(vars[nameA]));
        break;
      case OPCODE.continueIfGreater:
        if (!(toFloat(vars[nameA]) > toFloat(vars[nameB]))) stop();
        break;
      case OPCODE.continueIfLessValue:
        if (!(toFloat(vars[nameA]) < toFloat(valueB))) stop();
        break;
      case OPCODE.skipIfNotEqualValue:
        if (stringOf(vars[nameA]) !== stringOf(valueB)) skip();
        break;
      case OPCODE.moduloValue:
        vars[nameA] = toFloat(vars[nameA]) % toFloat(valueB);
        break;
      case OPCODE.copyVariable:
        vars[nameA] = vars[nameB];
        break;
      case OPCODE.moduloVariable:
        vars[nameA] = toFloat(vars[nameA]) % toFloat(vars[nameB]);
        break;
      case OPCODE.divideValue:
        vars[nameA] = toNumber(vars[nameA]) / toFloat(valueB);
        break;
      case OPCODE.divideVariable:
        vars[nameA] = toNumber(vars[nameA]) / toFloat(vars[nameB]);
        break;
      case OPCODE.powerVariable:
        vars[nameA] = Math.pow(toFloat(vars[nameA]), toFloat(vars[nameB]));
        break;
      case OPCODE.powerValue:
        vars[nameA] = Math.pow(toFloat(vars[nameA]), toFloat(valueB));
        break;
      case OPCODE.currentPlayerSlot:
        vars[nameA] = this.options.currentSlot;
        break;
      case OPCODE.containsValue:
        vars[nameA] = STRING_GUARD(vars[nameA]).indexOf(valueB as string) !== NOT_FOUND ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.containsVariable:
        vars[nameA] = STRING_GUARD(vars[nameA]).indexOf(vars[nameB] as string) !== NOT_FOUND ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.length:
        vars[nameA] = STRING_GUARD(vars[nameB]).length;
        break;
      case OPCODE.appendString:
        vars[nameA] = add(vars[nameA], stringOf(vars[nameB]));
        break;
      case OPCODE.negate:
        vars[nameA] = -toNumber(vars[nameA]);
        break;
      case OPCODE.initiatorSlot:
        vars[nameA] = this.options.initiatorSlot;
        break;
      case OPCODE.playerNameBySlot:
        vars[nameA] = this.playerName(toIndex(valueB));
        break;
      case OPCODE.playerNameBySlotVariable:
        vars[nameA] = this.playerName(toNumber(vars[nameB]));
        break;
      case OPCODE.onPlayerJoin:
        this.joinTrigger = toIndex(action.targetA);
        break;
      case OPCODE.loadIndirect:
        vars[nameA] = vars[vars[nameB] as string];
        break;
      case OPCODE.replaceTemplate:
      case OPCODE.replaceInValue:
        vars[nameA] = replaceVariables(valueB, vars);
        break;
      case OPCODE.replaceInVariable:
        vars[nameA] = replaceVariables(vars[nameB], vars);
        break;
      case OPCODE.randomFloatVariable:
        vars[nameA] = this.random() * toFloat(vars[nameB]);
        break;
      case OPCODE.storeIndirect:
        vars[vars[nameA] as string] = vars[nameB];
        break;
      case OPCODE.timeSinceStart:
        vars[nameA] = this.frames;
        break;
      case OPCODE.splitByValue:
        vars[nameA] = STRING_GUARD(vars[nameA]).split(valueB as string);
        break;
      case OPCODE.splitByVariable:
        vars[nameA] = STRING_GUARD(vars[nameA]).split(vars[nameB] as string);
        break;
      case OPCODE.joinByVariable:
        vars[nameA] = ARRAY_GUARD(vars[nameA]).join(vars[nameB] as string);
        break;
      case OPCODE.arrayGetIndex:
        vars[nameA] = ARRAY_GUARD(vars[nameA])[Math.floor(toNumber(replaceVariables(valueB, vars)))];
        break;
      case OPCODE.arrayPush:
        ARRAY_GUARD(vars[nameA]).push(replaceVariables(valueB, vars));
        break;
      case OPCODE.createArray:
        vars[nameA] = [];
        break;
      case OPCODE.skipIfEqual:
        if (String(vars[nameA]) === String(vars[nameB])) skip();
        break;
      case OPCODE.switchToTriggerIndex:
        control.index = Math.floor(toNumber(vars[nameA]));
        control.position = -1;
        break;
      case OPCODE.switchToTrigger:
        control.index = Math.floor(toNumber(action.targetA));
        control.position = -1;
        break;
      case OPCODE.skipIfGreater:
        if (toFloat(vars[nameA]) > toFloat(vars[nameB])) skip();
        break;
      case OPCODE.skipIfLess:
        if (toFloat(vars[nameA]) < toFloat(vars[nameB])) skip();
        break;
      case OPCODE.removeStart: {
        const count = Math.floor(toNumber(action.targetA));
        const text = STRING_GUARD(vars[nameB]);
        vars[nameB] = count > 0 ? text.slice(count) : text.slice(0, text.length - (-count));
        break;
      }
      case OPCODE.activeSlots:
        vars[nameA] = this.activeSlots();
        break;
      default:
        throw new Error(TEXT.unsupported(action.opcode));
    }
  }
}
