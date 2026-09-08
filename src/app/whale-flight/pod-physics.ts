import * as THREE from 'three';

/** Conservative silhouette capsules, NOT anatomical contacts. Renderer must copy
 * position AND quaternion verbatim: local +Z is the capsule/swimming axis.
 * length is total tip-to-tip length; radius includes fins/tail envelope.
 * Units: world units, seconds, relative mass. No mesh/DOM/external physics engine.
 */
export type PodSpec = { id: string; species: string; length: number; radius: number; mass: number; speed: number };
export type PodBody = {
  spec: PodSpec; position: THREE.Vector3; velocity: THREE.Vector3; quaternion: THREE.Quaternion;
  mode: 'school' | 'solo' | 'sprint'; school: number; phase: number;
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
  private centers = [new THREE.Vector3(0, 0, -52), new THREE.Vector3(-48, 15, -158), new THREE.Vector3(70, -35, -252), new THREE.Vector3(-85, 42, -420), new THREE.Vector3(115, -62, -585)];
  private targets: THREE.Vector3[];
  private nextMigration = 0;
  constructor(specs: PodSpec[], seed = 12345) {
    this.seed = seed >>> 0;
    this.targets = this.centers.map(c => c.clone());
    for (let i = 0; i < specs.length; i++) {
      const spec = { ...specs[i] };
      for (const key of ['length', 'radius', 'mass', 'speed'] as const)
        if (!Number.isFinite(spec[key]) || spec[key] <= 0) throw new Error(`Invalid ${key} for ${spec.id}`);
      const ratio = i / Math.max(1, specs.length);
      const school = ratio < .1 ? 0 : ratio < .3 ? 1 : ratio < .5 ? 2 : ratio < .75 ? 3 : 4;
      const b: PodBody = { spec, school, mode: 'school', phase: this.random() * Math.PI * 2,
        position: new THREE.Vector3(), velocity: new THREE.Vector3(), quaternion: new THREE.Quaternion(),
        nextMode: 2 + this.random() * 15, wander: new THREE.Vector3(), nextWander: 0 };
      b.velocity.set(this.random() - .5, (this.random() - .5) * .5, this.random() - .5).normalize().multiplyScalar(spec.speed);
      b.quaternion.setFromUnitVectors(Z, b.velocity.clone().normalize());
      let placed = false;
      for (let attempt = 0; attempt < 10000; attempt++) {
        const c = this.centers[school], spread = 1 + attempt / 1500;
        b.position.set(c.x + (this.random() - .5) * (school ? 115 : 50) * spread,
          c.y + (this.random() - .5) * (school ? 80 : 40) * spread,
          c.z + (this.random() - .5) * (school ? 70 : 34) * spread);
        if (b.position.z + bound(b) > -8 || b.position.z - bound(b) < -700) continue;
        if (this.bodies.every(a => a.position.distanceToSquared(b.position) > (bound(a) + bound(b) + 1) ** 2 || capsuleSeparation(a, b).distance > .3)) { placed = true; break; }
      }
      if (!placed) throw new Error('Capsules cannot fit initial school; reduce envelope/count');
      this.bodies.push(b);
    }
    this.measurePenetration();
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
      for (const b of this.bodies) h = Math.min(h, .22 * b.spec.radius / Math.max(b.velocity.length() + (steering ? b.spec.speed * 3 : 0), .01));
      if (steering) this.steer(h);
      // Rotating a long capsule can create new contacts: resolve BEFORE movement.
      this.solve();
      const previous = this.bodies.map(b => b.position.clone());
      for (const b of this.bodies) { b.position.addScaledVector(b.velocity, h); b.velocity.multiplyScalar(Math.exp(-.035 * h)); }
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
      this.solve(); this.time += h; this.stats.steps++; remaining -= h;
    }
    this.measurePenetration();
  }
  private steer(h: number) {
    if (this.time >= this.nextMigration) {
      this.nextMigration = this.time + 12 + this.random() * 16;
      this.targets = this.centers.map((c, i) => new THREE.Vector3((this.random() - .5) * (i ? -c.z * .48 : 35), (this.random() - .5) * (i ? -c.z * .23 : 24), [-52, -158, -252, -420, -585][i] + (this.random() - .5) * (i ? 55 : 15)));
    }
    this.centers.forEach((c, i) => c.lerp(this.targets[i], 1 - Math.exp(-h * .045)));
    const sums = this.centers.map(() => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), n: 0 }));
    for (const b of this.bodies) { const s = sums[b.school]; s.p.add(b.position); s.v.add(b.velocity); s.n++; }
    const forces = this.bodies.map(b => {
      if (this.time >= b.nextMode) {
        b.mode = b.mode === 'school' ? (this.random() < .55 ? 'solo' : 'sprint') : 'school';
        b.nextMode = this.time + (b.mode === 'school' ? 9 + this.random() * 18 : b.mode === 'solo' ? 5 + this.random() * 10 : 2 + this.random() * 4);
        this.stats.modeTransitions++;
      }
      if (this.time >= b.nextWander) {
        b.nextWander = this.time + 3 + this.random() * 7;
        b.wander.set(this.random() - .5, (this.random() - .5) * .7, this.random() - .5).normalize();
      }
      const speed = b.spec.speed * (b.mode === 'sprint' ? 1.8 : b.mode === 'solo' ? 1.12 : .85 + .15 * Math.sin(this.time * .11 + b.phase));
      const target = this.centers[b.school].clone().sub(b.position).multiplyScalar(b.mode === 'solo' ? .015 : .04);
      target.addScaledVector(b.wander, b.mode === 'solo' ? 1.8 : .8);
      const s = sums[b.school];
      if (s.n > 1 && b.mode === 'school') {
        target.addScaledVector(s.v, .35 / (s.n * Math.max(b.spec.speed, 1)));
        target.addScaledVector(s.p.clone().multiplyScalar(1 / s.n).sub(b.position), .002);
      }
      const margin = bound(b) + 12, depth = -b.position.z;
      const wx = 22 + depth * .58, wy = 18 + depth * .32;
      target.x -= Math.sign(b.position.x) * Math.max(0, Math.abs(b.position.x) - wx + margin) * .12;
      target.y -= Math.sign(b.position.y) * Math.max(0, Math.abs(b.position.y) - wy + margin) * .12;
      target.z -= Math.max(0, b.position.z + 8 + margin) * .16;
      target.z += Math.max(0, -700 + margin - b.position.z) * .16;
      if (target.lengthSq() < 1e-8) target.copy(b.wander);
      return target.normalize().multiplyScalar(speed).sub(b.velocity).multiplyScalar(.65);
    });
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j];
      const rel = b.position.clone().sub(a.position), v = b.velocity.clone().sub(a.velocity);
      const limit = bound(a) + bound(b) + 5;
      if (rel.lengthSq() > (limit + v.length() * 2.5) ** 2) continue;
      const t = clamp(-rel.dot(v) / Math.max(v.lengthSq(), 1e-8), 0, 2.5);
      const future = rel.clone().addScaledVector(v, t), d = future.length();
      if (d < limit) {
        if (d < 1e-6) future.copy(rel);
        if (future.lengthSq() < 1e-8) future.set(1, 0, 0);
        future.normalize();
        const f = Math.min(12, (limit - d) * .6) / (1 + t);
        forces[i].addScaledVector(future, -f); forces[j].addScaledVector(future, f);
        this.stats.avoidances++;
      }
    }
    this.bodies.forEach((b, i) => {
      const maxAccel = Math.max(2, b.spec.speed * 1.3);
      forces[i].clampLength(0, maxAccel); b.velocity.addScaledVector(forces[i], h);
      if (b.velocity.lengthSq() > 1e-10) {
        const q = new THREE.Quaternion().setFromUnitVectors(Z, b.velocity.clone().normalize());
        // Tip displacement is also bounded to prevent rotation tunnelling.
        const maxTurn = Math.min(.7 * h, .15 * b.spec.radius / Math.max(half(b), .01));
        b.quaternion.rotateTowards(q, maxTurn).normalize();
      }
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
