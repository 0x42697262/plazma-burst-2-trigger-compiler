export type ObjectKindInfo = {
  paramKind: string;
  tags: readonly string[];
  createTag: string;
  defaults: readonly (readonly [string, string])[];
};
export type ConstructorInfo = { tag: string; keyword: string | null; positional: readonly string[] };

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
  player: { paramKind: 'character', tags: ['player'], createTag: 'player', defaults: CHARACTER },
  actor: { paramKind: 'character', tags: ['enemy'], createTag: 'enemy', defaults: CHARACTER },
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
  song: { paramKind: 'song+none', tags: ['song'], createTag: 'song', defaults: [['url', ''], ['volume', '1'], ['loop', 'true'], ['callback', '-1']] },
  water: { paramKind: 'water', tags: ['water'], createTag: 'water', defaults: [...AREA, ['damage', '0'], ['friction', 'true']] },
  timer: {
    paramKind: 'timer', tags: ['timer'], createTag: 'timer',
    defaults: [['enabled', 'true'], ['maxcalls', '1'], ['target', '-1'], ['delay', '30']],
  },
  trigger: { paramKind: 'trigger', tags: ['trigger'], createTag: 'trigger', defaults: [['enabled', 'true'], ['maxcalls', '1']] },
});

export const UID_ARGUMENT = 'uid';
export const MARK_ARGUMENT = 'mark';
export const MARK_VALUE = 'forteam';
export const AREA_ARGUMENTS: readonly string[] = Object.freeze(['x', 'y', 'w', 'h']);

export const CONSTRUCTORS: Readonly<Record<string, ConstructorInfo>> = Object.freeze({
  Door: { tag: 'door', keyword: 'door', positional: [UID_ARGUMENT] },
  Region: { tag: 'region', keyword: 'region', positional: [UID_ARGUMENT] },
  Player: { tag: 'player', keyword: 'player', positional: [UID_ARGUMENT] },
  Actor: { tag: 'enemy', keyword: 'actor', positional: [UID_ARGUMENT] },
  Gun: { tag: 'gun', keyword: 'gun', positional: [UID_ARGUMENT] },
  Barrel: { tag: 'barrel', keyword: 'barrel', positional: [UID_ARGUMENT] },
  Vehicle: { tag: 'vehicle', keyword: 'vehicle', positional: [UID_ARGUMENT] },
  Decor: { tag: 'decor', keyword: 'decor', positional: [UID_ARGUMENT] },
  Pusher: { tag: 'pushf', keyword: 'pusher', positional: [UID_ARGUMENT] },
  Light: { tag: 'lamp', keyword: 'light', positional: [UID_ARGUMENT] },
  Water: { tag: 'water', keyword: 'water', positional: [UID_ARGUMENT] },
  Song: { tag: 'song', keyword: 'song', positional: [UID_ARGUMENT] },
  Wall: { tag: 'box', keyword: null, positional: AREA_ARGUMENTS },
  Background: { tag: 'bg', keyword: null, positional: AREA_ARGUMENTS },
  EngineMark: { tag: 'inf', keyword: null, positional: [MARK_ARGUMENT] },
});

export const OBJECT_PARAM_KINDS: ReadonlySet<string> = new Set(Object.values(OBJECT_KINDS).map((info) => info.paramKind));
export const UID_ATTRIBUTE_NAME = 'uid';
export const KIND_HINT = Object.freeze({ playerTag: 'player', playerKind: 'player', enemyTag: 'enemy', enemyKind: 'actor' });
export const POSITION_ATTRIBUTES = Object.freeze({ x: 'x', y: 'y' });
export const SIZE_ATTRIBUTES = Object.freeze({ w: 'w', h: 'h' });
export const DEFAULT_SIZE = '10';
export const ELEMENT_WITH_UID = /<([a-z_]+)\b[^>]*\buid="([^"]*)"/g;
export const ENGINE_MARK_TAG = 'inf';
export const UNLISTED_KINDS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  door: { moving: 'bool', tarx: 'value', tary: 'value' },
});
export const ANY_TAG = '*';
export const NO_VALUE_KIND = 'nochange';
export const OPEN_LISTS: ReadonlySet<string> = new Set(['char', 'decor_model', 'gun_model']);
const CHARACTER_ACTIONS: Readonly<Record<string, string>> = Object.freeze({
  x: 'MoveCharToReguin', y: 'MoveCharToReguin', hea: 'SetCharHP', hmax: 'SetCharCurrentMaxHPValue', team: 'SetCharTeam', botaction: 'SetAIBehavior', char: 'SetCharSkin',
});
export const RUN_TIME_ACTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  door: { x: 'MovableTo', y: 'MovableTo', maxspeed: 'SetMovableSpeed', mute: 'MuteMovable' },
  region: { x: 'RegionToRegion', y: 'RegionToRegion' },
  player: CHARACTER_ACTIONS,
  actor: CHARACTER_ACTIONS,
  gun: { x: 'MoveGunToReguin', y: 'MoveGunToReguin' },
  barrel: { x: 'MoveBarrelToReguin', y: 'MoveBarrelToReguin' },
  decor: { model: 'SetDecorModel' },
  vehicle: { hpp: 'ChangeVehHPPerc' },
});
