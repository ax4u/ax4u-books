import test from 'node:test';
import assert from 'node:assert/strict';
import { paperCurl } from '../src/app/exhibition/[slug]/paper-curl';

test('bound ribbon keeps arc length, deforms continuously and carries its edge across the binding', () => {
  let previousTip = 2;
  for (let step = 0; step <= 100; step++) {
    const p = step / 100, strips = paperCurl(p), tip = strips.at(-1)!;
    assert.equal(strips[0].x, 0); assert.equal(strips[0].z, 0);
    let length = 0;
    for (let i = 0; i < strips.length; i++) {
      const s = strips[i];
      length += Math.hypot(s.nextX - s.x, s.nextZ - s.z);
      if(i) { assert.equal(s.x, strips[i-1].nextX); assert.equal(s.z, strips[i-1].nextZ); }
      assert.ok(s.z <= 1e-12, 'no viewport protrusion toward camera');
    }
    assert.ok(Math.abs(length - 1) < 1e-10);
    assert.ok(tip.nextX <= previousTip + 1e-10, 'edge travels monotonically to opposite side');
    previousTip = tip.nextX;
    if(p > 0 && p < 1) assert.ok(Math.abs(strips[0].angle-tip.angle) > .01, 'not a rigid plane');
  }
  assert.ok(Math.abs(paperCurl(0).at(-1)!.nextX - 1) < 1e-10);
  assert.ok(Math.abs(paperCurl(1).at(-1)!.nextX + 1) < 1e-10);
  const middle = paperCurl(.5);
  assert.ok(middle.some(s=>Math.cos(s.angle)>0) && middle.some(s=>Math.cos(s.angle)<0), 'both paper normals at halfway');
  assert.ok(Math.max(...middle.map(s=>s.x)) > .2, 'curved paper remains visibly wide at halfway');
});
