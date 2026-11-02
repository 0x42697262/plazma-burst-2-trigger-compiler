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
  ['CharacterModel', ['char']],
  ['DecorModel', ['decor_model']],
  ['Song', ['song+none']],
]);
export const PLACEHOLDER_KEY = /\[/;
export const WORD_SPLIT = /[^A-Za-z0-9]+/;
export const APOSTROPHES = /['’]/g;
export const STARTS_WITH_DIGIT = /^[0-9]/;
export const IDENTIFIER_VALUE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const COLLISION_SEPARATOR = '_';
