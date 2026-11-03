export const COMPARISON = Object.freeze({ string: 'string', number: 'number' } as const);
export const OP_PREFIX = 'op';
export const SIDE_A = 'A';
export const LOOSE_VALUE_KINDS: ReadonlySet<string> = new Set(['string', 'nochange']);
export const NAME_SLOT = (side: string): RegExp => new RegExp(`(?:variables?|[Aa]rray|object) '${side}'|variables '[AB]' and '${side}'`);
export const VALUE_GROUPS: readonly (readonly [string, readonly string[]])[] = Object.freeze([
  ['Color', ['textmsg']],
  ['Team', ['team', 'team+any']],
  ['Behavior', ['botaction']],
  ['Bool', ['bool']],
  ['Toggle', ['enable-disable']],
  ['Calls', ['maxcalls']],
  ['PusherDamage', ['pushf_damage']],
  ['GunModel', ['gun_model']],
  ['Sound', ['sound']],
  ['Sky', ['sky_model']],
  ['Voice', ['voice_preset']],
  ['Skin', ['char']],
  ['DecorModel', ['decor_model']],
  ['Song', ['song+none']],
  ['Direction', ['side']],
  ['Material', ['box_model']],
  ['DrawInFront', ['draw_in_front']],
  ['Upgrade', ['gun_upgrade']],
  ['Activation', ['region_activation']],
  ['BarrelModel', ['barrel_model']],
  ['VehicleModel', ['vehicle_model']],
  ['BackgroundModel', ['bg_model']],
  ['EngineMark', ['engine_mark']],
  ['InVehicle', ['vehicle+none+any']],
]);
export const GROUP_ALIASES: Readonly<Record<string, string>> = Object.freeze({ CharacterModel: 'Skin' });
export const PLACEHOLDER_KEY = /\[/;
export const WORD_SPLIT = /[^A-Za-z0-9]+/;
export const APOSTROPHES = /['’]/g;
export const BRACKETED = /\([^)]*\)/g;
export const WORD_GAP = ' ';
export const STARTS_WITH_DIGIT = /^[0-9]/;
export const IDENTIFIER_VALUE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const COLLISION_SEPARATOR = '_';
export const KIND_SEPARATOR = '+';
export const NONE_NAME = 'None';
export const NONE_VALUE = '-1';
export const NONE_SUFFIX = '+none';
