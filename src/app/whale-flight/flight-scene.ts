import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { createFinlessPorpoise } from "./finless-porpoise";
import { PodSimulation as PhysicsPodSimulation, type PodBody, type PodSpec } from "./pod-physics";
import { WHALE_SPECIES, type WhaleSpecies } from "./species";

type Original = ReturnType<typeof createFinlessPorpoise>;
type Envelope = { radius: number; length: number; visualExtent: number; maxX: number; maxY: number; maxZ: number; samples: number };
type Animal = {
  id: string; species: WhaleSpecies; root: THREE.Group; model: THREE.Object3D;
  mixer?: THREE.AnimationMixer; original?: Original; bones: THREE.Bone[];
  body?: PodBody; bodyLength: number; envelope: Envelope; animationTime: number;
  animationPending: number; animationSpeed: number; phase: number; eyeMesh?: THREE.Mesh;
};
type FlightStats = {
  time: number; frames: number; whales: number; drawCalls: number; species: string[];
  counts: Record<string, number>; physics: Record<string, number>; depthRange: number[];
  nearestDistance: number; sceneKind: "living-pod";
};
export type FlightController = {
  setPaused(paused: boolean): void;
  setReducedMotion(reduced: boolean): void;
  setPointer(x: number, y: number): void;
  dispose(): void;
  getStats(): FlightStats;
};
type FlightOptions = { reducedMotion: boolean; onReady: () => void; onError: (message: string) => void };
const COUNT = 20;
const IDS = ["blue", "humpback", "sperm", "orca", "porpoise"];
// Relative inertial weights, not a claim that the integrator uses SI units.
const MASS: Record<string, number> = { blue: 80000, humpback: 30000, sperm: 40000, orca: 5000, porpoise: 80 };
const SPEED: Record<string, number> = { blue: 1.6, humpback: 1.9, sperm: 1.5, orca: 2.8, porpoise: 2.2 };
const FIXED_STEP = 1 / 60;
const SKY_DEPTH = 1100;
const FORWARD = new THREE.Vector3(0, 0, 1);
const rounded = (n: number) => Number(n.toFixed(5));

/** A real 100-body pod: the simulation owns every animal's world transform. */
export function createFlightScene(canvas: HTMLCanvasElement, options: FlightOptions): FlightController {
  let disposed = false, failed = false, ready = false, paused = false, reduced = options.reducedMotion;
  let raf = 0, previousStamp = 0, elapsed = 0, frames = 0, accumulator = 0, lastSample = -1;
  let fpsSeconds = 0, fpsFrames = 0, width = 1, height = 1;
  let mobile = canvas.clientWidth < 720;
  let pixelRatio = Math.max(.65, Math.min(window.devicePixelRatio || 1, mobile ? 1.1 : 1.5));
  let renderer: THREE.WebGLRenderer | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let simulation: PhysicsPodSimulation | undefined;
  const abort = new AbortController();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  const originals = new Set<Original>();
  const sourceRoots = new Set<THREE.Object3D>();
  const mixers = new Set<THREE.AnimationMixer>();
  const animals: Animal[] = [];
  const pointer = new THREE.Vector2(), easedPointer = new THREE.Vector2();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#90b7b7");
  scene.fog = new THREE.FogExp2("#aac8c6", .00155);
  const camera = new THREE.PerspectiveCamera(52, 1, .02, 1500);
  camera.position.set(0, 3, 18);
  camera.lookAt(0, 2, -90);
  scene.add(camera);
  const skyMaterial = new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false, fog: false, toneMapped: false });
  const skyGeometry = new THREE.PlaneGeometry(1, 1);
  materials.add(skyMaterial); geometries.add(skyGeometry);
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.position.z = -SKY_DEPTH; sky.renderOrder = -100; sky.visible = false;
  camera.add(sky);
  let skyAspect = 1.5;
  scene.add(new THREE.HemisphereLight("#e8faf4", "#456673", 2.1));
  const sun = new THREE.DirectionalLight("#fff0ce", 2.8); sun.position.set(-45, 80, 25); scene.add(sun);
  const rim = new THREE.DirectionalLight("#a2d9ec", 1.6); rim.position.set(50, 20, -100); scene.add(rim);
  const aim = new THREE.Vector3(0, 2, -90), wideAim = new THREE.Vector3(), desiredCamera = new THREE.Vector3();
  const eye = new THREE.Vector3(), closeCamera = new THREE.Vector3(), local = new THREE.Vector3();
  const cameraAxis = new THREE.Vector3(), nearestPoint = new THREE.Vector3(), escape = new THREE.Vector3();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  let cameraBlend = 0;

  function registerModel(root: THREE.Object3D, own = true) {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      // Imported bind boxes omit moving flippers. Never let Three cull individual skins.
      if (object instanceof THREE.SkinnedMesh) {
        object.frustumCulled = false;
        if (own) skeletons.add(object.skeleton);
      }
      if (!own) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
  }
  function disposeResources() {
    for (const mixer of mixers) { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }
    mixers.clear();
    for (const animal of animals) animal.root.removeFromParent();
    animals.length = 0;
    for (const original of originals) original.dispose();
    originals.clear();
    for (const skeleton of skeletons) skeleton.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    const images = new Set<unknown>();
    for (const texture of textures) { texture.dispose(); images.add(texture.image); }
    for (const image of images) if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
    skeletons.clear(); geometries.clear(); materials.clear(); textures.clear();
    for (const root of sourceRoots) root.clear();
    sourceRoots.clear();
    simulation = undefined;
  }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; previousStamp = 0; }
  function removeListeners() {
    resizeObserver?.disconnect(); window.removeEventListener("resize", layout);
    document.removeEventListener("visibilitychange", synchronizePlayback);
    canvas.removeEventListener("webglcontextlost", contextLost);
  }
  function reportError(message: string) {
    if (disposed || failed) return;
    failed = true; ready = false; abort.abort(); stopLoop(); removeListeners();
    disposeResources(); scene.clear(); renderer?.dispose();
    canvas.dataset.flightReady = "false"; canvas.dataset.flightPaused = "true";
    options.onError(message);
  }
  function updateSkinMatrices(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    root.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  }
  function envelopeFromBounds(bounds: THREE.Box3, samples: number): Envelope {
    const maxX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
    const maxY = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y));
    const maxZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
    // Symmetric about the authored rest center: includes all sampled animation drift.
    const radius = Math.hypot(maxX, maxY) * 1.05;
    const visualExtent = 2 * maxZ;
    if (![radius, visualExtent].every(Number.isFinite) || radius <= 0 || visualExtent <= 0) throw new Error("유효하지 않은 고래 활동 영역입니다.");
    // Capsule half-segment is exactly visualExtent/2, NOT bodyLength/2-radius.
    return { radius, length: visualExtent + 2 * radius, visualExtent, maxX, maxY, maxZ, samples };
  }
  function representativeBones(model: THREE.Object3D, clips: readonly THREE.AnimationClip[] = []) {
    const bones: THREE.Bone[] = [];
    model.traverse(object => { if (object instanceof THREE.Bone) bones.push(object); });
    const animated = bones.filter(bone => clips.some(clip => clip.tracks.some(track => track.name.startsWith(`${bone.name}.`))));
    const pool = animated.length ? animated : bones;
    const chosen: THREE.Bone[] = [];
    const take = (bone?: THREE.Bone) => { if (bone && !chosen.includes(bone)) chosen.push(bone); };
    take(pool.find(bone => /tail|fluke|caudal/i.test(bone.name)) ?? pool[pool.length - 1]);
    take(pool.find(bone => /flipper|pectoral|fin|arm/i.test(bone.name)));
    take(pool.find(bone => /spine|body|chest/i.test(bone.name)));
    for (let i = 1; i <= pool.length && chosen.length < 4; i++) take(pool[Math.min(pool.length - 1, Math.floor(i * pool.length / 5))]);
    for (const bone of pool) { if (chosen.length >= 4) break; take(bone); }
    return chosen.slice(0, 4);
  }

  async function loadWhales() {
    const speciesList = IDS.map(id => WHALE_SPECIES.find(species => String(species.id) === id));
    if (speciesList.some(species => !species)) throw new Error("5종 고래 메타데이터가 준비되지 않았습니다.");
    await Promise.all(speciesList.map(async entry => {
      const species = entry!;
      let normalized = new THREE.Group();
      let sourceModel: THREE.Object3D | undefined;
      let swimming: THREE.AnimationClip | undefined;
      let clips: THREE.AnimationClip[] = [];
      let envelope: Envelope | undefined;
      let bodyLength = species.length;
      if (species.model === "gltf") {
        if (!species.asset || !species.clip) throw new Error(`${species.name}: 모델 정보가 없습니다.`);
        // Exactly one fetch and parse for each of the four source GLBs.
        const response = await fetch(species.asset, { signal: abort.signal });
        if (!response.ok) throw new Error(`${species.name} 모델을 불러오지 못했습니다 (${response.status}).`);
        const bytes = await response.arrayBuffer();
        if (disposed || failed) return;
        const gltf = await new GLTFLoader().parseAsync(bytes, species.asset.slice(0, species.asset.lastIndexOf("/") + 1));
        const model = gltf.scene;
        for (const source of gltf.scenes) { sourceRoots.add(source); registerModel(source); }
        if (disposed || failed) { disposeResources(); return; }
        sourceModel = model; clips = gltf.animations;
        swimming = clips.find(clip => clip.name === species.clip);
        if (!swimming || !swimming.tracks.length) throw new Error(`${species.name}의 ${species.clip} 애니메이션이 없습니다.`);
        // Preserve the previous loader's authored root / alignment / normalization.
        // Do not reconstruct inverse-bind rest transforms: partial FBX clips depend on them.
        model.updateMatrixWorld(true);
        model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
        const bounds = new THREE.Box3().setFromObject(model, true);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const axis = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
        const length = size.getComponent(axis);
        if (!Number.isFinite(length) || length <= 0) throw new Error(`${species.name}: 유효한 몸길이가 없습니다.`);
        const translation = new THREE.Group();
        translation.position.copy(center).negate(); translation.add(model);
        const alignment = new THREE.Group(); alignment.add(translation);
        let headCoordinate: number | undefined;
        model.traverse(object => {
          if (object instanceof THREE.Bone && /head|snout|rostrum/i.test(object.name) && headCoordinate === undefined) {
            headCoordinate = object.getWorldPosition(new THREE.Vector3()).getComponent(axis);
          }
        });
        const sign = headCoordinate !== undefined && headCoordinate < 0 ? -1 : 1;
        const sourceForward = new THREE.Vector3().setComponent(axis, sign);
        const sourceUp = axis === 1 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        const sourceRight = new THREE.Vector3().crossVectors(sourceUp, sourceForward).normalize();
        const correctedUp = new THREE.Vector3().crossVectors(sourceForward, sourceRight).normalize();
        alignment.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sourceRight, correctedUp, sourceForward).invert());
        normalized.add(alignment); normalized.scale.setScalar(species.length / length);
        normalized.updateMatrixWorld(true);
        const measured = new THREE.Box3().setFromObject(normalized, true).getSize(new THREE.Vector3());
        bodyLength = measured.z;
        normalized.userData.bindPoseExtent = size.toArray(); normalized.userData.lengthAxis = axis; normalized.userData.headSign = sign;
        if (Math.abs(bodyLength - species.length) > .01) throw new Error(`${species.name}: 몸길이 정규화 검증에 실패했습니다.`);
        const activity = new THREE.Box3().setFromObject(normalized, true);
        const sampler = new THREE.AnimationMixer(model); mixers.add(sampler);
        let samples = 1;
        // All native clips, ten poses over each complete loop, including fins/tail.
        for (const clip of clips) {
          const action = sampler.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
          for (let pose = 0; pose < 10; pose++) {
            sampler.setTime(clip.duration * pose / 10);
            updateSkinMatrices(normalized); activity.union(new THREE.Box3().setFromObject(normalized, true)); samples++;
          }
          action.stop();
        }
        sampler.stopAllAction(); sampler.uncacheRoot(model); mixers.delete(sampler);
        updateSkinMatrices(normalized);
        envelope = envelopeFromBounds(activity, samples);
        sourceRoots.add(normalized);
      }
      for (let index = 0; index < COUNT; index++) {
        if (disposed || failed) return;
        const phase = (index * .61803398875 + IDS.indexOf(String(species.id)) * .173) % 1;
        let model: THREE.Object3D, mixer: THREE.AnimationMixer | undefined, original: Original | undefined;
        let instance: THREE.Group;
        if (sourceModel && swimming && envelope) {
          // SkeletonUtils duplicates every skeleton/bone but shares immutable GPU assets.
          instance = cloneSkeleton(normalized) as THREE.Group;
          model = instance.getObjectByProperty("name", sourceModel.name) ?? instance;
          registerModel(instance);
          mixer = new THREE.AnimationMixer(instance); mixers.add(mixer);
          mixer.clipAction(swimming).setLoop(THREE.LoopRepeat, Infinity).play();
          mixer.setTime(phase * swimming.duration);
        } else {
          original = createFinlessPorpoise(); originals.add(original);
          model = original.root; instance = new THREE.Group(); instance.add(model);
          instance.scale.setScalar(species.length); registerModel(model, false);
          updateSkinMatrices(instance);
          if (!envelope) {
            const rest = new THREE.Box3().setFromObject(instance, true), center = rest.getCenter(new THREE.Vector3());
            // Original API is +Z/length 1; keep its bone-only motion and center rest once.
            model.position.sub(center.divideScalar(species.length));
            const activity = new THREE.Box3();
            for (let pose = 0; pose < 12; pose++) {
              original.update(pose / (12 * (.70 + .35 * 1.5)), 1.5);
              updateSkinMatrices(instance); activity.union(new THREE.Box3().setFromObject(instance, true));
            }
            original.update(0, 1); updateSkinMatrices(instance);
            envelope = envelopeFromBounds(activity, 12);
            normalized = instance;
          } else model.position.copy(normalized.children[0].position);
          original.update(phase * 6.28, 1);
        }
        const id = `${species.id}-${String(index + 1).padStart(2, "0")}`;
        const root = new THREE.Group(); root.name = id; root.userData.species = species.id; root.userData.animalId = id; root.add(instance);
        const animal: Animal = { id, species, root, model, mixer, original, bones: representativeBones(instance, clips), bodyLength,
          envelope: envelope!, animationTime: mixer?.time ?? phase * 6.28, animationPending: 0, animationSpeed: .72 + phase * .48, phase,
          eyeMesh: species.id === "blue" ? instance.getObjectByName("polySurface2_lambert1_0") as THREE.Mesh | undefined : undefined };
        animals.push(animal); scene.add(root);
      }
    }));
    if (disposed || failed) return;
    // Interleave species: the physics constructor assigns depth schools by index.
    animals.sort((a, b) => a.id.slice(-2).localeCompare(b.id.slice(-2)) || IDS.indexOf(String(a.species.id)) - IDS.indexOf(String(b.species.id)));
    if (animals.length !== 100 || new Set(animals.map(animal => animal.id)).size !== 100 || new Set(animals.map(animal => animal.model.uuid)).size !== 100) throw new Error("고래 100개체를 모두 준비하지 못했습니다.");
    const specs: PodSpec[] = animals.map(animal => ({ id: animal.id, species: animal.species.id, length: animal.envelope.length,
      radius: animal.envelope.radius, mass: MASS[animal.species.id], speed: SPEED[animal.species.id] * (.9 + animal.phase * .2) }));
    simulation = new PhysicsPodSimulation(specs, 42721);
    const bodies = new Map(simulation.bodies.map(body => [body.spec.id, body]));
    for (const animal of animals) {
      animal.body = bodies.get(animal.id);
      if (!animal.body) throw new Error(`물리 개체 누락: ${animal.id}`);
    }
    updateWorld(0);
  }

  function cameraSafety() {
    // Stay outside every conservative capsule; modify CAMERA only, never bodies.
    for (let pass = 0; pass < 2; pass++) for (const animal of animals) {
      const body = animal.body; if (!body) continue;
      cameraAxis.copy(FORWARD).applyQuaternion(body.quaternion);
      local.copy(camera.position).sub(body.position);
      const half = body.spec.length / 2 - body.spec.radius;
      nearestPoint.copy(body.position).addScaledVector(cameraAxis, THREE.MathUtils.clamp(local.dot(cameraAxis), -half, half));
      escape.copy(camera.position).sub(nearestPoint);
      const safe = body.spec.radius + .16;
      if (escape.lengthSq() < safe * safe) {
        if (escape.lengthSq() < .00001) escape.set(1, .2, 0).applyQuaternion(body.quaternion);
        camera.position.copy(nearestPoint).add(escape.setLength(safe));
      }
    }
  }
  function updateCamera(delta: number) {
    easedPointer.lerp(pointer, 1 - Math.exp(-delta * 1.5));
    const hero = animals.find(animal => String(animal.species.id) === "blue" && animal.id.endsWith("01"));
    wideAim.set(easedPointer.x * 5, 2 + easedPointer.y * 3, -100);
    desiredCamera.set(easedPointer.x * 2.5, 3 + easedPointer.y * 1.3, 18);
    let targetBlend = 0;
    if (hero?.body && !reduced) {
      const cycle = elapsed % 20;
      targetBlend = THREE.MathUtils.smoothstep(cycle, 4, 9) * (1 - THREE.MathUtils.smoothstep(cycle, 13, 19));
      // Track the actual licensed eye mesh, not an anatomical guess or a staged copy.
      // A telephoto lens stays OUTSIDE the full fin capsule while showing a giant eye.
      if (hero.eyeMesh) {
        hero.eyeMesh.geometry.computeBoundingBox();
        hero.eyeMesh.geometry.boundingBox!.getCenter(eye);
        hero.eyeMesh.localToWorld(eye);
      } else eye.set(hero.bodyLength * .09, hero.bodyLength * .043, hero.bodyLength * .26)
        .applyQuaternion(hero.body.quaternion).add(hero.body.position);
      closeCamera.copy(eye).sub(hero.body.position).applyQuaternion(hero.body.quaternion.clone().invert());
      closeCamera.x = hero.envelope.radius + .32;
      closeCamera.applyQuaternion(hero.body.quaternion).add(hero.body.position);
      desiredCamera.lerp(closeCamera, targetBlend);
      wideAim.lerp(eye, targetBlend);
    }
    cameraBlend = targetBlend;
    const smoothing = delta ? 1 - Math.exp(-delta * .85) : 1;
    camera.position.lerp(desiredCamera, smoothing); aim.lerp(wideAim, smoothing);
    cameraSafety();
    // Lock the last portion to the moving eye so body motion cannot lag outside the lens.
    if (targetBlend > .8) aim.lerp(eye, THREE.MathUtils.smoothstep(targetBlend, .8, 1));
    camera.lookAt(aim); camera.updateMatrixWorld(true);
    camera.fov = THREE.MathUtils.lerp(mobile ? 60 : 52, mobile ? 15 : 9, THREE.MathUtils.smoothstep(targetBlend, .5, 1));
    camera.updateProjectionMatrix();
    const vh = 2 * SKY_DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const cover = Math.max(vh, vh * camera.aspect / skyAspect);
    sky.scale.set(cover * skyAspect * 1.015, cover * 1.015, 1);
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection);
  }
  function updateWorld(animationDelta: number) {
    // Fixed CPU budget; animation has its own accumulated, non-frozen clock.
    accumulator += Math.min(animationDelta, .1);
    while (simulation && accumulator >= FIXED_STEP) { simulation.step(FIXED_STEP); accumulator -= FIXED_STEP; }
    for (const animal of animals) {
      const body = animal.body; if (!body) continue;
      animal.root.position.copy(body.position); animal.root.quaternion.copy(body.quaternion);
    }
    for (const animal of animals) {
      if (!animal.body) continue;
      animal.animationPending += animationDelta;
      const near = camera.position.distanceToSquared(animal.body.position) < 100 * 100;
      if (animal.animationPending > 0 && (near || animal.animationPending >= .1)) {
        const advance = animal.animationPending * animal.animationSpeed;
        animal.animationTime += advance;
        animal.mixer?.update(advance); animal.original?.update(animal.animationTime, animal.animationSpeed);
        animal.animationPending = 0;
      }
      animal.root.updateMatrixWorld(true);
    }
    // Camera must follow this frame's animated eye, not the previous head pose.
    updateCamera(animationDelta);
    for (const animal of animals) {
      if (!animal.body) continue;
      // Object-level culling is conservative and preserves 100 live dynamic roots.
      // Every imported SkinnedMesh keeps frustumCulled=false to avoid stale bind boxes.
      const sphereRadius = animal.envelope.length / 2;
      animal.root.visible = frustum.intersectsSphere(new THREE.Sphere(animal.body.position, sphereRadius));
    }
  }
  function getStats(): FlightStats {
    const counts: Record<string, number> = {};
    const depths: number[] = [];
    let nearestDistance = Infinity;
    for (const animal of animals) {
      counts[animal.species.id] = (counts[animal.species.id] ?? 0) + 1;
      if (!animal.body) continue;
      local.copy(animal.body.position).applyMatrix4(camera.matrixWorldInverse); depths.push(-local.z);
      nearestDistance = Math.min(nearestDistance, camera.position.distanceTo(animal.body.position));
    }
    return { time: elapsed, frames, whales: animals.filter(animal => animal.root.parent === scene).length,
      drawCalls: renderer?.info.render.calls ?? 0, species: Object.keys(counts), counts,
      physics: simulation ? { ...simulation.stats, time: simulation.time } : {},
      depthRange: depths.length ? [Math.min(...depths), Math.max(...depths)] : [],
      nearestDistance: Number.isFinite(nearestDistance) ? nearestDistance : 0, sceneKind: "living-pod" };
  }
  function sample(force = false) {
    if (!force && elapsed - lastSample < .5) return;
    lastSample = elapsed;
    const stats = getStats();
    canvas.dataset.flightTime = String(rounded(elapsed)); canvas.dataset.flightFrames = String(frames);
    canvas.dataset.flightReady = String(ready && !failed && !disposed);
    canvas.dataset.flightPaused = String(paused || reduced || document.hidden || disposed || failed);
    canvas.dataset.whaleCount = String(stats.whales); canvas.dataset.speciesCount = String(stats.species.length);
    canvas.dataset.whaleSpecies = JSON.stringify(stats.species); canvas.dataset.whaleCounts = JSON.stringify(stats.counts);
    canvas.dataset.physics = JSON.stringify(stats.physics); canvas.dataset.depthRange = JSON.stringify(stats.depthRange);
    canvas.dataset.nearestDistance = String(stats.nearestDistance); canvas.dataset.sceneKind = "living-pod";
    canvas.dataset.pixelRatio = String(pixelRatio); canvas.dataset.cameraBlend = String(rounded(cameraBlend));
    canvas.dataset.cameraPosition = JSON.stringify(camera.position.toArray());
    canvas.dataset.cameraFov = String(camera.fov); canvas.dataset.drawCalls = String(stats.drawCalls);
    canvas.dataset.triangles = String(renderer?.info.render.triangles ?? 0);
    canvas.dataset.textures = String(renderer?.info.memory.textures ?? 0);
    canvas.dataset.geometries = String(renderer?.info.memory.geometries ?? 0);
    const hero = animals.find(animal => animal.eyeMesh);
    if (hero?.eyeMesh) {
      const eyeBox = new THREE.Box3().setFromObject(hero.eyeMesh, true);
      const center = eyeBox.getCenter(new THREE.Vector3()), dimension = eyeBox.getSize(new THREE.Vector3());
      const eyeDistance = camera.position.distanceTo(center);
      canvas.dataset.heroEye = JSON.stringify({ point: center.clone().project(camera).toArray(), distance: eyeDistance,
        diameterPixels: Math.max(dimension.x, dimension.y, dimension.z) / (2 * eyeDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * height });
    }
    canvas.dataset.whaleModels = JSON.stringify(animals.map(animal => ({ id: animal.id, species: animal.species.id,
      model: animal.species.asset ?? "original:finless-porpoise", modeluuid: animal.model.uuid, rootuuid: animal.root.uuid,
      bodyLength: animal.bodyLength, colliderlength: animal.envelope.length, colliderLength: animal.envelope.length, radius: animal.envelope.radius,
      visualExtent: animal.envelope.visualExtent, activitySamples: animal.envelope.samples,
      position: animal.root.position.toArray().map(rounded), quaternion: animal.root.quaternion.toArray().map(rounded),
      velocity: animal.body?.velocity.toArray().map(rounded), mass: animal.body?.spec.mass, baseSpeed: animal.body?.spec.speed,
      mode: animal.body?.mode, school: animal.body?.school,
      mixertime: animal.mixer?.time ?? animal.animationTime, animationTime: animal.animationTime, animationSpeed: animal.animationSpeed,
      visible: animal.root.visible, motionSample: animal.bones.map(bone => ({ name: bone.name, position: bone.position.toArray().map(rounded), quaternion: bone.quaternion.toArray().map(rounded) }))
    })));
  }
  function render() {
    if (disposed || failed || !renderer) return;
    try { renderer.render(scene, camera); frames++; sample(); }
    catch (error) { reportError(error instanceof Error ? error.message : "하늘을 그리는 중 오류가 발생했습니다."); }
  }
  function layout() {
    if (disposed || failed || !renderer) return;
    const box = canvas.getBoundingClientRect(); width = Math.max(1, box.width); height = Math.max(1, box.height); mobile = width < 720;
    pixelRatio = Math.max(.65, Math.min(pixelRatio, mobile ? 1.1 : 1.5));
    renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.fov = mobile ? 60 : 52; camera.updateProjectionMatrix();
    const viewHeight = 2 * SKY_DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const coverHeight = Math.max(viewHeight, viewHeight * camera.aspect / skyAspect);
    sky.scale.set(coverHeight * skyAspect * 1.015, coverHeight * 1.015, 1);
    render(); sample(true);
  }
  function tick(stamp: number) {
    raf = 0;
    if (disposed || failed || paused || reduced || document.hidden || !ready) return;
    const rawDelta = previousStamp ? Math.max(0, (stamp - previousStamp) / 1000) : 0; previousStamp = stamp;
    const animationDelta = Math.min(rawDelta, .65); elapsed += animationDelta;
    updateWorld(animationDelta); render();
    if (rawDelta > 0 && rawDelta < 5) {
      fpsSeconds += rawDelta; fpsFrames++;
      if (fpsSeconds > 2) {
        if (fpsFrames / fpsSeconds < 28 && pixelRatio > .65 && renderer) {
          pixelRatio = Math.max(.65, pixelRatio * .82); renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
        }
        fpsSeconds = 0; fpsFrames = 0;
      }
    }
    if (!disposed && !failed && !paused && !reduced && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function synchronizePlayback() {
    stopLoop(); sample(true);
    if (ready && !disposed && !failed && !paused && !reduced && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function contextLost(event: Event) { event.preventDefault(); reportError("그래픽 연결이 끊겼습니다. 페이지를 새로고침해 주세요."); }
  async function loadSky() {
    const texture = await new THREE.TextureLoader().loadAsync("/whale-flight/sky.webp");
    if (disposed || failed) { texture.dispose(); if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close(); return; }
    textures.add(texture); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 4);
    skyMaterial.map = texture; skyMaterial.needsUpdate = true;
    const image = texture.image as { width: number; height: number }; skyAspect = image.width / image.height; sky.visible = true;
  }
  async function initialize() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: "high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
      canvas.addEventListener("webglcontextlost", contextLost); document.addEventListener("visibilitychange", synchronizePlayback);
      if (typeof ResizeObserver !== "undefined") { resizeObserver = new ResizeObserver(layout); resizeObserver.observe(canvas); }
      else window.addEventListener("resize", layout);
      layout(); await Promise.all([loadWhales(), loadSky()]);
      if (disposed || failed) return;
      ready = true; updateWorld(0); layout();
      if (failed || disposed) return;
      sample(true); options.onReady(); synchronizePlayback();
    } catch (error) { if (!disposed) reportError(error instanceof Error ? error.message : "하늘 여행을 준비하지 못했습니다."); }
  }
  const controller: FlightController = {
    setPaused(value) { if (disposed || value === paused) return; paused = value; synchronizePlayback(); },
    setReducedMotion(value) { if (disposed || value === reduced) return; reduced = value; synchronizePlayback(); },
    setPointer(x, y) { if (!disposed && Number.isFinite(x) && Number.isFinite(y)) pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)); },
    getStats,
    dispose() {
      if (disposed) return; disposed = true; ready = false; abort.abort(); stopLoop(); removeListeners();
      disposeResources(); scene.clear(); renderer?.dispose();
      canvas.dataset.flightReady = "false"; canvas.dataset.flightPaused = "true"; canvas.dataset.whaleCount = "0";
      // No forced context loss: React strict-mode may immediately reuse the canvas.
    }
  };
  void Promise.resolve().then(() => { if (!disposed) return initialize(); });
  return controller;
}
