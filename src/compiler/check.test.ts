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
});
