export const ID = Object.freeze({
  root: 'root', actions: 'actions', objects: 'objects', values: 'values', kinds: 'kinds', builtins: 'builtins', language: 'language', marks: 'marks',
});
export const ID_PREFIX = Object.freeze({
  category: 'category:', action: 'action:', object: 'object:', values: 'values:', kind: 'kind:', builtin: 'builtin:', keyword: 'keyword:', mark: 'mark:',
});
export const ENTRY_KIND = Object.freeze({
  root: 'root', category: 'category', action: 'action', object: 'object', values: 'values', kind: 'kind', builtin: 'builtin', keyword: 'keyword', mark: 'mark',
} as const);
export const ROOT_ORDER: readonly string[] = Object.freeze([ID.actions, ID.objects, ID.values, ID.marks, ID.builtins, ID.language, ID.kinds]);
export const CATEGORY_SEPARATOR = ' › ';
export const UNCATEGORIZED = 'Other';
export const OP_PREFIX = 'op';
export const SIDE_NAMES = Object.freeze({ a: 'A', b: 'B' });
export const ENGINE_MARK_CONSTRUCTOR = 'EngineMark';
export const MARK_KIND = 'engine_mark';
export const NOTE_SEPARATOR = ', ';
export const KIND_SEPARATOR = '+';
