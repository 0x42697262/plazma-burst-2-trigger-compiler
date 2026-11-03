import type { Program } from '../program/types.ts';
import { OPCODE, SYNC_TEXT_LIMIT } from '../opcodes/constants.ts';
import {
  AI_DIFFICULTY, CLOCK_START, DATE_PARTS, DEFAULT_HITPOINTS, FRAMES_PER_SECOND, NO_PLAYER, DECIMAL, DEFAULT_MAX_STEPS, FALSE_FLAG, MILLISECONDS_PER_FRAME, MAX_FRAMES, NOT_FOUND, RANDOM_INCREMENT, RANDOM_MODULUS, RANDOM_MULTIPLIER, RANDOM_SEED, TRUE_FLAG, UNLIMITED,
} from './constants.ts';
import { DATE_SEPARATOR, DATE_SPACE, EMPTY, EMPTY_LOGIN, EMPTY_SLOT_NAME, SESSION_SEPARATOR, SHOWN_TEXT_ENTITIES, UID_MARK } from './keys.ts';
import { escapeXml } from '../emit/xml-emitter.ts';
import { TEXT } from './text.ts';
import { add, loadValue, replaceVariables, stringOf, toFloat, toIndex, toNumber } from './values.ts';
import type { Registry } from './values.ts';

export type Player = { slot: number; name: string; active: boolean; team?: number; login?: string; hitpoints?: number; dying?: boolean; x?: number; y?: number };

export type Region = { x: number; y: number; w: number; h: number };

export type Session = { values: Record<string, unknown>; maps: Record<string, string> };

export const newSession = (): Session => ({ values: {}, maps: {} });

export type SimulationOptions = {
  maxSteps: number;
  players: readonly Player[];
  currentSlot: number;
  initiatorSlot: number;
  frameSpeed: number;
  allowedActions: ReadonlySet<number> | null;
  killerSlot: number;
  multiplayer: boolean;
  spectator: boolean;
  lowPhysics: boolean;
  matchName: string;
  matchMode: number;
  mapId: string;
  gameplayModifications: string;
  frameTime: number;
  frameRate: number;
  chatStatus: number;
  aiDifficulty: number;
  regions: Readonly<Record<string, Region>>;
  session: Session | null;
};

export const DEFAULT_SIMULATION: SimulationOptions = Object.freeze({
  maxSteps: DEFAULT_MAX_STEPS, players: [], currentSlot: 0, initiatorSlot: NO_PLAYER, frameSpeed: 1, allowedActions: null,
  killerSlot: NO_PLAYER, multiplayer: false, spectator: false, lowPhysics: false, matchName: EMPTY, matchMode: 0, mapId: EMPTY,
  gameplayModifications: EMPTY, frameTime: 1, frameRate: FRAMES_PER_SECOND, chatStatus: 0, aiDifficulty: AI_DIFFICULTY.normal, regions: {}, session: null,
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
  readonly unsimulated = new Set<number>();
  readonly triggers: LoadedTrigger[];
  readonly timers: LoadedTimer[];
  private readonly options: SimulationOptions;
  private readonly registry: Registry = { uids: [], ids: [] };
  private joinTrigger: number | null = null;
  private chatTrigger: number | null = null;
  private talker: unknown = undefined;
  private said: unknown = undefined;
  private readonly varSync: boolean;
  private steps = 0;
  private frames = 0;
  private seed = RANDOM_SEED;
  private aiDifficulty: number;
  private readonly regions: Record<string, Region>;
  readonly session: Session;

  constructor(program: Program, options: Partial<SimulationOptions> = {}) {
    this.options = { ...DEFAULT_SIMULATION, ...options };
    this.varSync = program.varSyncMark === true;
    this.aiDifficulty = this.options.aiDifficulty;
    this.regions = Object.fromEntries(Object.entries(this.options.regions).map(([uid, region]) => [uid, { ...region }]));
    this.session = this.options.session ?? newSession();
    program.triggers.forEach((trigger, index) => this.register(trigger.uid, index));
    program.timers.forEach((timer, index) => this.register(timer.uid, index));
    this.triggers = program.triggers.map((trigger) => ({
      uid: trigger.uid,
      enabled: trigger.enabled,
      calls: trigger.maxCalls,
      actions: trigger.actions.map((action) => ({
        opcode: action.opcode,
        targetA: loadValue(escapeXml(action.targetA), this.registry),
        targetB: loadValue(escapeXml(action.targetB), this.registry),
      })),
    }));
    this.timers = program.timers.map((timer) => ({
      uid: timer.uid, enabled: timer.enabled, calls: timer.maxCalls, delay: timer.delay, counter: 0, target: this.timerTarget(timer.target),
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

  playerSays(slot: number, text: string): void {
    if (this.chatTrigger === null) return;
    this.talker = slot;
    this.said = text;
    this.run(this.chatTrigger);
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

  private timerTarget(raw: string): unknown {
    return raw.startsWith(UID_MARK) ? loadValue(escapeXml(raw), this.registry) : parseInt(raw, DECIMAL);
  }

  private register(uid: string, id: number): void {
    this.registry.uids.push(escapeXml(uid));
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
    return player?.active ? player.name : EMPTY_SLOT_NAME;
  }

  private player(slot: unknown): Player {
    const player = this.options.players.find((entry) => String(entry.slot) === String(slot) && entry.active);
    if (!player) throw new Error(TEXT.noCharacter(String(slot)));
    return player;
  }

  private region(value: unknown): Region {
    const region = this.regions[String(value)];
    if (!region) throw new Error(TEXT.noRegion(String(value)));
    return region;
  }

  private killer(): Player | null {
    return this.options.killerSlot === NO_PLAYER ? null : this.player(this.options.killerSlot);
  }

  private aliveIn(region: Region): number {
    return this.options.players.filter((player) => player.active && (player.hitpoints ?? DEFAULT_HITPOINTS) > 0
      && (player.x ?? 0) > region.x && (player.x ?? 0) < region.x + region.w && (player.y ?? 0) > region.y && (player.y ?? 0) < region.y + region.h).length;
  }

  private setAiDifficulty(level: number): void {
    if (level <= AI_DIFFICULTY.easy) this.aiDifficulty = AI_DIFFICULTY.easy;
    else if (level <= AI_DIFFICULTY.normal) this.aiDifficulty = AI_DIFFICULTY.normal;
    else this.aiDifficulty = AI_DIFFICULTY.hard;
  }

  private date(text: string): number {
    const parts = text.split(DATE_SPACE).join(EMPTY).split(DATE_SEPARATOR).map(Number);
    return new Date(parts[DATE_PARTS.year] ?? 0, parts[DATE_PARTS.month] ?? 0, parts[DATE_PARTS.day] ?? 0).getTime();
  }

  private playerLogin(slot: unknown, emptyWhenMissing: boolean): string {
    const player = this.options.players.find((entry) => String(entry.slot) === String(slot) && entry.active);
    if (player) return player.login ?? player.name;
    if (emptyWhenMissing) return EMPTY_SLOT_NAME;
    throw new Error(TEXT.noCharacter(String(slot)));
  }

  private character(slot: unknown): Player {
    const key = String(slot);
    const player = this.options.players.find((entry) => String(entry.slot) === key);
    if (!player) throw new Error(TEXT.noCharacter(key));
    return player;
  }

  private characterName(slot: unknown): string {
    const key = String(slot);
    const player = this.options.players.find((entry) => String(entry.slot) === key);
    if (!player) throw new Error(TEXT.noCharacter(key));
    return player.name;
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
    if (this.options.allowedActions !== null && !this.options.allowedActions.has(action.opcode)) throw new Error(TEXT.notAllowed(action.opcode));
    switch (action.opcode) {
      case OPCODE.showText:
        this.chat.push(replaceVariables(SHOWN_TEXT_ENTITIES.reduce((text, [entity, character]) => text.split(entity).join(character), stringOf(action.targetA)), vars));
        break;
      case OPCODE.disableTrigger:
        this.triggerAt(action.targetA).enabled = false;
        break;
      case OPCODE.enableTrigger:
        this.triggerAt(action.targetA).enabled = true;
        break;
      case OPCODE.setTriggerCallsZero:
        this.triggerAt(action.targetA).calls = 0;
        break;
      case OPCODE.setTriggerCalls:
        this.triggerAt(action.targetA).calls = toIndex(valueB);
        break;
      case OPCODE.setTimerDelay:
        this.timerAt(action.targetA).delay = toFloat(valueB);
        break;
      case OPCODE.setTimerCalls:
        this.timerAt(action.targetA).calls = toIndex(valueB);
        break;
      case OPCODE.timerElapsed:
        vars[nameA] = this.timerAt(valueB).counter;
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
      case OPCODE.initiatorLogin:
        vars[nameA] = this.playerLogin(this.options.initiatorSlot, false);
        break;
      case OPCODE.playerLoginBySlot:
        vars[nameA] = this.playerLogin(toIndex(valueB), true);
        break;
      case OPCODE.playerLoginBySlotVariable:
        vars[nameA] = this.playerLogin(vars[nameB], false);
        break;
      case OPCODE.playerNameBySlot:
        vars[nameA] = this.playerName(toIndex(valueB));
        break;
      case OPCODE.playerNameBySlotVariable:
        vars[nameA] = this.characterName(vars[nameB]);
        break;
      case OPCODE.syncReplace:
      case OPCODE.syncDefault:
      case OPCODE.syncMax:
      case OPCODE.syncMin:
      case OPCODE.syncLongest:
        if (stringOf(action.targetA).length > SYNC_TEXT_LIMIT) throw new Error(TEXT.syncNameTooLong);
        if (stringOf(vars[nameA]).length > SYNC_TEXT_LIMIT) throw new Error(TEXT.syncValueTooLong);
        if (!this.varSync) throw new Error(TEXT.noVarSync);
        break;
      case OPCODE.setChatReceiver:
        this.chatTrigger = toIndex(action.targetA);
        break;
      case OPCODE.talkerLogin: {
        const talker = this.options.players.find((entry) => String(entry.slot) === String(this.talker));
        vars[nameA] = talker ? talker.login ?? talker.name : EMPTY_LOGIN;
        break;
      }
      case OPCODE.talkerName: {
        const talker = this.options.players.find((entry) => String(entry.slot) === String(this.talker));
        vars[nameA] = talker ? talker.name : EMPTY_SLOT_NAME;
        break;
      }
      case OPCODE.talkerSlot:
        vars[nameA] = this.talker;
        break;
      case OPCODE.chatInput:
        vars[nameA] = this.said;
        break;
      case OPCODE.teamBySlot:
        vars[nameA] = this.character(toIndex(valueB)).team;
        break;
      case OPCODE.teamBySlotVariable:
        vars[nameA] = this.character(vars[nameB]).team;
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
        vars[nameA] = Math.round(CLOCK_START + this.frames * MILLISECONDS_PER_FRAME);
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
      case OPCODE.continueIfLess:
        if (!(toFloat(vars[nameA]) < toFloat(vars[nameB]))) stop();
        break;
      case OPCODE.continueIfEqual:
        if (vars[nameA] !== vars[nameB]) stop();
        break;
      case OPCODE.continueIfNotEqual:
        if (vars[nameA] === vars[nameB]) stop();
        break;
      case OPCODE.continueIfGreaterValue:
        if (!(toFloat(vars[nameA]) > toFloat(valueB))) stop();
        break;
      case OPCODE.continueIfEqualValue:
        if (vars[nameA] !== valueB) stop();
        break;
      case OPCODE.continueIfNotEqualValue:
        if (vars[nameA] === valueB) stop();
        break;
      case OPCODE.regionX:
        vars[nameA] = this.region(valueB).x;
        break;
      case OPCODE.regionY:
        vars[nameA] = this.region(valueB).y;
        break;
      case OPCODE.setRegionX:
        this.region(action.targetA).x = toFloat(vars[nameB]);
        break;
      case OPCODE.setRegionY:
        this.region(action.targetA).y = toFloat(vars[nameB]);
        break;
      case OPCODE.hitpoints:
        vars[nameA] = this.player(toIndex(valueB)).hitpoints ?? DEFAULT_HITPOINTS;
        break;
      case OPCODE.sine:
        vars[nameA] = Math.sin(toFloat(vars[nameB]));
        break;
      case OPCODE.cosine:
        vars[nameA] = Math.cos(toFloat(vars[nameB]));
        break;
      case OPCODE.arcSine:
        vars[nameA] = Math.asin(toFloat(vars[nameB]));
        break;
      case OPCODE.arcCosine:
        vars[nameA] = Math.acos(toFloat(vars[nameB]));
        break;
      case OPCODE.arcTangent2:
        vars[nameA] = Math.atan2(toFloat(vars[nameA]), toFloat(vars[nameB]));
        break;
      case OPCODE.isMultiplayer:
        vars[nameA] = this.options.multiplayer ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.isSpectator:
        vars[nameA] = this.options.spectator ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.isLowPhysics:
        vars[nameA] = this.options.lowPhysics ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.aliveInRegion:
        vars[nameA] = this.aliveIn(this.region(valueB));
        break;
      case OPCODE.initiatorName:
        vars[nameA] = this.player(this.options.initiatorSlot).name;
        break;
      case OPCODE.matchName:
        vars[nameA] = this.options.matchName;
        break;
      case OPCODE.oneMinus:
        vars[nameA] = 1 - (vars[nameA] as number);
        break;
      case OPCODE.frameTime:
        vars[nameA] = this.options.frameTime;
        break;
      case OPCODE.clearSession:
        this.session.values = {};
        this.session.maps = {};
        break;
      case OPCODE.saveSession:
        this.session.maps[nameA] = this.options.mapId;
        this.session.values[nameA] = vars[nameB];
        break;
      case OPCODE.loadSession:
        vars[nameB] = this.session.values[nameA];
        break;
      case OPCODE.continueIfSessionFrom:
        if (typeof valueB !== 'string') throw new Error(TEXT.notText(stringOf(valueB)));
        if ((SESSION_SEPARATOR + stringOf(valueB).toLowerCase() + SESSION_SEPARATOR).indexOf(SESSION_SEPARATOR + stringOf(this.session.maps[nameA]) + SESSION_SEPARATOR) === NOT_FOUND) stop();
        break;
      case OPCODE.setAiDifficulty:
        this.setAiDifficulty(toIndex(action.targetA));
        break;
      case OPCODE.aiDifficulty:
        vars[nameA] = this.aiDifficulty;
        break;
      case OPCODE.matchMode:
        vars[nameA] = this.options.multiplayer ? this.options.matchMode : 0;
        break;
      case OPCODE.killerSlot:
        vars[nameA] = this.options.killerSlot;
        break;
      case OPCODE.killerLogin: {
        const killer = this.killer();
        vars[nameA] = killer ? killer.login ?? killer.name : EMPTY_LOGIN;
        break;
      }
      case OPCODE.killerName:
        vars[nameA] = this.killer()?.name ?? EMPTY_SLOT_NAME;
        break;
      case OPCODE.isDying:
        vars[nameA] = this.player(toIndex(valueB)).dying ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.initiatorDying:
        vars[nameA] = this.options.initiatorSlot === NO_PLAYER ? FALSE_FLAG : this.player(this.options.initiatorSlot).dying ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.killerDying:
        vars[nameA] = this.killer()?.dying ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.isDyingBySlotVariable:
        vars[nameA] = this.player(Math.floor(toNumber(vars[nameB]))).dying ? TRUE_FLAG : FALSE_FLAG;
        break;
      case OPCODE.randomIntegerVariable:
        vars[nameA] = Math.floor(this.random() * (toFloat(vars[nameB]) - 1));
        break;
      case OPCODE.gameplayModifications:
        vars[nameA] = this.options.gameplayModifications;
        break;
      case OPCODE.wallClock:
        vars[nameA] = Math.round(CLOCK_START + this.frames * MILLISECONDS_PER_FRAME);
        break;
      case OPCODE.dateTime:
        vars[nameA] = this.date(stringOf(vars[nameB]));
        break;
      case OPCODE.mapId:
        vars[nameA] = this.options.mapId;
        break;
      case OPCODE.chatStatus:
        vars[nameA] = this.options.chatStatus;
        break;
      case OPCODE.frameRate:
        vars[nameA] = this.options.frameRate;
        break;
      case OPCODE.activeSlots:
        vars[nameA] = this.activeSlots();
        break;
      default:
        this.unsimulated.add(action.opcode);
    }
  }
}
