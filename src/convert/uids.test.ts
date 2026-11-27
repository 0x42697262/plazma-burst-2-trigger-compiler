import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withConvertedUids } from './uids.ts';

describe('converted uids in a host map', () => {
  it('gives repeated and missing uids the ones npm run convert gives, and leaves the rest as it is', () => {
    const map = [
      '<door uid="#d&amp;1" x="0" y="0" />',
      '<door uid="#d&amp;1" x="5" y="0" />',
      '<trigger x="0" y="0" enabled="true" />',
      '<box x="0" y="0" w="10" h="10" m="0" />',
      '<region uid="#trigger*1" x="0" y="0" w="1" h="1" />',
      '',
    ].join('\r\n');
    const renamed = withConvertedUids(map);
    assert.equal(renamed.changed, 2);
    assert.equal(renamed.xml, [
      '<door uid="#d&amp;1" x="0" y="0" />',
      '<door uid="#d&amp;1*1" x="5" y="0" />',
      '<trigger uid="#trigger*2" x="0" y="0" enabled="true" />',
      '<box x="0" y="0" w="10" h="10" m="0" />',
      '<region uid="#trigger*1" x="0" y="0" w="1" h="1" />',
      '',
    ].join('\r\n'));
    assert.deepEqual(withConvertedUids(renamed.xml), { xml: renamed.xml, changed: 0 });
  });
});
