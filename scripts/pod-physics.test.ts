import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PodSimulation, capsuleSeparation, closestSegmentSegment, resolveCapsuleCollision, type PodSpec } from '../src/app/whale-flight/pod-physics';
const started = performance.now();
const spec = (id: string, mass = 1): PodSpec => ({ id, species: 'test', length: 2, radius: 1, mass, speed: 4 });
function residual(s: PodSimulation) {
  let max = 0;
  for (let i = 0; i < s.bodies.length; i++) for (let j = i + 1; j < s.bodies.length; j++) max = Math.max(max, -capsuleSeparation(s.bodies[i], s.bodies[j]).distance);
  return max;
}
const sim = new PodSimulation([spec('heavy', 10), spec('light')], 42);
sim.bodies[0].position.set(-3, 0, -50); sim.bodies[1].position.set(3, 0, -50);
sim.bodies[0].velocity.set(10, 0, 0); sim.bodies[1].velocity.set(-10, 0, 0);
for (let i = 0; i < 30; i++) sim.step(1 / 60, false);
assert.ok(sim.stats.collisions > 0, 'head-on must generate an impulse');
assert.ok(sim.bodies[1].velocity.x > sim.bodies[0].velocity.x, 'light body must bounce faster');
assert.ok(residual(sim) < .05);
const pair = new PodSimulation([spec('a', 10), spec('b')]);
pair.bodies[0].position.set(0, 0, -50); pair.bodies[1].position.set(1.5, 0, -50);
pair.bodies[0].velocity.set(10, 0, 0); pair.bodies[1].velocity.set(-10, 0, 0);
assert.equal(pair.measurePenetration(), .5, 'residual must measure real overlap');
const momentum = pair.bodies[0].velocity.x * 10 + pair.bodies[1].velocity.x;
const impulse = resolveCapsuleCollision(...pair.bodies as [typeof pair.bodies[0], typeof pair.bodies[0]]);
assert.ok(impulse > 0);
assert.ok(Math.abs(pair.bodies[0].velocity.x * 10 + pair.bodies[1].velocity.x - momentum) < 1e-9);
assert.ok(Math.abs((pair.bodies[1].velocity.x - pair.bodies[0].velocity.x) / 20 - .32) < 1e-9);
assert.ok(Math.abs(pair.bodies[0].position.x) < Math.abs(pair.bodies[1].position.x - 1.5), 'heavy moves less under projection');
console.log('PASS mass-weighted head-on, restitution, momentum, measured residual');

const closest = closestSegmentSegment(new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0), new THREE.Vector3(0, -2, 3), new THREE.Vector3(0, 2, 3));
assert.equal(closest.pointA.distanceTo(closest.pointB), 3);
const parallel = closestSegmentSegment(new THREE.Vector3(), new THREE.Vector3(0, 0, 10), new THREE.Vector3(2, 0, 4), new THREE.Vector3(2, 0, 14));
assert.equal(parallel.pointA.distanceTo(parallel.pointB), 2);
console.log('PASS exact skew/parallel finite-segment geometry');

const fast = new PodSimulation([{ ...spec('fast-a'), length: 12, radius: .5 }, { ...spec('fast-b'), length: 12, radius: .5 }]);
fast.bodies[0].position.set(-20, 0, -50); fast.bodies[1].position.set(0, -20, -50);
fast.bodies[0].velocity.set(2000, 0, 0); fast.bodies[1].velocity.set(0, 2000, 0);
fast.bodies[1].quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
fast.step(.025, false);
assert.ok(fast.stats.collisions > 0, 'high-speed crossing capsules must not tunnel');
assert.ok(fast.stats.sweptCandidates > 0);
assert.ok(residual(fast) < .05);
assert.ok(fast.bodies[0].velocity.distanceTo(new THREE.Vector3(2000, 0, 0)) > 10, 'crossing must actually change velocity');
console.log('PASS 2000-unit/s perpendicular capsule crossing without tunnelling');

const dense = new PodSimulation(Array.from({ length: 24 }, (_, i) => ({ ...spec(`d${i}`, 1 + i % 5), length: 6 })), 19);
for (const [i, b] of dense.bodies.entries()) { b.position.set((i % 4) * .4, Math.floor(i / 4) * .4, -100); b.velocity.set(i % 2 ? 20 : -20, 5, 0); }
for (let i = 0; i < 120; i++) dense.step(1 / 60, false);
for (const b of dense.bodies) assert.ok([...b.position.toArray(), ...b.velocity.toArray(), ...b.quaternion.toArray()].every(Number.isFinite));
assert.ok(residual(dense) < .05);
console.log('PASS dense 24-capsule multi-contact stability');

const types = [ ['blue', 41, 8.11, 120, 1.2], ['humpback', 27, 6, 35, 1.35], ['sperm', 25, 4.5, 45, 1.15], ['orca', 13, 2.6, 6, 1.7], ['porpoise', 3.5, .7, .15, 1.3] ] as const;
const specs = Array.from({ length: 100 }, (_, i) => { const t = types[i % 5]; return { id: `w${i}`, species: t[0], length: t[1], radius: t[2], mass: t[3], speed: t[4] }; });
const long = new PodSimulation(specs, 98765), repeat = new PodSimulation(specs, 98765);
assert.deepEqual(long.bodies.map(b => b.position.toArray()), repeat.bodies.map(b => b.position.toArray()));
const depth = [0, 0, 0];
const cells = new Set<string>();
for (const b of long.bodies) {
  assert.ok(b.position.z <= -100 && b.position.z >= -540, 'calm distant water, never a near-camera cluster');
  depth[-b.position.z < 240 ? 0 : -b.position.z < 390 ? 1 : 2]++;
  const hh = (28 - b.position.z) * Math.tan(THREE.MathUtils.degToRad(52 / 2));
  const nx = b.position.x / (hh * 16 / 9), ny = b.position.y / hh;
  assert.ok(Math.abs(nx) <= .8 && Math.abs(ny) <= .8, 'spread within observation frustum');
  cells.add(`${Math.floor((nx + .8) / .4)},${Math.floor((ny + .8) / .4)}`);
}
assert.ok(cells.size >= 14, 'fill the screen, not school centers');
assert.ok(depth.every(n => n >= 25), 'depth is dispersed');
assert.ok(residual(long) < .0001, 'initial capsules cannot overlap');
const initialPositions = long.bodies.map(b => b.position.clone());
const previousQuaternions = long.bodies.map(b => b.quaternion.clone());
const travelled = long.bodies.map(() => 0);
const previousPositions = initialPositions.map(p => p.clone());
const modes = new Set<string>(); let maxResidual = 0, minSpeed = Infinity, maxSpeed = 0, maxTurnRate = 0;
const mobile = new PodSimulation(specs, 98765, { aspect: 9 / 19.5, fov: 68 });
assert.ok(residual(mobile) < .0001);
for (const b of mobile.bodies) {
  const hh = (28 - b.position.z) * Math.tan(THREE.MathUtils.degToRad(34));
  assert.ok(Math.abs(b.position.x / (hh * 9 / 19.5)) < .8 && Math.abs(b.position.y / hh) < .8);
}
console.log('PASS stratified desktop/mobile frusta, 100 nonoverlapping conservative capsules');
// A distant whale must not affect another whale through migration or mode clocks.
const independentA = new PodSimulation(specs.slice(0, 2), 381);
const independentB = new PodSimulation(specs.slice(0, 2), 381);
independentA.bodies[1].position.set(10000, 10000, -400);
independentB.bodies[1].position.set(-10000, -10000, -400);
for (let i = 0; i < 3600; i++) { independentA.step(1 / 60); independentB.step(1 / 60); }
assert.deepEqual(independentA.bodies[0].position.toArray(), independentB.bodies[0].position.toArray());
assert.deepEqual(independentA.bodies[0].quaternion.toArray(), independentB.bodies[0].quaternion.toArray());
console.log('PASS no nonlocal coupling');
for (let frame = 0; frame < 7200; frame++) {
  const collisionsBefore = long.stats.collisions;
  long.step(1 / 60);
  maxResidual = Math.max(maxResidual, long.stats.maxPenetration);
  assert.ok(long.stats.maxPenetration <= .05, `overlap at ${long.time}: ${long.stats.maxPenetration}`);
  for (const [i, b] of long.bodies.entries()) {
    const turnRate = previousQuaternions[i].angleTo(b.quaternion) * 60;
    maxTurnRate = Math.max(maxTurnRate, turnRate);
    assert.ok(turnRate <= .0751, `slow body turn: ${turnRate}`);
    previousQuaternions[i].copy(b.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(b.quaternion);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(b.quaternion);
    assert.ok(up.y >= Math.cos(.251), 'dorsal side remains world-up, never flips');
    assert.ok(Math.abs(Math.asin(forward.y)) <= .2501, 'pitch stays shallow');
    assert.ok(b.velocity.length() <= b.spec.speed * 1.151, 'no sprint');
    if (long.stats.collisions === collisionsBefore) assert.ok(forward.dot(b.velocity.clone().normalize()) > .99999, 'no sideways swimming outside physical impacts');
    assert.ok(Math.abs(new THREE.Vector3(1, 0, 0).applyQuaternion(b.quaternion).y) < 1e-8, 'zero unintended bank');
    const travel = previousPositions[i].distanceTo(b.position);
    assert.ok(travel < .2, 'no teleport');
    travelled[i] += travel; previousPositions[i].copy(b.position);
    modes.add(b.mode); minSpeed = Math.min(minSpeed, b.velocity.length()); maxSpeed = Math.max(maxSpeed, b.velocity.length());
    assert.ok([...b.position.toArray(), ...b.velocity.toArray(), ...b.quaternion.toArray()].every(Number.isFinite));
    assert.ok(Math.abs(b.quaternion.length() - 1) < 1e-8);
  }
  if (frame % 600 === 0) assert.ok(Math.abs(residual(long) - long.stats.maxPenetration) < 1e-9);
}
assert.ok(Math.abs(long.time - 120) < 1e-7);
assert.deepEqual([...modes].sort(), ['school', 'solo']);
assert.ok(long.stats.modeTransitions > 100);
assert.ok(travelled.every(d => d > 70), 'all 100 whales continuously swim');
assert.ok(long.bodies.every((b, i) => b.position.distanceTo(initialPositions[i]) > 10), 'no fixed poses or tiny orbit');
assert.ok(long.stats.avoidances > 0);
// Exercise the tighter portrait volume too, not merely initial placement.
let mobileNearest = -Infinity, mobileResidual = 0;
for (let frame = 0; frame < 7200; frame++) {
  mobile.step(1 / 60);
  mobileResidual = Math.max(mobileResidual, mobile.stats.maxPenetration);
  assert.ok(mobile.stats.maxPenetration <= .05);
  for (const b of mobile.bodies) {
    mobileNearest = Math.max(mobileNearest, b.position.z + b.spec.radius);
    assert.ok(b.velocity.length() <= b.spec.speed * 1.151);
    assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(b.quaternion).y >= Math.cos(.251));
    assert.ok(b.position.z + b.spec.radius < -65, 'soft depth barrier prevents camera approaches');
  }
}
assert.ok(Math.abs(mobile.time - 120) < 1e-7);
for (const seed of [12345, 42, 1]) {
  const sample = new PodSimulation(specs, seed, { aspect: 9 / 19.5, fov: 68 });
  assert.ok(residual(sample) < .0001, `portrait placement seed ${seed}`);
}
console.log(JSON.stringify({ test: 'PASS portrait 100 bodies / 120 seconds and additional seeds', mobileNearest, mobileResidual, stats: mobile.stats }));
console.log(JSON.stringify({ test: 'PASS seeded 100 bodies / 120 simulated seconds', time: long.time, initialDepth: depth, maxResidual, minSpeed, maxSpeed, maxTurnRate, minTravel: Math.min(...travelled), stats: long.stats, wallSeconds: (performance.now() - started) / 1000 }, null, 2));
