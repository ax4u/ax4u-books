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

const types = [ ['blue', 24, 6, 120, 5], ['humpback', 14.5, 5, 35, 6], ['sperm', 16, 3.8, 45, 5], ['orca', 7, 2.1, 6, 8], ['porpoise', 1.8, .55, .15, 10] ] as const;
const specs = Array.from({ length: 100 }, (_, i) => { const t = types[i % 5]; return { id: `w${i}`, species: t[0], length: t[1], radius: t[2], mass: t[3], speed: t[4] }; });
const long = new PodSimulation(specs, 98765), repeat = new PodSimulation(specs, 98765);
assert.deepEqual(long.bodies.map(b => b.position.toArray()), repeat.bodies.map(b => b.position.toArray()));
assert.equal(new Set(long.bodies.map(b => b.school)).size, 5);
const depth = [0, 0, 0];
for (const b of long.bodies) depth[-b.position.z < 80 ? 0 : -b.position.z < 300 ? 1 : 2]++;
assert.deepEqual(depth, [10, 40, 50]);
assert.ok(residual(long) < .0001, 'initial capsules cannot overlap');
const modes = new Set<string>(); let maxResidual = 0, minSpeed = Infinity, maxSpeed = 0;
for (let frame = 0; frame < 7200; frame++) {
  long.step(1 / 60);
  maxResidual = Math.max(maxResidual, long.stats.maxPenetration);
  assert.ok(long.stats.maxPenetration <= .05, `overlap at ${long.time}: ${long.stats.maxPenetration}`);
  for (const b of long.bodies) {
    modes.add(b.mode); minSpeed = Math.min(minSpeed, b.velocity.length()); maxSpeed = Math.max(maxSpeed, b.velocity.length());
    assert.ok([...b.position.toArray(), ...b.velocity.toArray(), ...b.quaternion.toArray()].every(Number.isFinite));
    assert.ok(Math.abs(b.quaternion.length() - 1) < 1e-8);
  }
  if (frame % 600 === 0) assert.ok(Math.abs(residual(long) - long.stats.maxPenetration) < 1e-9);
}
assert.ok(Math.abs(long.time - 120) < 1e-7);
assert.deepEqual([...modes].sort(), ['school', 'solo', 'sprint']);
assert.ok(long.stats.modeTransitions > 100 && maxSpeed - minSpeed > 5);
assert.ok(long.stats.avoidances > 0);
console.log(JSON.stringify({ test: 'PASS seeded 100 bodies / 120 simulated seconds', time: long.time, initialDepth: depth, maxResidual, minSpeed, maxSpeed, stats: long.stats, wallSeconds: (performance.now() - started) / 1000 }, null, 2));
