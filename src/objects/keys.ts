export type ObjectKindInfo = {
  paramKind: string;
  tags: readonly string[];
  createTag: string;
  defaults: readonly (readonly [string, string])[];
};

const AREA: readonly (readonly [string, string])[] = [['w', '10'], ['h', '10']];
const CHARACTER: readonly (readonly [string, string])[] = [
  ['tox', '0'], ['toy', '0'], ['hea', '130'], ['hmax', '130'], ['team', '0'], ['side', '1'], ['char', '1'], ['incar', '-1'], ['botaction', '0'], ['ondeath', '-1'],
];

export const OBJECT_KINDS: Readonly<Record<string, ObjectKindInfo>> = Object.freeze({
  region: { paramKind: 'region', tags: ['region'], createTag: 'region', defaults: [...AREA, ['use_target', '-1'], ['use_on', '0'], ['attach', '-1']] },
  door: {
    paramKind: 'door', tags: ['door'], createTag: 'door',
    defaults: [...AREA, ['moving', 'false'], ['tarx', '0'], ['tary', '0'], ['maxspeed', '10'], ['vis', 'true'], ['attach', '-1']],
  },
  character: { paramKind: 'character', tags: ['player', 'enemy'], createTag: 'enemy', defaults: CHARACTER },
  gun: { paramKind: 'gun', tags: ['gun'], createTag: 'gun', defaults: [['model', 'gun_rifle'], ['command', '-1'], ['upg', '0']] },
  barrel: { paramKind: 'barrel', tags: ['barrel'], createTag: 'barrel', defaults: [['model', 'bar_orange'], ['tox', '0'], ['toy', '0']] },
  vehicle: {
    paramKind: 'vehicle', tags: ['vehicle'], createTag: 'vehicle',
    defaults: [['side', '1'], ['model', 'veh_jeep'], ['tox', '0'], ['toy', '0'], ['hpp', '100']],
  },
  decor: {
    paramKind: 'decor', tags: ['decor'], createTag: 'decor',
    defaults: [['model', 'stone'], ['attach', '-1'], ['u', '0'], ['v', '0'], ['f', '0'], ['r', '0'], ['sx', '1'], ['sy', '1']],
  },
  pusher: {
    paramKind: 'pushf', tags: ['pushf'], createTag: 'pushf',
    defaults: [...AREA, ['tox', '0'], ['toy', '0'], ['stab', '0'], ['damage', '0'], ['attach', '-1']],
  },
  light: { paramKind: 'lamp', tags: ['lamp'], createTag: 'lamp', defaults: [['power', '0.4'], ['flare', '1']] },
  water: { paramKind: 'water', tags: ['water'], createTag: 'water', defaults: [...AREA, ['damage', '0'], ['friction', 'true']] },
  timer: {
    paramKind: 'timer', tags: ['timer'], createTag: 'timer',
    defaults: [['enabled', 'true'], ['maxcalls', '1'], ['target', '-1'], ['delay', '30']],
  },
  trigger: { paramKind: 'trigger', tags: ['trigger'], createTag: 'trigger', defaults: [['enabled', 'true'], ['maxcalls', '1']] },
});

export const OBJECT_PARAM_KINDS: ReadonlySet<string> = new Set(Object.values(OBJECT_KINDS).map((info) => info.paramKind));
export const UID_ATTRIBUTE_NAME = 'uid';
export const POSITION_ATTRIBUTES = Object.freeze({ x: 'x', y: 'y' });
export const ELEMENT_WITH_UID = /<([a-z_]+)\b[^>]*\buid="([^"]*)"/g;
