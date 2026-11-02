import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkTriggers } from './check.ts';
import { action, trigger } from '../program/build.ts';

describe('trigger checks', () => {
  it('warns about a 100th action, which the website editor drops when saving', () => {
    const full = trigger('#full', Array.from({ length: 100 }, () => action(102, 'x', '1')));
    assert.ok(checkTriggers({ triggers: [full], timers: [] }, []).some((warning) => warning.includes('drops it when the map is saved')));
    const fits = trigger('#fits', Array.from({ length: 99 }, () => action(102, 'x', '1')));
    assert.deepEqual(checkTriggers({ triggers: [fits], timers: [] }, []), []);
  });

  it('warns about text that the website editor turns into a number', () => {
    const risky = trigger('#risky', [action(100, '~x~', '0123456789.')]);
    assert.ok(checkTriggers({ triggers: [risky], timers: [] }, []).some((warning) => warning.includes('into the number 123456789')));
    const plain = trigger('#plain', [action(100, '~x~', '12'), action(100, '~y~', '_007')]);
    assert.deepEqual(checkTriggers({ triggers: [plain], timers: [] }, []), []);
  });
});
