import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MajesticSimulation } from '../src/app/whale-flight/majestic-physics';

const measured = {
  blue: [41.21378721049213, 8.114526304895866, 24, 80000, 1.9],
  humpback: [24.966479556887457, 5.231211109307654, 14.5, 30000, 1.65],
  sperm: [24.308124225973028, 3.6855403073359394, 16, 40000, 1.8],
  orca: [12.893591799704385, 2.6733050296882612, 7, 5000, 2.6],
} as const;
const ids = ['humpback-01', 'blue-01', 'orca-01', 'sperm-01', 'humpback-02', 'blue-02', 'orca-02', 'sperm-02', 'blue-03', 'humpback-03'];
const specs = ids.map(id => {
  const species = id.split('-')[0] as keyof typeof measured;
  const [length, radius, visualLength, mass, baseSpeed] = measured[species];
  // Same per-species actor index, phase and speed multiplier as flight-scene.ts.
  const index = Number(id.split('-')[1]) - 1;
  const phase = (index * .61803398875 + ['blue', 'humpback', 'sperm', 'orca'].indexOf(species) * .173) % 1;
  return { id, species, length, radius, visualLength, mass, speed: baseSpeed * (.75 + phase * .65) };
});
const landscape = { aspect: 16 / 9, fov: 52 };
const portrait = { aspect: 9 / 16, fov: 68 };
function screen(sim: MajesticSimulation, viewport: typeof landscape) {
  const t = Math.tan(viewport.fov * Math.PI / 360);
  return sim.bodies.map((b, i) => {
    const d = 28 - b.position.z;
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(b.quaternion);
    return { x: b.position.x / (d * t * viewport.aspect), y: b.position.y / (d * t),
      span: specs[i].visualLength * Math.abs(axis.x) / (2 * d * t * viewport.aspect) };
  });
}
test('each swimmer varies its own pace rather than sharing a nearly constant school speed', () => {
  const sim = new MajesticSimulation(specs, 42721, landscape);
  const ranges = specs.map(() => ({ min: Infinity, max: 0 }));
  let minimumSimultaneousSpread = Infinity;
  for (let second = 0; second < 120; second++) {
    sim.step(1);
    const ratios = sim.bodies.map((b, i) => {
      const ratio = b.velocity.length() / b.spec.speed;
      ranges[i].min = Math.min(ranges[i].min, ratio);
      ranges[i].max = Math.max(ranges[i].max, ratio);
      assert.ok(ratio <= 1.45 + 1e-8);
      return ratio;
    });
    if (second > 5) minimumSimultaneousSpread = Math.min(minimumSimultaneousSpread, Math.max(...ratios) - Math.min(...ratios));
  }
  assert.ok(ranges.every(r => r.max - r.min > .25), JSON.stringify(ranges));
  assert.ok(minimumSimultaneousSpread > .15, String(minimumSimultaneousSpread));
  console.log('independent pace ratios:', { ranges, minimumSimultaneousSpread });
});

test('each course bends in three dimensions and changes curvature within 120 seconds', () => {
  const sim = new MajesticSimulation(specs, 42721, landscape);
  const ranges = sim.bodies.map(b => ({ min: b.position.clone(), max: b.position.clone(), bends: 0, sign: 0 }));
  for (let second = 0; second < 120; second++) {
    const before = sim.bodies.map(b => b.velocity.clone().normalize());
    sim.step(1);
    sim.bodies.forEach((b, i) => {
      const r = ranges[i];
      r.min.min(b.position); r.max.max(b.position);
      const bend = before[i].clone().cross(b.velocity.clone().normalize()).y;
      if (Math.abs(bend) > .003) {
        const sign = Math.sign(bend);
        if (r.sign && sign !== r.sign) r.bends++;
        r.sign = sign;
      }
    });
  }
  const metrics = ranges.map(r => ({ extent: r.max.clone().sub(r.min).toArray(), bends: r.bends }));
  assert.ok(metrics.every(r => r.extent[0] > 20 && r.extent[1] > 4 && r.extent[2] > 6 && r.bends >= 2), JSON.stringify(metrics));
  console.log('120s independent curves:', metrics);
});

test('seed replays exactly and adding a distant swimmer cannot retime an existing course', () => {
  const replayA = new MajesticSimulation(specs, 42721, landscape);
  const replayB = new MajesticSimulation(specs, 42721, landscape);
  const otherSeed = new MajesticSimulation(specs, 8197, landscape);
  const alone = new MajesticSimulation([specs[0]], 42721, landscape);
  const withDistant = new MajesticSimulation([specs[0], specs[1]], 42721, landscape);
  withDistant.bodies[1].position.set(1e6, 1e6, -1e6);
  for (let second = 0; second < 60; second++) {
    for (const sim of [replayA, replayB, otherSeed, alone, withDistant]) sim.step(1);
    replayA.bodies.forEach((b, i) => {
      assert.ok(b.position.equals(replayB.bodies[i].position));
      assert.ok(b.velocity.equals(replayB.bodies[i].velocity));
      assert.ok(b.quaternion.equals(replayB.bodies[i].quaternion));
    });
    assert.ok(alone.bodies[0].position.distanceTo(withDistant.bodies[0].position) < 1e-8, 'independent course phase');
    assert.ok(alone.bodies[0].velocity.distanceTo(withDistant.bodies[0].velocity) < 1e-8);
  }
  assert.ok(replayA.bodies.every((b, i) => b.position.distanceTo(otherSeed.bodies[i].position) > 1));
});

test('viewport reflow retains NDC, at least 65% screen span, pose, velocity, IDs and time', () => {
  const sim = new MajesticSimulation(specs, 42721, portrait);
  const bodies = [...sim.bodies];
  sim.step(11);
  let minimumSpanRetention = Infinity;
  let previous = portrait;
  for (const viewport of [landscape, portrait, { aspect: 2.2, fov: 52 }, portrait]) {
    const before = screen(sim, previous);
    const poses = bodies.map(b => ({ q: b.quaternion.clone(), v: b.velocity.clone(), spec: { ...b.spec } }));
    const t = sim.time;
    sim.updateViewport(viewport);
    const after = screen(sim, viewport);
    for (let i = 0; i < bodies.length; i++) {
      assert.equal(sim.bodies[i], bodies[i]);
      assert.ok(Math.abs(before[i].x - after[i].x) < 1e-8);
      assert.ok(Math.abs(before[i].y - after[i].y) < 1e-8);
      minimumSpanRetention = Math.min(minimumSpanRetention, after[i].span / before[i].span);
      assert.ok(after[i].span / before[i].span >= .65, `span ${i}: ${after[i].span / before[i].span}`);
      assert.ok(poses[i].q.equals(bodies[i].quaternion));
      assert.ok(poses[i].v.equals(bodies[i].velocity));
      assert.deepEqual(poses[i].spec, bodies[i].spec);
    }
    assert.equal(sim.time, t);
    assert.ok(sim.measurePenetration() < .001);
    previous = viewport;
  }
  console.log('minimum resize screen-span retention:', minimumSpanRetention);
});

test('resized frustum drives subsequent outside-frame turns, not stale landscape limits', () => {
  const sim = new MajesticSimulation([specs[0]], 42721, landscape);
  sim.updateViewport(portrait);
  const b = sim.bodies[0], q = b.quaternion.clone();
  const hw = (28 - b.position.z) * Math.tan(portrait.fov * Math.PI / 360) * portrait.aspect;
  b.position.x = hw * 1.6 + b.spec.length / 2 + 1;
  sim.step(5);
  assert.ok(q.angleTo(b.quaternion) > .15, 'new portrait boundary must initiate a gentle U-turn');
});

test('free collision substeps deflect fast real envelopes with restitution, without tunneling', () => {
  const sim = new MajesticSimulation([specs[2], { ...specs[2], id: 'orca-test' }]);
  const [a, b] = sim.bodies;
  a.position.set(-12, 0, -80); b.position.set(12, 0, -80);
  a.velocity.set(200, 0, 0); b.velocity.set(-200, 0, 0);
  sim.step(.2, false);
  assert.ok(a.position.x < b.position.x);
  assert.ok(a.velocity.x < 0 && b.velocity.x > 0);
  assert.ok(sim.stats.collisions > 0 && sim.stats.impulse > 0 && sim.stats.sweptCandidates > 0);
  assert.ok(sim.stats.steps > 12);
  assert.ok(sim.measurePenetration() < .001);
  assert.throws(() => sim.step(-1));
  assert.throws(() => sim.updateViewport({ aspect: 0 }));
});

test('120 seconds: every whale travels, upright rate-limited turns, rotation-safe standoff', () => {
  const sim = new MajesticSimulation(specs, 42721, landscape);
  const origins = sim.bodies.map(b => b.position.clone());
  const traveled = origins.map(() => 0);
  let viewport = landscape, maxYawRate = 0, visibleSilhouettes = 0, visibleTurns = 0, visibleSamples = 0, crossings = 0;
  for (let frame = 0; frame < 120 * 30; frame++) {
    if (frame > 0 && frame % 900 === 0) {
      viewport = viewport.aspect < 1 ? landscape : portrait;
      sim.updateViewport(viewport);
    }
    const before = sim.bodies.map(b => ({ p: b.position.clone(), q: b.quaternion.clone() }));
    const beforeNdc = screen(sim, viewport);
    sim.step(1 / 30);
    const projected = screen(sim, viewport);
    sim.bodies.forEach((b, i) => {
      traveled[i] += b.position.distanceTo(before[i].p);
      maxYawRate = Math.max(maxYawRate, b.quaternion.angleTo(before[i].q) * 30);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(b.quaternion);
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(b.quaternion);
      assert.ok(up.y >= Math.cos(.30) - 1e-8);
      assert.ok(Math.abs(new THREE.Vector3(1, 0, 0).applyQuaternion(b.quaternion).y) < 1e-8, 'no roll');
      assert.ok(Math.abs(b.quaternion.length() - 1) < 1e-8);
      assert.ok(28 - b.position.z >= 2.5 * b.spec.radius + 4 - 1e-5, b.spec.id);
      assert.ok(b.velocity.length() <= b.spec.speed * 1.45 + 1e-8);
      if (Math.abs(projected[i].x) < 1 && Math.abs(projected[i].y) < 1) {
        visibleSamples++;
        if (Math.abs(axis.x) > .55) visibleSilhouettes++;
        if (Math.abs(axis.z) > .4) visibleTurns++;
      }
      if (beforeNdc[i].x * projected[i].x < 0) crossings++;
    });
    assert.ok(sim.measurePenetration() < .001);
  }
  assert.ok(traveled.every(d => d > 20), JSON.stringify(traveled));
  // Dynamic swimming allows visible oblique arcs, but no abrupt spins or rolls.
  assert.ok(maxYawRate < .225, String(maxYawRate));
  assert.ok(visibleSilhouettes / visibleSamples > .5, String(visibleSilhouettes / visibleSamples));
  assert.ok(visibleTurns / visibleSamples > .1, String(visibleTurns / visibleSamples));
  assert.ok(crossings >= 2, String(crossings));
  assert.ok(Math.abs(sim.time - 120) < 1e-7);
  console.log('120s metrics:', { traveled: traveled.map(n => +n.toFixed(2)), maxYawRate, silhouetteFraction: visibleSilhouettes / visibleSamples, visibleTurnFraction: visibleTurns / visibleSamples, crossings, penetration: sim.measurePenetration() });
});

test('fixed portrait and ultrawide each survive 120 seconds with genuine across-frame travel', () => {
  for (const viewport of [portrait, { aspect: 2.2, fov: 52 }]) {
    const sim = new MajesticSimulation(specs, 42721, viewport);
    const initial = screen(sim, viewport);
    const ranges = initial.map(p => ({ min: p.x, max: p.x }));
    let minimumStandoff = Infinity;
    for (let frame = 0; frame < 120 * 20; frame++) {
      sim.step(1 / 20);
      const positions = screen(sim, viewport);
      sim.bodies.forEach((b, i) => {
        ranges[i].min = Math.min(ranges[i].min, positions[i].x);
        ranges[i].max = Math.max(ranges[i].max, positions[i].x);
        minimumStandoff = Math.min(minimumStandoff, 28 - b.position.z - 2.5 * b.spec.radius - 4);
        assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(b.quaternion).y >= Math.cos(.30) - 1e-8);
      });
      assert.ok(sim.measurePenetration() < .001);
      assert.ok(minimumStandoff >= -1e-5);
    }
    const traversals = ranges.filter(r => r.max - r.min > 1.8).length;
    assert.ok(traversals >= 2, JSON.stringify(ranges));
    console.log('fixed viewport:', { ...viewport, traversals, minimumStandoff, penetration: sim.measurePenetration() });
  }
});

test('ten measured envelopes produce a foreground silhouette, supporting cast and unique stable identities', () => {
  const sim = new MajesticSimulation(specs, 42721, landscape);
  assert.deepEqual(sim.bodies.map(b => b.spec.id), ids);
  const projected = screen(sim, landscape);
  assert.ok(projected[0].span >= .4 && projected[0].span <= .55, JSON.stringify(projected));
  assert.ok(projected[1].span >= .3 && projected[1].span <= .4);
  assert.ok(projected.slice(2).every(p => p.span >= .1 && p.span <= .25), JSON.stringify(projected));
  assert.equal(new Set(sim.bodies.map(b => b.phase)).size, 10);
  assert.ok(sim.measurePenetration() < .001);
  console.log('initial screen widths:', projected.map(p => Number(p.span.toFixed(3))));
});

test('repeated orientation and toolbar changes do not progressively shrink the foreground whale', () => {
  const sim = new MajesticSimulation(specs, 42721, portrait);
  const before = screen(sim, portrait);
  for (let repeat = 0; repeat < 12; repeat++) {
    for (const view of [landscape, {aspect: 932 / 370, fov: 52}, portrait]) sim.updateViewport(view);
    const after = screen(sim, portrait);
    assert.ok(Math.abs(after[0].span / before[0].span - 1) < .001);
    assert.ok(Math.abs(after[1].span / before[1].span - 1) < .001);
    assert.ok(sim.measurePenetration() < .001);
  }
});

test('ten-minute passage retains a visible cast and near-depth presence without cumulative retreat', () => {
  const view = {aspect: 1.6, fov: 52};
  const sim = new MajesticSimulation(specs, 42721, view);
  let minimumVisible = 10, sumVisible = 0, maximumNearDepth = 0;
  for (let second = 0; second < 600; second++) {
    sim.step(1);
    const visible = screen(sim, view).filter(p => Math.abs(p.x) < 1 && Math.abs(p.y) < 1).length;
    minimumVisible = Math.min(minimumVisible, visible); sumVisible += visible;
    maximumNearDepth = Math.max(maximumNearDepth, Math.min(...sim.bodies.map(b => 28-b.position.z)));
    assert.ok(sim.measurePenetration() < .001);
  }
  console.log('600s composition:', {minimumVisible, meanVisible: sumVisible / 600, maximumNearDepth});
  assert.ok(minimumVisible >= 3, String(minimumVisible));
  assert.ok(sumVisible / 600 >= 5, String(sumVisible / 600));
  assert.ok(maximumNearDepth < 40, String(maximumNearDepth));
});
