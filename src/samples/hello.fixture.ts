import { action, trigger } from '../program/build.ts';
import type { Program } from '../program/types.ts';

export const HELLO_UID = Object.freeze({
  main: '#ptc_hello_main',
  add: '#ptc_hello_add',
  done: '#ptc_hello_done',
  start: '#ptc_hello_start',
});

export const HELLO_VARIABLE = Object.freeze({
  count: '~ptc_hello_count~',
  done: '~ptc_hello_done~',
  unreachable: '~ptc_hello_unreachable~',
});

export const HELLO_EXPECTED = Object.freeze({
  variables: { [HELLO_VARIABLE.count]: 2, [HELLO_VARIABLE.done]: 1 },
  missing: [HELLO_VARIABLE.unreachable],
  chat: 'ptc hello: count = 2',
});

export const HELLO: Program = {
  triggers: [
    trigger(HELLO_UID.main, [
      action(100, HELLO_VARIABLE.count, '0'),
      action(99, HELLO_UID.add),
      action(99, HELLO_UID.add),
      action(363, HELLO_UID.done),
      action(100, HELLO_VARIABLE.unreachable, '1'),
    ]),
    trigger(HELLO_UID.add, [
      action(102, HELLO_VARIABLE.count, '1'),
    ]),
    trigger(HELLO_UID.done, [
      action(42, `ptc hello: count = ${HELLO_VARIABLE.count}`, '0'),
      action(100, HELLO_VARIABLE.done, '1'),
    ]),
  ],
  startTimer: { uid: HELLO_UID.start, target: HELLO_UID.main },
};
