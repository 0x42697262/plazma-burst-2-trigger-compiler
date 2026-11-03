export type ObjectKindInfo = { paramKind: string; tags: readonly string[] };
export type ConstructorInfo = { tag: string; keyword: string | null; positional: readonly string[] };

export const OBJECT_KINDS: Readonly<Record<string, ObjectKindInfo>> = Object.freeze({
  region: { paramKind: 'region', tags: ['region'] },
  door: { paramKind: 'door', tags: ['door'] },
  player: { paramKind: 'character', tags: ['player'] },
  actor: { paramKind: 'character', tags: ['enemy'] },
  gun: { paramKind: 'gun', tags: ['gun'] },
  barrel: { paramKind: 'barrel', tags: ['barrel'] },
  vehicle: { paramKind: 'vehicle', tags: ['vehicle'] },
  decor: { paramKind: 'decor', tags: ['decor'] },
  pusher: { paramKind: 'pushf', tags: ['pushf'] },
  light: { paramKind: 'lamp', tags: ['lamp'] },
  water: { paramKind: 'water', tags: ['water'] },
  song: { paramKind: 'song+none', tags: ['song'] },
  timer: { paramKind: 'timer', tags: ['timer'] },
  trigger: { paramKind: 'trigger', tags: ['trigger'] },
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
