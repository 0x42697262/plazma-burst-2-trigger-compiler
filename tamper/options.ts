import { resolveSeed } from '../obfuscate/random.ts';
import { ALL_LAYERS, LAYER_SEPARATOR, TAMPER_MODE, isTamperLayer, isTamperMode } from './keys.ts';
import type { TamperLayer } from './keys.ts';
import type { TamperCheck } from './tamper.ts';
import { TEXT } from './text.ts';

export class TamperOptionError extends Error {}

export type TamperRequest = { mode: string; seed: string | null; layers: string | null; fallbackSeed: () => string; announce?: boolean };

const layersOf = (list: string | null): TamperLayer[] => {
  if (list === null) return [...ALL_LAYERS];
  return list.split(LAYER_SEPARATOR).map((entry) => entry.trim()).filter((entry) => entry !== '').map((entry) => {
    if (!isTamperLayer(entry)) throw new TamperOptionError(TEXT.badLayer(entry));
    return entry;
  });
};

export function tamperCheckOf(request: TamperRequest): TamperCheck | null {
  const mode = request.mode.trim().toLowerCase();
  if (!isTamperMode(mode)) throw new TamperOptionError(TEXT.badMode(request.mode));
  const layers = layersOf(request.layers);
  const announce = request.announce === true;
  if (announce && mode !== TAMPER_MODE.enforce) throw new TamperOptionError(TEXT.announceNeedsEnforce);
  if (mode === TAMPER_MODE.off) return null;
  const seed = request.seed === null || request.seed.trim() === '' ? request.fallbackSeed() : resolveSeed(request.seed);
  return { mode, seed, layers, announce };
}
