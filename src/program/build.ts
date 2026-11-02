import { UNLIMITED_CALLS } from './constants.ts';
import { UNUSED_TARGET } from './keys.ts';
import type { Action, Trigger } from './types.ts';

export const action = (opcode: number, targetA: string = UNUSED_TARGET, targetB: string = UNUSED_TARGET): Action => ({ opcode, targetA, targetB });

export const trigger = (uid: string, actions: readonly Action[]): Trigger => ({ uid, enabled: true, maxCalls: UNLIMITED_CALLS, actions });
