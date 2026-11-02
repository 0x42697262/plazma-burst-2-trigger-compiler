import { START_TIMER, UNLIMITED_CALLS } from './constants.ts';
import { UNUSED_TARGET } from './keys.ts';
import type { Action, Timer, Trigger } from './types.ts';

export const action = (opcode: number, targetA: string = UNUSED_TARGET, targetB: string = UNUSED_TARGET): Action => ({ opcode, targetA, targetB });

export const trigger = (uid: string, actions: readonly Action[]): Trigger => ({ uid, enabled: true, maxCalls: UNLIMITED_CALLS, actions });

export const startTimer = (uid: string, target: string): Timer => ({
  uid, target, enabled: true, maxCalls: START_TIMER.maxCalls, delay: START_TIMER.delay,
});
