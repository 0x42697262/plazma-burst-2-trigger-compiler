import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderActions } from './render.ts';
import { ACTIONS_DOC } from './paths.ts';

describe('actions reference', () => {
  it('lists every action once', () => {
    const rows = renderActions().split('\n').filter((line) => /^\| -?\d+ \|/.test(line));
    assert.equal(rows.length, 531);
  });

  it('is up to date in docs/actions.md (run npm run actions-doc)', () => {
    assert.equal(fs.readFileSync(ACTIONS_DOC, 'utf8'), renderActions());
  });
});
