import type { Names } from '../compiler/names.ts';
import { OPCODE } from '../opcodes/constants.ts';
import { createRandom } from '../obfuscate/random.ts';
import { SEED_PURPOSE, TAMPER_LAYER, TAMPER_VARIABLE, ZERO } from './keys.ts';
import { MASK_START, MASK_STEP } from './constants.ts';
import { foundUid } from './tamper.ts';
import type { TamperCheck } from './tamper.ts';

export type CheckAction = { opcode: number; targetA: string; targetB: string };

export type Protection = {
  start: (gameName: string, source: string) => CheckAction[];
  read: (gameName: string, source: string) => CheckAction[];
  write: (gameName: string, source: string) => CheckAction[];
};

export function createProtection(names: Names, options: TamperCheck | null): Protection | null {
  if (options === null || !options.layers.includes(TAMPER_LAYER.value)) return null;
  const random = createRandom(options.seed, SEED_PURPOSE.masks);
  const step = String(random.between(MASK_STEP.low, MASK_STEP.high));
  const work = names.internalVariable(TAMPER_VARIABLE.work);
  const mirror = (source: string): string => names.internalVariable(TAMPER_VARIABLE.mirror(source));
  const mask = (source: string): string => names.internalVariable(TAMPER_VARIABLE.mask(source));
  const act = (opcode: number, targetA: string, targetB: string = ZERO): CheckAction => ({ opcode, targetA, targetB });
  const update = (gameName: string, source: string): CheckAction[] => [act(OPCODE.copyVariable, mirror(source), gameName), act(OPCODE.addVariable, mirror(source), mask(source))];
  return {
    start: (gameName, source) => [act(OPCODE.setVariable, mask(source), String(random.between(MASK_START.low, MASK_START.high))), ...update(gameName, source)],
    read: (gameName, source) => [
      act(OPCODE.copyVariable, work, gameName), act(OPCODE.addVariable, work, mask(source)),
      act(OPCODE.skipIfEqual, work, mirror(source)), act(OPCODE.executeTrigger, foundUid(names, 'value')),
    ],
    write: (gameName, source) => [act(OPCODE.addValue, mask(source), step), ...update(gameName, source)],
  };
}
