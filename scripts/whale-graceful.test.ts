import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PodSimulation } from '../src/app/whale-flight/pod-physics';
const scene = readFileSync('src/app/whale-flight/flight-scene.ts', 'utf8');
const ui = readFileSync('src/app/whale-flight/FlightExperience.tsx', 'utf8');
test('quiet observer completely replaces the automatic eye / fly-in camera', () => {
  assert.doesNotMatch(scene, /heroEye|eyeMesh|cameraBlend|targetBlend|closeCamera|elapsed\s*%\s*20|telephoto lens/i);
  assert.match(scene, /camera\.position\.set\(0, 0, 28\)/);
  assert.match(scene, /camera\.lookAt\(0, 0, -140\)/);
  assert.match(scene, /camera\.fov = mobile \? 68 : 52/);
  assert.match(scene, /cameraMode = "quiet-observer"/);
  assert.match(scene, /motionEdition = "majestic-ten-v1"/);
  assert.doesNotMatch(scene, /camera\.position\.lerp|camera\.fov\s*=\s*THREE/);
  assert.doesNotMatch(ui, /onPointerMove|onPointerLeave|setPointer/);
});
test('all original bodies and independent native animation cycles are retained', () => {
  assert.match(scene, /cloneSkeleton\(normalized\)/);
  assert.match(scene, /swimming\.duration \/ \(species\.id === "orca" \? 6 : 9\)/);
  assert.match(scene, /animal\.root\.position\.copy\(body\.position\)/);
  assert.match(scene, /animal\.root\.quaternion\.copy\(body\.quaternion\)/);
  assert.match(scene, /animals\.length !== ANIMAL_COUNT/);
  assert.match(scene, /simulation\?\.updateViewport\(\{ aspect: camera\.aspect, fov: camera\.fov \}\)/);
  assert.doesNotMatch(scene, /skeleton\.pose\(/);
  assert.match(scene, /updateWorld\(animationDelta\); render\(\)/);
});
test('actual measured model envelopes keep their distance in portrait for 120 seconds', () => {
  // From production loader full-animation envelope measurements, not body-only approximations.
  const measured = [
    ['blue', 41.21378721049213, 8.114526304895866, 80000, 1.2],
    ['humpback', 24.966479556887457, 5.231211109307654, 30000, 1.35],
    ['sperm', 24.308124225973028, 3.6855403073359394, 40000, 1.15],
    ['orca', 12.893591799704385, 2.6733050296882612, 5000, 1.7],
    ['porpoise', 2.6810191598785367, .44050957993926837, 80, 1.3]
  ] as const;
  const specs = Array.from({ length: 100 }, (_, n) => {
    const s = n % 5, i = Math.floor(n / 5), [species, length, radius, mass, baseSpeed] = measured[s];
    const phase = (i * .61803398875 + s * .173) % 1;
    return { id: `${species}-${String(i + 1).padStart(2, '0')}`, species, length, radius, mass, speed: baseSpeed * (.9 + phase * .2) };
  });
  const sim = new PodSimulation(specs, 42721, { aspect: 390 / 844, fov: 68 });
  let nearest = -Infinity;
  for (let i = 0; i < 7200; i++) {
    sim.step(1 / 60);
    assert.ok(sim.stats.maxPenetration < .005);
    for (const b of sim.bodies) nearest = Math.max(nearest, b.position.z);
  }
  assert.ok(nearest < -85, `no accidental near-camera fly-by: ${nearest}`);
  assert.equal(sim.bodies.length, 100);
});
