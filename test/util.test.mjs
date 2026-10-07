import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { describe, it } from 'node:test';
import { compareVersions, inRange } from '../dist/core/initializr.js';
import { findFreePort, randomPassword } from '../dist/core/util.js';

describe('findFreePort', () => {
  it('dolu portu ve daha önce verilen portları atlar', async () => {
    const server = createServer();
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const busy = server.address().port;
    try {
      const taken = new Set();
      const first = await findFreePort(busy, taken);
      assert.notEqual(first, busy);
      assert.ok(taken.has(first));
      const second = await findFreePort(busy, taken);
      assert.notEqual(second, first);
    } finally {
      server.close();
    }
  });
});

describe('randomPassword', () => {
  it('istenen uzunlukta, karışması kolay karakterler olmadan üretir', () => {
    const pw = randomPassword(48);
    assert.equal(pw.length, 48);
    assert.match(pw, /^[a-km-zA-HJ-NP-Z2-9]+$/);
    assert.notEqual(randomPassword(), randomPassword());
  });
});

describe('Spring Initializr sürüm aralıkları', () => {
  it('kararlı sürüm aynı numaralı M/RC sürümlerinden büyüktür', () => {
    assert.ok(compareVersions('4.1.0', '4.1.0-RC1') > 0);
    assert.ok(compareVersions('4.1.0-RC1', '4.1.0-M2') > 0);
    assert.ok(compareVersions('4.0.10', '4.0.9') > 0);
  });

  it('aralık sınırlarını doğru uygular', () => {
    assert.ok(inRange('4.1.1', '4.0.0'));
    assert.ok(inRange('4.1.1', '[4.0.0,4.2.0-M1)'));
    assert.ok(!inRange('4.2.0', '[4.0.0,4.2.0-M1)'));
    assert.ok(!inRange('3.5.0', '[4.0.0,4.2.0-M1)'));
  });
});
