export const TARGETS = Object.freeze(['triggers', 'pcode'] as const);
export type Target = (typeof TARGETS)[number];
export const DEFAULT_TARGET: Target = 'triggers';
export const isTarget = (value: string): value is Target => (TARGETS as readonly string[]).includes(value);

export const VM_LABEL = Object.freeze({
  loop: ':vm.loop',
  load: ':vm.load',
  unpack: ':vm.unpack',
  ready: ':vm.ready',
  handler: (index: number): string => `:vm.h${index}`,
  stopHelper: (index: number): string => `:vm.h${index}.stop`,
});

export const VM_VARIABLE = Object.freeze({
  pc: 'vm.pc',
  key: 'vm.key',
  work: 'vm.work',
  op: 'vm.op',
  base: 'vm.base',
  sp: 'vm.sp',
  ready: 'vm.ready',
  code: 'vm.code',
  item: 'vm.item',
  index: 'vm.index',
  count: 'vm.count',
  number: 'vm.number',
  stackEnd: 'vm.end',
  value: 'vm.value',
  stop: 'vm.stop',
  flag: 'vm.flag',
  fields: ['vm.fa', 'vm.fb', 'vm.fc'],
  registers: ['vm.ra', 'vm.rb', 'vm.rc'],
  suffixes: ['vm.so', 'vm.sa', 'vm.sb', 'vm.sc'],
  pool: (index: number): string => `vm.k${index}`,
});

export const FIELD_STEM = 'vm.';
export const STACK_STEM = 'vm.s';
export const FIELD_SUFFIXES: readonly string[] = Object.freeze(['.o~', '.a~', '.b~', '.c~']);
export const STACK_END = '~';
export const SEPARATOR = '\u241F';
export const EXIT_MARK = '-1';
export const READY_MARK = '1';
export const ONE = '1';
export const TWO = '2';
export const MINUS_ONE = '-1';
export const ZERO = '0';
export const EMPTY = '';
export const PURE_NAME = /^~[^~]+~$/;
export const STOPS_TRIGGER = /continue (trigger actions )?execution|continue execution of this trigger|stop trigger execution/i;
