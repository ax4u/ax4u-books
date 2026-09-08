import * as THREE from 'three';

/** Conservative silhouette capsules, NOT anatomical contacts. Renderer must copy
 * position AND quaternion verbatim: local +Z is the capsule/swimming axis.
 * length is total tip-to-tip length; radius includes fins/tail envelope.
 * Units: world units, seconds, relative mass. No mesh/DOM/external physics engine.
 */
export type PodSpec = { id: string; species: string; length: number; radius: number; mass: number; speed: number };
export type PodBody = {
  spec: PodSpec; position: THREE.Vector3; velocity: THREE.Vector3; quaternion: THREE.Quaternion;
  mode: 'school' | 'solo'; school: number; phase: number;
  nextMode: number; wander: THREE.Vector3; nextWander: number;
};
export type CapsuleContact = { distance: number; normal: THREE.Vector3; pointA: THREE.Vector3; pointB: THREE.Vector3 };
const Z = new THREE.Vector3(0, 0, 1);
const clamp = THREE.MathUtils.clamp;
const half = (b: PodBody) => Math.max(0, b.spec.length / 2 - b.spec.radius);
const bound = (b: PodBody) => half(b) + b.spec.radius;
export function capsuleEndpoints(b: PodBody): [THREE.Vector3, THREE.Vector3] {
  const axis = Z.clone().applyQuaternion(b.quaternion).multiplyScalar(half(b));
  return [b.position.clone().sub(axis), b.position.clone().add(axis)];
}
/** Exact closest points of finite 3D segments, including parallel/degenerate cases. */
export function closestSegmentSegment(p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3, s: THREE.Vector3) {
  const d1 = q.clone().sub(p), d2 = s.clone().sub(r), v = p.clone().sub(r);
  const a = d1.lengthSq(), e = d2.lengthSq(), f = d2.dot(v);
  let u = 0, t = 0;
  if (a <= 1e-14 && e <= 1e-14) return { pointA: p.clone(), pointB: r.clone() };
  if (a <= 1e-14) t = clamp(f / e, 0, 1);
  else {
    const c = d1.dot(v);
    if (e <= 1e-14) u = clamp(-c / a, 0, 1);
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      if (den > 1e-14 * a * e) u = clamp((b * f - c * e) / den, 0, 1);
      t = (b * u + f) / e;
      if (t < 0) { t = 0; u = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; u = clamp((b - c) / a, 0, 1); }
    }
  }
  return { pointA: p.clone().addScaledVector(d1, u), pointB: r.clone().addScaledVector(d2, t) };
}
/** Signed surface separation: negative means penetration. Normal points A→B. */
export function capsuleSeparation(a: PodBody, b: PodBody): CapsuleContact {
  const [p, q] = capsuleEndpoints(a), [r, s] = capsuleEndpoints(b);
  const points = closestSegmentSegment(p, q, r, s);
  const normal = points.pointB.clone().sub(points.pointA), d = normal.length();
  if (d > 1e-10) normal.divideScalar(d);
  else {
    normal.copy(b.position).sub(a.position);
    if (normal.lengthSq() < 1e-12) normal.copy(a.velocity).sub(b.velocity);
    if (normal.lengthSq() < 1e-12) normal.set(1, 0, 0);
    normal.normalize();
  }
  return { ...points, normal, distance: d - a.spec.radius - b.spec.radius };
}
/** Mass-weighted positional projection plus restitution impulse. No orientation
 * changes here: orientation must be updated BEFORE calling the contact solver.
 * Returns the actual applied impulse magnitude (zero for separating contacts).
 */
export function resolveCapsuleCollision(a: PodBody, b: PodBody, restitution = 0.32): number {
  const c = capsuleSeparation(a, b);
  if (c.distance > 0.001) return 0;
  const ia = 1 / a.spec.mass, ib = 1 / b.spec.mass, sum = ia + ib;
  if (c.distance < 0) {
    const correction = (-c.distance + 1e-5) / sum;
    a.position.addScaledVector(c.normal, -correction * ia);
    b.position.addScaledVector(c.normal, correction * ib);
  }
  const closing = b.velocity.clone().sub(a.velocity).dot(c.normal);
  if (closing >= 0) return 0;
  const impulse = -(1 + clamp(restitution, 0.2, 0.45)) * closing / sum;
  a.velocity.addScaledVector(c.normal, -impulse * ia);
  b.velocity.addScaledVector(c.normal, impulse * ib);
  return impulse;
}
export const resolve = resolveCapsuleCollision;

export class PodSimulation {
  bodies: PodBody[] = [];
  time = 0;
  stats = { collisions: 0, avoidances: 0, maxPenetration: 0, steps: 0, modeTransitions: 0, sweptCandidates: 0, impulse: 0 };
  private seed: number;
  private aspect: number;
  private tanHalfFov: number;
  private motion = new WeakMap<PodBody, { yaw: number; pitch: number; turnRate: number; frequency: number }>();
  constructor(specs: PodSpec[], seed = 12345, options: { aspect?: number; fov?: number } = {}) {
    this.seed = seed >>> 0;
    this.aspect = options.aspect ?? 16 / 9;
    const fov = options.fov ?? 52;
    if (!Number.isFinite(this.aspect) || this.aspect <= 0 || !Number.isFinite(fov) || fov <= 0 || fov >= 170)
      throw new Error('Invalid observation frustum');
    this.tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    // Independent depth and screen strata: no school centers or near-camera hero.
    const cells = specs.map((_, i) => i), depths = [...cells];
    for (const order of [cells, depths]) for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
    }
    const columns = Math.ceil(Math.sqrt(Math.max(1, specs.length)));
    const rows = Math.ceil(specs.length / columns);
    for (let i = 0; i < specs.length; i++) {
      const spec = { ...specs[i] };
      for (const key of ['length', 'radius', 'mass', 'speed'] as const)
        if (!Number.isFinite(spec[key]) || spec[key] <= 0) throw new Error(`Invalid ${key} for ${spec.id}`);
      const b: PodBody = { spec, school: i % 5, mode: i % 2 ? 'solo' : 'school', phase: this.random() * Math.PI * 2,
        position: new THREE.Vector3(), velocity: new THREE.Vector3(), quaternion: new THREE.Quaternion(),
        nextMode: 25 + this.random() * 45, wander: new THREE.Vector3(), nextWander: Infinity };
      const yaw = (i % 2 ? -1 : 1) * (Math.PI / 3 + this.random() * Math.PI / 3);
      const pitch = (this.random() - .5) * .2;
      this.motion.set(b, { yaw, pitch, turnRate: .03 + this.random() * .04, frequency: .012 + this.random() * .016 });
      this.orient(b, yaw, pitch);
      b.velocity.copy(Z).applyQuaternion(b.quaternion).multiplyScalar(spec.speed * (.95 + .2 * Math.sin(b.phase)));
      let placed = false;
      for (let attempt = 0; attempt < 10000; attempt++) {
        // A conservative large capsule can exhaust a narrow portrait depth cell;
        // after local retries keep its screen cell but search the full safe depth.
        const depthFraction = attempt < 128 ? (depths[i] + this.random()) / Math.max(1, specs.length) : this.random();
        const z = -100 - 440 * depthFraction;
        const hh = (28 - z) * this.tanHalfFov;
        // Keep the assigned screen cell on retries, varying actual depth within its stratum.
        const nx = ((cells[i] % columns + .1 + this.random() * .8) / columns - .5) * 1.6;
        const ny = ((Math.floor(cells[i] / columns) + .1 + this.random() * .8) / rows - .5) * 1.6;
        b.position.set(nx * hh * this.aspect, ny * hh, z);
        if (this.bodies.every(a => a.position.distanceToSquared(b.position) > (bound(a) + bound(b) + 1) ** 2 || capsuleSeparation(a, b).distance > .5)) { placed = true; break; }
      }
      if (!placed) throw new Error('Capsules cannot fit observation frustum; reduce envelope/count');
      this.bodies.push(b);
    }
    this.measurePenetration();
  }
  /** +Z swims forward; constructing an upright basis avoids reverse-heading roll. */
  private orient(b: PodBody, yaw: number, pitch: number) {
    const forward = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const up = new THREE.Vector3().crossVectors(forward, right);
    b.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward)).normalize();
  }
  private random() {
    this.seed += 0x6d2b79f5;
    let x = this.seed;
    x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  }
  /** No dropped elapsed time. A fixed maximum step plus travel-bounded substeps
   * prevents crossing thin capsules, even for externally assigned fast bodies.
   * steering=false disables propulsion, turning and boundary forces for tests;
   * physical drag and collision impulses remain enabled.
   */
  step(dt: number, steering = true): void {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('dt must be finite and nonnegative');
    let remaining = dt;
    while (remaining > 1e-10) {
      let h = Math.min(1 / 60, remaining);
      for (const b of this.bodies) h = Math.min(h, .22 * b.spec.radius / Math.max(b.velocity.length() + (steering ? b.spec.speed * 1.15 : 0), .01));
      if (steering) this.steer(h);
      // Rotating a long capsule can create new contacts: resolve BEFORE movement.
      this.solve();
      const previous = this.bodies.map(b => b.position.clone());
      for (const b of this.bodies) { b.position.addScaledVector(b.velocity, h); if (!steering) b.velocity.multiplyScalar(Math.exp(-.035 * h)); }
      // Swept enclosing-sphere segments are a conservative capsule broad phase.
      // Exact capsule narrow phase follows at travel-bounded intermediate poses.
      for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j];
        const rr = bound(a) + bound(b);
        const rx = previous[i].x - previous[j].x, ry = previous[i].y - previous[j].y, rz = previous[i].z - previous[j].z;
        const dx = a.position.x - b.position.x - rx, dy = a.position.y - b.position.y - ry, dz = a.position.z - b.position.z - rz;
        const den = dx * dx + dy * dy + dz * dz;
        const t = den > 0 ? clamp(-(rx * dx + ry * dy + rz * dz) / den, 0, 1) : 0;
        if ((rx + dx * t) ** 2 + (ry + dy * t) ** 2 + (rz + dz * t) ** 2 < rr * rr) this.stats.sweptCandidates++;
      }
      this.solve();
      // In the swimming scene an encounter may deflect or slow an animal, but
      // cannot launch a light animal into a sprint. Free collision tests retain
      // the full physical impulse (steering=false).
      if (steering) for (const b of this.bodies) b.velocity.clampLength(0, b.spec.speed * 1.15);
      this.time += h; this.stats.steps++; remaining -= h;
    }
    this.measurePenetration();
  }
  private steer(h: number) {
    const targets = this.bodies.map(b => {
      const m = this.motion.get(b)!;
      // These labels are observational only; neither attracts a school nor sprints.
      if (this.time >= b.nextMode) {
        b.mode = b.mode === 'school' ? 'solo' : 'school';
        b.nextMode = this.time + 30 + 20 * (1 + Math.sin(b.phase + this.time * m.frequency));
        this.stats.modeTransitions++;
      }
      const wanderYaw = m.yaw + .85 * Math.sin(this.time * m.frequency + b.phase)
        + .3 * Math.sin(this.time * m.frequency * .43 + b.phase * 2.7);
      const pitch = .14 * Math.sin(this.time * m.frequency * .71 + b.phase * 1.9);
      const target = new THREE.Vector3(Math.sin(wanderYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(wanderYaw) * Math.cos(pitch));
      // Anticipate the edge by a turning-radius-sized distance. These are walls,
      // not a home/center spring: the whole interior has exactly zero attraction.
      const future = b.position.clone().addScaledVector(b.velocity, 65);
      const hh = (28 - Math.max(b.position.z, future.z)) * this.tanHalfFov;
      const padding = bound(b) + 10;
      const px = clamp((Math.abs(future.x) + padding - hh * this.aspect * .92) / Math.max(30, hh * this.aspect * .3), 0, 1);
      const py = clamp((Math.abs(future.y) + padding - hh * .9) / Math.max(25, hh * .3), 0, 1);
      target.x -= Math.sign(future.x) * px * 3;
      target.y -= Math.sign(future.y) * py;
      target.z -= 3 * clamp((future.z + padding + 100) / 75, 0, 1);
      // Depth safety takes priority over a portrait side-wall turn: begin well
      // before the near plane, leaving even the slowest yaw ample turning room.
      target.z -= 4 * clamp((b.position.z + padding + 180) / 80, 0, 1);
      target.z += 3 * clamp((-550 + padding - future.z) / 75, 0, 1);
      b.wander.copy(target).normalize();
      return target;
    });
    // Bounding spheres only reject distant pairs. The actual, translated capsule
    // gap controls avoidance, so long silhouettes do not repel unrelated whales.
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j];
      const relative = b.velocity.clone().sub(a.velocity);
      const range = bound(a) + bound(b) + 10 + relative.length() * 10;
      if (a.position.distanceToSquared(b.position) > range * range) continue;
      const rel = b.position.clone().sub(a.position);
      const t = clamp(-rel.dot(relative) / Math.max(relative.lengthSq(), 1e-8), 0, 10);
      const current = capsuleSeparation(a, b);
      const future = capsuleSeparation({ ...a, position: a.position.clone().addScaledVector(a.velocity, t) },
        { ...b, position: b.position.clone().addScaledVector(b.velocity, t) });
      const contact = future.distance < current.distance ? future : current;
      if (contact.distance < 10) {
        const strength = .65 * clamp((10 - contact.distance) / 15, 0, 1);
        targets[i].addScaledVector(contact.normal, -strength);
        targets[j].addScaledVector(contact.normal, strength);
        this.stats.avoidances++;
      }
    }
    this.bodies.forEach((b, i) => {
      const m = this.motion.get(b)!, target = targets[i];
      const desiredYaw = Math.atan2(target.x, target.z);
      const delta = Math.atan2(Math.sin(desiredYaw - m.yaw), Math.cos(desiredYaw - m.yaw));
      // Limit angular velocity AND capsule-tip travel. No quaternion shortest-arc roll.
      const limit = Math.min(m.turnRate * h, .15 * b.spec.radius / Math.max(half(b), .01));
      m.yaw += clamp(delta * (1 - Math.exp(-.065 * h)), -limit, limit);
      const desiredPitch = clamp(Math.atan2(target.y, Math.hypot(target.x, target.z)), -.25, .25);
      m.pitch += clamp((desiredPitch - m.pitch) * (1 - Math.exp(-.07 * h)), -.012 * h, .012 * h);
      this.orient(b, m.yaw, m.pitch);
      const pace = .95 + .2 * Math.sin(this.time * m.frequency * .63 + b.phase);
      let speed = THREE.MathUtils.lerp(b.velocity.length(), b.spec.speed * pace, 1 - Math.exp(-.12 * h));
      // A gentle personal stand-off, not a camera push or position clamp. Slow
      // forward travel exponentially as the observation margin approaches, giving
      // even a portrait U-turn time to finish without an accidental close fly-by.
      const towardCamera = Math.cos(m.yaw) * Math.cos(m.pitch);
      if (towardCamera > 0) {
        const room = Math.max(0, -85 - b.position.z - bound(b));
        speed = Math.min(speed, room * .035 / towardCamera);
      }
      // Propulsion follows the already-limited body pose, never a faster sideways target.
      b.velocity.copy(Z).applyQuaternion(b.quaternion).multiplyScalar(speed);
    });
  }
  private solve() {
    // At least eight Gauss-Seidel passes; extra passes for dense chains.
    for (let pass = 0; pass < 48; pass++) {
      let deepest = 0;
      for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j], r = bound(a) + bound(b) + .002;
        if (a.position.distanceToSquared(b.position) > r * r) continue;
        const gap = capsuleSeparation(a, b).distance;
        deepest = Math.max(deepest, -gap);
        if (gap <= .001) {
          const impulse = resolveCapsuleCollision(a, b);
          if (impulse > 0) { this.stats.collisions++; this.stats.impulse += impulse; }
        }
      }
      if (pass >= 7 && deepest < .0005) break;
    }
  }
  /** Current measured residual, not a cumulative maximum or a fabricated zero. */
  measurePenetration() {
    let max = 0;
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j];
      if (a.position.distanceToSquared(b.position) <= (bound(a) + bound(b)) ** 2) max = Math.max(max, -capsuleSeparation(a, b).distance);
    }
    this.stats.maxPenetration = max;
    return max;
  }
}
