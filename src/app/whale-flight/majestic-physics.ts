import * as THREE from 'three';
import { capsuleSeparation, resolveCapsuleCollision, type PodBody, type PodSpec } from './pod-physics';

const Z = new THREE.Vector3(0, 0, 1);
const clamp = THREE.MathUtils.clamp;
const cameraZ = 28;
// Shared by propulsion safety and travel-bounded substeps, including impulses.
const maxSpeedRatio = 1.45;
const bound = (b: PodBody) => Math.max(b.spec.radius, b.spec.length / 2);
type Viewport = { aspect?: number; fov?: number };
type Motion = { yaw: number; pitch: number; direction: number; turnTarget: number | null; rate: number; frequency: number; paceFrequency: number; pacePhase: number; depth: number; framingDepth: number; edge: number };
const staging = [
  [-.3, -.05, .50], [.2, .45, .36], [.65, -.65, .13], [-.55, .67, .19],
  [.55, .05, .145], [-.6, -.5, .20], [-.8, -.75, .105], [-.15, -.8, .125],
  [.1, .8, .14], [-.72, .05, .105],
];
/** Sparse independent swimmers. Camera stays at (0,0,28); geometry is never scaled.
 * Input order determines foreground/mid/rear composition. Local +Z is forward.
 */
export class MajesticSimulation {
  bodies: PodBody[] = [];
  time = 0;
  stats = { collisions: 0, avoidances: 0, maxPenetration: 0, steps: 0, modeTransitions: 0, sweptCandidates: 0, impulse: 0 };
  private aspect: number;
  private fov: number;
  private tanHalfFov: number;
  private seed: number;
  private motion = new WeakMap<PodBody, Motion>();
  constructor(specs: (PodSpec & { visualLength?: number })[], seed = 42721, options: Viewport = {}) {
    this.seed = seed >>> 0;
    this.aspect = options.aspect ?? 16 / 9;
    this.fov = options.fov ?? (this.aspect < 1 ? 68 : 52);
    this.validateViewport(this.aspect, this.fov);
    this.tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.fov / 2));
    for (let i = 0; i < specs.length; i++) {
      const spec = { ...specs[i] };
      for (const key of ['length', 'radius', 'mass', 'speed'] as const)
        if (!Number.isFinite(spec[key]) || spec[key] <= 0) throw new Error(`Invalid ${key} for ${spec.id}`);
      if (spec.visualLength !== undefined && (!Number.isFinite(spec.visualLength) || spec.visualLength <= 0)) throw new Error(`Invalid visualLength for ${spec.id}`);
      const [nx, ny, width] = staging[i % staging.length];
      const direction = nx > 0 ? -1 : 1;
      const yaw = direction * Math.PI / 2 + (this.random() - .5) * .12;
      const pitch = (this.random() - .5) * .035;
      const b: PodBody = { spec, position: new THREE.Vector3(), velocity: new THREE.Vector3(), quaternion: new THREE.Quaternion(),
        mode: 'solo', school: i, phase: (i + this.random() * .3) * Math.PI * 2 / staging.length,
        nextMode: Infinity, wander: new THREE.Vector3(), nextWander: Infinity };
      this.orient(b, yaw, pitch);
      let depth = Math.max(this.standoff(b) + 1, (spec.visualLength ?? spec.length) / (2 * width * this.tanHalfFov * this.aspect));
      // Keep the screen cell, not a flock center; find a collision-free depth.
      for (let attempt = 0; ; attempt++, depth += .5) {
        this.place(b, nx, ny, depth);
        if (this.bodies.every(a => capsuleSeparation(a, b).distance > .5)) break;
        if (attempt > 10000) throw new Error('Cannot stage capsules');
      }
      this.motion.set(b, { yaw, pitch, direction, turnTarget: null, rate: .09 + this.random() * .03,
        frequency: .09 + this.random() * .07, depth, framingDepth: depth, edge: .82 + this.random() * .16,
        paceFrequency: .10 + this.random() * .10, pacePhase: this.random() * Math.PI * 2 });
      b.velocity.copy(Z).applyQuaternion(b.quaternion).multiplyScalar(spec.speed * (.92 + .06 * this.random()));
      this.bodies.push(b);
    }
    this.measurePenetration();
  }
  private validateViewport(aspect: number, fov: number) {
    if (!Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(fov) || fov <= 0 || fov >= 170) throw new Error('Invalid observation frustum');
  }
  private standoff(b: PodBody) { return 2.5 * b.spec.radius + 4; }
  private place(b: PodBody, nx: number, ny: number, depth: number) {
    b.position.set(nx * depth * this.tanHalfFov * this.aspect, ny * depth * this.tanHalfFov, cameraZ - depth);
  }
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
  /** Reproject existing objects along their camera rays. Horizontal apparent size
   * is preserved unless safe standoff/capsule separation requires extra depth.
   * Velocities and quaternions are untouched; there is no time/seed reset.
   */
  updateViewport(options: Viewport): void {
    const aspect = options.aspect ?? this.aspect, fov = options.fov ?? this.fov;
    this.validateViewport(aspect, fov);
    if (aspect === this.aspect && fov === this.fov) return;
    const oldHorizontal = this.tanHalfFov * this.aspect;
    const rays = this.bodies.map(b => {
      const depth = cameraZ - b.position.z;
      return { x: b.position.x / (depth * oldHorizontal), y: b.position.y / (depth * this.tanHalfFov), depth };
    });
    this.aspect = aspect; this.fov = fov;
    this.tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const ratio = oldHorizontal / (this.tanHalfFov * aspect);
    // Front-to-back ray projection resolves reflow overlap without changing
    // composition or imparting resize impulses. Geometry remains uniform.
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i], ray = rays[i];
      const motion = this.motion.get(b)!;
      // Keep the unconstrained composition distance separately. Safety can move a
      // whale back in landscape, but must not permanently shrink it on returning
      // to portrait. Actual swimming since the last reflow is retained as a delta.
      const intendedDepth = Math.max(1, motion.framingDepth + ray.depth - motion.depth) * ratio;
      let depth = Math.max(this.standoff(b) + 1, intendedDepth);
      for (let attempt = 0; ; attempt++, depth += .25) {
        this.place(b, ray.x, ray.y, depth);
        if (this.bodies.slice(0, i).every(a => capsuleSeparation(a, b).distance > .01)) break;
        if (attempt > 20000) throw new Error('Cannot reflow capsules');
      }
      motion.depth = depth;
      motion.framingDepth = intendedDepth;
    }
    this.measurePenetration();
  }
  /** No elapsed-time cap: bounded translation and 60Hz substeps prevent tunneling.
   * steering=false keeps drag/restitution but disables swimming and boundaries.
   */
  step(dt: number, steering = true): void {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('dt must be finite and nonnegative');
    let remaining = dt;
    while (remaining > 1e-10) {
      let h = Math.min(1 / 60, remaining);
      for (const b of this.bodies) h = Math.min(h, .22 * b.spec.radius / Math.max(.01, b.velocity.length() + (steering ? b.spec.speed * maxSpeedRatio : 0)));
      if (steering) this.steer(h);
      this.solve(steering);
      const previous = this.bodies.map(b => b.position.clone());
      for (const b of this.bodies) {
        b.position.addScaledVector(b.velocity, h);
        if (!steering) b.velocity.multiplyScalar(Math.exp(-.035 * h));
      }
      for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j];
        const relative = previous[i].clone().sub(previous[j]);
        const travel = a.position.clone().sub(b.position).sub(relative);
        const t = travel.lengthSq() > 0 ? clamp(-relative.dot(travel) / travel.lengthSq(), 0, 1) : 0;
        if (relative.addScaledVector(travel, t).lengthSq() < (bound(a) + bound(b)) ** 2) this.stats.sweptCandidates++;
      }
      this.solve(steering);
      if (steering) for (const b of this.bodies) b.velocity.clampLength(0, b.spec.speed * maxSpeedRatio);
      this.time += h; this.stats.steps++; remaining -= h;
    }
    this.measurePenetration();
  }
  private steer(h: number) {
    const targets = this.bodies.map(b => {
      const m = this.motion.get(b)!;
      const depth = cameraZ - b.position.z, hh = depth * this.tanHalfFov;
      // Anticipate a personal turning radius, allowing some turns on screen.
      // Waiting for the entire capsule to leave at this pace empties the scene.
      const turnRadius = Math.max(b.velocity.length(), b.spec.speed) / (m.rate * 1.8);
      const edge = Math.max(hh * this.aspect * .15, hh * this.aspect * m.edge - turnRadius * .7);
      if (m.turnTarget === null && b.position.x * m.direction > edge) {
        // Alternate the depth side according to actual position. Turning away
        // on EVERY pass would send the whole cast permanently into the distance.
        const depthSide = depth > m.depth + 4 ? -1 : 1;
        m.turnTarget = m.yaw + m.direction * depthSide * Math.PI;
      }
      if (m.turnTarget !== null) {
        const delta = m.turnTarget - m.yaw;
        if (Math.abs(delta) < .01) { m.direction *= -1; m.turnTarget = null; }
      }
      const band = Math.max(12, m.depth * .15);
      const zBias = .55 * clamp((depth - m.depth) / band, -1, 1);
      const course = this.time * m.frequency + b.phase;
      // Slowly evolving S bends, rises and dives, not a looped position spline.
      // Independent harmonics change the shape as well as the pace of each pass.
      const yaw = m.turnTarget !== null ? m.yaw + clamp(m.turnTarget - m.yaw, -.6, .6)
        : Math.atan2(m.direction, zBias) + .34 * Math.sin(course) + .12 * Math.sin(course * .43 + b.phase);
      const pitch = .20 * Math.sin(course * .71 + b.phase * 1.3) + .055 * Math.sin(course * .39 + b.phase)
        - .32 * Math.sign(b.position.y) * clamp((Math.abs(b.position.y) - hh * .72) / Math.max(10, hh * .4), 0, 1);
      return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    });
    // The original translated-capsule predictive avoidance/restitution formulas.
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j], relative = b.velocity.clone().sub(a.velocity);
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
      const base = m.direction * Math.PI / 2;
      const targetYaw = Math.atan2(target.x, target.z);
      const desired = m.turnTarget !== null ? targetYaw
        : base + clamp(Math.atan2(Math.sin(targetYaw - base), Math.cos(targetYaw - base)), -.85, .85);
      const delta = Math.atan2(Math.sin(desired - m.yaw), Math.cos(desired - m.yaw));
      const rate = m.rate * (m.turnTarget !== null ? 1.8 : 1);
      m.yaw += clamp(delta * (1 - Math.exp(-.55 * h)), -rate * h, rate * h);
      const desiredPitch = clamp(Math.atan2(target.y, Math.hypot(target.x, target.z)), -.30, .30);
      m.pitch += clamp((desiredPitch - m.pitch) * (1 - Math.exp(-.4 * h)), -.045 * h, .045 * h);
      this.orient(b, m.yaw, m.pitch);
      b.wander.copy(target).normalize();
      // Two personal, incommensurate clocks blend energetic strokes into glides;
      // no school speed, shared transition timer or position-on-a-spline reset.
      const speed = b.spec.speed * (1.025 + .24 * Math.sin(this.time * m.paceFrequency + m.pacePhase)
        + .085 * Math.sin(this.time * m.paceFrequency * .47 + m.pacePhase * 1.7));
      const propulsion = Z.clone().applyQuaternion(b.quaternion).multiplyScalar(speed);
      // Ease the outward component before a personal depth-band edge. Faster
      // U-turns must not accumulate retreat or erase the near/mid/far staging.
      // This limits desired thrust, not position or post-collision velocity.
      const depthRoom = Math.max(0, m.depth + Math.max(14, m.depth * .25) - (cameraZ - b.position.z));
      if (propulsion.z < 0) propulsion.z = Math.max(propulsion.z, -depthRoom * .22);
      // Relax toward propulsion; retain real collision deflection instead of
      // replacing velocity with a prescribed trajectory each frame.
      b.velocity.lerp(propulsion, 1 - Math.exp(-.4 * h));
      const room = Math.max(0, cameraZ - b.position.z - this.standoff(b));
      if (b.velocity.z > 0) b.velocity.z = Math.min(b.velocity.z, room * .08);
    });
  }
  private solve(boundaries: boolean) {
    for (let pass = 0; pass < 48; pass++) {
      let deepest = 0;
      for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j];
        if (a.position.distanceToSquared(b.position) > (bound(a) + bound(b) + .002) ** 2) continue;
        const gap = capsuleSeparation(a, b).distance;
        deepest = Math.max(deepest, -gap);
        if (gap <= .001) {
          const impulse = resolveCapsuleCollision(a, b);
          if (impulse > 0) { this.stats.collisions++; this.stats.impulse += impulse; }
        }
      }
      // Unilateral observation-plane contact is a last-resort collision guard,
      // not a travel boundary/wrap. Normal propulsion brakes before this plane.
      if (boundaries) for (const b of this.bodies) {
        const penetration = b.position.z - (cameraZ - this.standoff(b));
        if (penetration > 0) {
          deepest = Math.max(deepest, penetration);
          b.position.z -= penetration;
          b.velocity.z = Math.min(0, b.velocity.z);
        }
      }
      if (pass >= 7 && deepest < .0005) break;
    }
  }
  measurePenetration() {
    let max = 0;
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++)
      max = Math.max(max, -capsuleSeparation(this.bodies[i], this.bodies[j]).distance);
    this.stats.maxPenetration = max;
    return max;
  }
}
