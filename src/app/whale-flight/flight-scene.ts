import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createOriginalCetacean, type SpeciesId } from "./original-cetaceans";
import { WHALE_SPECIES, orderedSpecies, type FlightView, type SpeciesOrder, type WhaleSpecies, type WhaleSpeciesId } from "./species";

export type { FlightView, SpeciesOrder, WhaleSpeciesId } from "./species";
export type FlightController = {
  setPaused(paused: boolean): void;
  setReducedMotion(reduced: boolean): void;
  setPointer(x: number, y: number): void;
  setViewMode(mode: FlightView): void;
  setSpeciesOrder(order: SpeciesOrder): void;
  focusSpecies(id: WhaleSpeciesId): void;
  dispose(): void;
  getStats(): { time: number; frames: number; whales: number; drawCalls: number; species: string[]; mode: FlightView; activeSpecies: WhaleSpeciesId };
};

type FlightOptions = {
  reducedMotion: boolean;
  onReady: () => void;
  onError: (message: string) => void;
  onStage: (stage: number) => void;
  onSpecies: (id: WhaleSpeciesId) => void;
};

type Whale = {
  species: WhaleSpecies;
  root: THREE.Group;
  model: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  original?: ReturnType<typeof createOriginalCetacean>;
  probes: { mesh: THREE.Mesh; indices: number[] }[];
  label: HTMLDivElement;
  bodyLength: number;
  bodyHeight: number;
  animationTime: number;
  phase: number;
  focus: number;
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
};

// One metre is one world unit in BOTH cameras. Never scale a selected animal.
const COMPARE_WIDTH = 64;
const FOCUS_INTERVAL = 13;
const FOCUS_SECONDS = 1.7;

const TAU = Math.PI * 2;
const CYCLE = 40;

/** Owns all GPU resources and the animation scheduler; never owns the canvas. */
export function createFlightScene(canvas: HTMLCanvasElement, options: FlightOptions): FlightController {
  let disposed = false;
  let failed = false;
  let ready = false;
  let paused = false;
  let reduced = options.reducedMotion;
  let raf = 0;
  let previousStamp = 0;
  let elapsed = 0;
  // Keep editorial pacing independent of the clamped animation step on slow GPUs.
  let presentationTime = 0;
  let frames = 0;
  let stage = -1;
  let lastSample = -1;
  let mode: FlightView = "flight";
  let order: SpeciesOrder = "size";
  let activeSpecies: WhaleSpeciesId = "blue";
  let focusTarget: WhaleSpeciesId = "blue";
  let nextFocusTime = FOCUS_INTERVAL;
  let snapPlacement = true;
  let fpsSeconds = 0;
  let fpsFrames = 0;
  let width = 1;
  let height = 1;
  let mobile = canvas.clientWidth < 720;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  let renderer: THREE.WebGLRenderer | undefined;
  let resizeObserver: ResizeObserver | undefined;
  const abort = new AbortController();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  const whales: Whale[] = [];
  const pointer = new THREE.Vector2();
  const easedPointer = new THREE.Vector2();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#90b7b7");
  scene.fog = new THREE.FogExp2("#a5c6c5", 0.0072);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.2, 400);
  const compareCamera = new THREE.OrthographicCamera(-32, 32, 32, -32, 0.1, 400);
  compareCamera.position.set(0, 0, 100);
  compareCamera.lookAt(0, 0, 0);
  scene.add(compareCamera);
  const flightFog = scene.fog;
  const labels = document.createElement("div");
  labels.dataset.whaleLabels = "true";
  labels.setAttribute("aria-hidden", "true");
  Object.assign(labels.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden", display: "none" });
  canvas.parentElement?.appendChild(labels);
  camera.position.set(0, 2.4, 14);
  scene.add(camera);
  const lookTarget = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, 1);
  const roll = new THREE.Quaternion();
  const skyMaterial = new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false, fog: false, toneMapped: false });
  materials.add(skyMaterial);
  const skyGeometry = new THREE.PlaneGeometry(1, 1);
  geometries.add(skyGeometry);
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.position.z = -240;
  sky.renderOrder = -100;
  sky.visible = false;
  camera.add(sky);
  let skyAspect = 1.5;
  let dust: THREE.Points | undefined;
  const cloudLayers: { sprite: THREE.Sprite; x: number; y: number; phase: number }[] = [];

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    previousStamp = 0;
  }

  function reportError(message: string) {
    if (disposed || failed) return;
    failed = true;
    ready = false;
    abort.abort();
    stopLoop();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", layout);
    labels.remove();
    disposeResources();
    renderer?.dispose();
    canvas.dataset.flightReady = "false";
    options.onError(message);
  }

  function trackTexture(texture: THREE.Texture): THREE.Texture {
    if (disposed || failed) {
      texture.dispose();
      const image: unknown = texture.image;
      if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
    } else {
      textures.add(texture);
    }
    return texture;
  }

  function registerModel(root: THREE.Object3D) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.SkinnedMesh) {
        skeletons.add(object.skeleton);
        // Animated fin/tail bounds can exceed the imported bind-pose box.
        object.frustumCulled = false;
      }
    });
  }

  function disposeResources() {
    for (const whale of whales) {
      whale.mixer?.stopAllAction();
      if (whale.mixer) whale.mixer.uncacheRoot(whale.mixer.getRoot());
      whale.original?.dispose();
      whale.root.removeFromParent();
      whale.label.remove();
    }
    for (const skeleton of skeletons) skeleton.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) {
      texture.dispose();
      const image: unknown = texture.image;
      if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
    }
    whales.length = 0;
    skeletons.clear();
    geometries.clear();
    materials.clear();
    textures.clear();
  }

  function sample(force = false) {
    if (!force && elapsed - lastSample < 0.3) return;
    lastSample = elapsed;
    canvas.dataset.flightTime = elapsed.toFixed(2);
    canvas.dataset.presentationTime = presentationTime.toFixed(2);
    canvas.dataset.flightFrames = String(frames);
    canvas.dataset.pixelRatio = String(pixelRatio);
    const ids = [...new Set(whales.map(whale => whale.species.id))];
    canvas.dataset.whaleCount = String(whales.length);
    canvas.dataset.whaleSpecies = JSON.stringify(ids);
    canvas.dataset.speciesCount = String(ids.length);
    canvas.dataset.viewMode = mode;
    canvas.dataset.comparisonWidth = String(compareCamera.right-compareCamera.left);
    canvas.dataset.activeSpecies = activeSpecies;
    canvas.dataset.whaleModels = JSON.stringify(whales.map(whale => ({
      id: whale.species.id,
      model: whale.species.asset ?? `original:${whale.species.id}`,
      bodyLength: whale.bodyLength,
      animationTime: whale.mixer?.time ?? whale.animationTime,
      bodyHeight: whale.bodyHeight,
      position: whale.root.position.toArray(),
      rotation: whale.root.quaternion.toArray(),
      focus: whale.focus,
      motionSample: motionSample(whale),
      renderBox: (() => {const box = new THREE.Box3().setFromObject(whale.root,true);const min=box.min.clone().project(mode === "compare" ? compareCamera : camera);const max=box.max.clone().project(mode === "compare" ? compareCamera : camera);return {min:min.toArray(),max:max.toArray()};})(),
    })));
    canvas.dataset.flightPaused = String(paused || reduced);
  }

  function render() {
    if (disposed || failed || !renderer) return;
    try {
      renderer.render(scene, mode === "compare" ? compareCamera : camera);
      frames += 1;
      sample();
    } catch (error: unknown) {
      reportError(error instanceof Error ? error.message : "하늘을 그리는 중 오류가 발생했습니다.");
    }
  }

  function layout() {
    if (disposed || failed || !renderer) return;
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    mobile = width < 720;
    pixelRatio = Math.min(pixelRatio, mobile ? 1.25 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = mobile ? 55 : 48;
    camera.updateProjectionMatrix();
    compareCamera.left = -COMPARE_WIDTH / 2;
    compareCamera.right = COMPARE_WIDTH / 2;
    compareCamera.top = COMPARE_WIDTH * height / width / 2;
    compareCamera.bottom = -compareCamera.top;
    compareCamera.updateProjectionMatrix();
    // A single distant painting, covered without distorting its aspect ratio.
    const viewHeight = 2 * 240 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const coverHeight = Math.max(viewHeight, (viewHeight * camera.aspect) / skyAspect);
    sky.scale.set(coverHeight * skyAspect * 1.015, coverHeight * 1.015, 1);
    updateWorld(0);
    render();
    sample(true);
  }

  function updateWorld(delta: number) {
    const t = elapsed;
    easedPointer.lerp(pointer, 1 - Math.exp(-delta * 1.7));
    camera.position.set(
      Math.sin(t * TAU / CYCLE) * 1.25 + easedPointer.x * 0.75,
      2.4 + Math.sin(t * TAU / CYCLE + 0.2) * 0.65 + easedPointer.y * 0.4,
      14 + Math.sin(t * TAU / CYCLE) * 1.6,
    );
    lookTarget.set(easedPointer.x * 0.65, 3.3 + easedPointer.y * 0.5, -38);
    camera.lookAt(lookTarget);
    camera.updateMatrixWorld(true);
    if (mode === "flight" && ready && presentationTime >= nextFocusTime) {
      const sequence = orderedSpecies(order);
      const current = sequence.findIndex(species => species.id === activeSpecies);
      selectSpecies(sequence[(current + 1) % sequence.length].id, false);
    }
    const sequence = orderedSpecies(order);
    // Reserve the actual navigator/title regions; compact landscape prioritises fit.
    const topInset = height < 500 ? 75 : mobile ? 176 : 220;
    const bottomInset = height < 500 ? 155 : mobile ? 244 : 254;
    const usableHeight = Math.max(1, height - topInset - bottomInset);
    const columns = width >= 720 ? 2 : 1;
    const rows = new Map<WhaleSpeciesId, { y:number; column:number }>();
    const rowWeights = sequence.map(species => Math.max(1.5, (whales.find(w => w.species.id === species.id)?.bodyHeight ?? 1) + 0.9));
    const groups = Array.from({length:columns},(_,column) => sequence.slice(column * (10/columns),(column+1)*(10/columns)));
    const groupWeights = groups.map(group => group.reduce((sum,species) => sum+rowWeights[sequence.indexOf(species)],0));
    const comparisonWidth = Math.max(columns === 2 ? 74 : 38, width * Math.max(...groupWeights) / usableHeight * 1.15);
    compareCamera.left = -comparisonWidth/2; compareCamera.right=comparisonWidth/2;
    compareCamera.top=comparisonWidth*height/width/2; compareCamera.bottom=-compareCamera.top;
    compareCamera.updateProjectionMatrix();
    groups.forEach((group,column) => {
      let cumulative=0;
      for(const species of group){const weight=rowWeights[sequence.indexOf(species)];
        rows.set(species.id,{y:topInset+usableHeight*(cumulative+weight/2)/groupWeights[column],column});cumulative+=weight;
      }
    });
    scene.fog = mode === "compare" ? null : flightFog;
    sky.visible = mode === "flight" && !!skyMaterial.map;
    labels.style.display = mode === "compare" ? "block" : "none";
    for (let index = 0; index < whales.length; index += 1) {
      const whale = whales[index];
      if (delta > 0) {
        whale.animationTime += delta;
        whale.mixer?.update(delta);
        whale.original?.update(whale.animationTime);
      }
      if (mode === "compare") {
        const row = rows.get(whale.species.id)!;
        // Every column shares the SAME orthographic metre scale. Left-align noses.
        const headFraction = row.column/columns + (columns===2 ? .17 : .32);
        whale.root.position.set((-0.5+headFraction)*comparisonWidth+whale.bodyLength/2, (height/2-row.y)*comparisonWidth/width, 0);
        whale.root.rotation.set(0, -Math.PI / 2, 0);
        whale.label.style.top = `${canvas.offsetTop + row.y}px`;
        whale.label.style.left = `${canvas.offsetLeft+width*(row.column/columns+0.025)}px`;
        whale.label.style.color = whale.species.id === activeSpecies ? "#062d3a" : "#204551";
        whale.label.style.fontWeight = whale.species.id === activeSpecies ? "800" : "600";
      } else {
        const a = whale.phase + t * TAU / (70 + index * 4);
        // Separate depth bands remain separate even where projected paths cross.
        whale.position.set(Math.sin(a) * (20 + index * 2) * (mobile ? 0.65 : 1),
          5 + Math.sin(a * 1.7 + index) * 7, -43 - index * 13 + Math.cos(a) * 5);
        direction.set(Math.cos(a) * (20 + index * 2), Math.cos(a * 1.7 + index) * 7, -Math.sin(a) * 5).normalize();
        whale.orientation.setFromUnitVectors(forward, direction);
        roll.setFromAxisAngle(forward, Math.sin(a + index) * 0.08);
        whale.orientation.multiply(roll);
        const target = whale.species.id === focusTarget ? 1 : 0;
        whale.focus = snapPlacement ? target : THREE.MathUtils.clamp(whale.focus + Math.sign(target - whale.focus) * delta / FOCUS_SECONDS, 0, 1);
        const blend = whale.focus * whale.focus * (3 - 2 * whale.focus);
        if (blend > 0) {
          // Small animals are physically nearer, NOT enlarged. Same camera occupancy.
          const distance = Math.max(6, whale.bodyLength / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.66));
          const close = new THREE.Vector3(Math.sin(t * 0.14) * whale.bodyLength * 0.07,
            distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.15 + Math.sin(t * 0.21) * whale.bodyLength * 0.035, -distance);
          camera.localToWorld(close);
          whale.position.lerp(close, blend);
          const side = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 0.15) * 0.045, -Math.PI / 2 + Math.sin(t * 0.12) * 0.16, Math.sin(t * 0.17) * 0.025));
          side.premultiply(camera.quaternion);
          whale.orientation.slerp(side, blend);
        }
        whale.root.position.copy(whale.position);
        whale.root.quaternion.copy(whale.orientation);
      }
    }
    if (mode === "flight" && whales.length) {
      const nearest = whales.reduce((a, b) => a.focus >= b.focus ? a : b);
      if (nearest.focus > 0 && activeSpecies !== nearest.species.id) {
        activeSpecies = nearest.species.id;
        if (ready) options.onSpecies(activeSpecies);
      }
    }
    snapPlacement = false;
    for (const cloud of cloudLayers) cloud.sprite.visible = mode === "flight";
    if (dust) dust.visible = mode === "flight";
    for (const cloud of cloudLayers) {
      cloud.sprite.position.x = cloud.x + Math.sin(t * 0.027 + cloud.phase) * 3;
      cloud.sprite.position.y = cloud.y + Math.sin(t * 0.039 + cloud.phase) * 0.5;
    }
    if (dust) {
      dust.rotation.y = t * 0.006;
      dust.position.y = Math.sin(t * 0.06) * 0.8;
    }

    const nextStage = Math.floor((t % CYCLE) / 10);
    if (nextStage !== stage) {
      stage = nextStage;
      options.onStage(stage);
    }
  }

  function tick(stamp: number) {
    raf = 0;
    if (disposed || failed || paused || reduced || !ready) return;
    const rawDelta = previousStamp ? (stamp - previousStamp) / 1000 : 0;
    previousStamp = stamp;
    const delta = Math.min(rawDelta, 0.1);
    elapsed += delta;
    presentationTime += Math.min(rawDelta, 2);
    updateWorld(delta);
    render();
    if (rawDelta > 0 && rawDelta < 5) {
      fpsSeconds += rawDelta;
      fpsFrames += 1;
      if (fpsSeconds > 2) {
        if (fpsFrames / fpsSeconds < 28 && pixelRatio > 0.65 && renderer) {
          pixelRatio = Math.max(0.65, pixelRatio * 0.8);
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(width, height, false);
        }
        fpsSeconds = 0;
        fpsFrames = 0;
      }
    }
    if (!disposed && !failed && !paused && !reduced) raf = requestAnimationFrame(tick);
  }

  function synchronizePlayback() {
    stopLoop();
    sample(true);
    if (!ready || disposed || failed) return;
    if (!paused && !reduced) raf = requestAnimationFrame(tick);
  }

  function selectSpecies(id: WhaleSpeciesId, immediate: boolean) {
    if (disposed || failed || !WHALE_SPECIES.some(species => species.id === id)) return;
    focusTarget = id;
    nextFocusTime = presentationTime + FOCUS_INTERVAL;
    if (immediate) snapPlacement = true;
    if (mode === "compare") {
      activeSpecies = id;
      if (ready) options.onSpecies(activeSpecies);
    }
  }

  function motionSample(whale: Whale): number[] {
    const values: number[] = [];
    const vertex = new THREE.Vector3();
    whale.model.updateMatrixWorld(true);
    whale.model.traverse(object => {
      if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      if (object instanceof THREE.Bone) values.push(...object.quaternion.toArray().map(value => Number(value.toFixed(6))));
    });
    for (const probe of whale.probes) {
      for (const index of probe.indices) {
        probe.mesh.getVertexPosition(index, vertex);
        values.push(...vertex.toArray().map(value => Number(value.toFixed(6))));
      }
    }
    return values;
  }

  const controller: FlightController = {
    setViewMode(value) {
      if (disposed || failed || (value !== "flight" && value !== "compare") || value === mode) return;
      mode = value;
      snapPlacement = true;
      nextFocusTime = presentationTime + FOCUS_INTERVAL;
      updateWorld(0);
      render();
      sample(true);
    },
    setSpeciesOrder(value) {
      if (disposed || failed || (value !== "size" && value !== "familiar")) return;
      order = value;
      nextFocusTime = presentationTime + FOCUS_INTERVAL;
      updateWorld(0);
      render();
      sample(true);
    },
    focusSpecies(id) {
      selectSpecies(id, true);
      if (disposed || failed) return;
      updateWorld(0);
      render();
      sample(true);
    },
    setPaused(value) {
      if (disposed || paused === value) return;
      paused = value;
      synchronizePlayback();
    },
    setReducedMotion(value) {
      if (disposed || reduced === value) return;
      reduced = value;
      synchronizePlayback();
    },
    setPointer(x, y) {
      if (disposed || !Number.isFinite(x) || !Number.isFinite(y)) return;
      pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
    },
    getStats() {
      return { time: elapsed, frames, whales: whales.length, drawCalls: renderer?.info.render.calls ?? 0,
        species: [...new Set(whales.map(whale => whale.species.id))], mode, activeSpecies };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      stopLoop();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", layout);
      canvas.removeEventListener("webglcontextlost", contextLost);
      disposeResources();
      labels.remove();
      scene.clear();
      renderer?.dispose();
      // Do not forceContextLoss: a React strict-mode remount may reuse this canvas.
      canvas.dataset.flightReady = "false";
    },
  };

  function contextLost(event: Event) {
    event.preventDefault();
    reportError("그래픽 연결이 잠시 끊겼습니다. 페이지를 새로고침해 주세요.");
  }

  function makeCloudTexture() {
    const surface = document.createElement("canvas");
    surface.width = 256;
    surface.height = 128;
    const context = surface.getContext("2d");
    if (!context) throw new Error("구름 이미지를 준비할 수 없습니다.");
    // Deterministic overlapping soft lobes, with cool bottoms and sunlit crowns.
    for (let i = 0; i < 28; i += 1) {
      const x = 28 + ((i * 53) % 200);
      const y = 43 + Math.sin(i * 2.13) * 20;
      const radius = 23 + (i % 5) * 5;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, i % 3 === 0 ? "rgba(255,245,218,0.21)" : "rgba(218,237,233,0.17)");
      gradient.addColorStop(0.5, "rgba(205,226,224,0.10)");
      gradient.addColorStop(1, "rgba(173,205,210,0)");
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const texture = trackTexture(new THREE.CanvasTexture(surface));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function buildAtmosphere() {
    scene.add(new THREE.HemisphereLight("#d4eeed", "#486974", 2.7));
    const sunlight = new THREE.DirectionalLight("#ffe3ab", 4.2);
    sunlight.position.set(-28, 38, 16);
    scene.add(sunlight);
    const rim = new THREE.DirectionalLight("#9ae0e3", 2.3);
    rim.position.set(18, 14, -48);
    scene.add(rim);
    const fill = new THREE.DirectionalLight("#d9e9f0", 1.1);
    fill.position.set(4, -3, 22);
    scene.add(fill);
    const cloudTexture = makeCloudTexture();
    const cloudMaterial = new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: 0.58, depthWrite: false, fog: true });
    materials.add(cloudMaterial);
    const count = mobile ? 17 : 27;
    for (let i = 0; i < count; i += 1) {
      const sprite = new THREE.Sprite(cloudMaterial);
      const x = ((i * 37) % 130) - 65;
      const y = i % 3 === 0 ? 15 + (i % 5) * 3 : -10 - (i % 4) * 2;
      sprite.position.set(x, y, -20 - ((i * 29) % 120));
      const size = 27 + (i % 5) * 9;
      sprite.scale.set(size, size * 0.5, 1);
      scene.add(sprite);
      cloudLayers.push({ sprite, x, y, phase: i * 0.83 });
    }
    const particleCount = mobile ? 65 : 140;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = Math.sin(i * 127.1) * 43;
      positions[i * 3 + 1] = Math.sin(i * 311.7) * 26;
      positions[i * 3 + 2] = -8 - ((i * 17.7) % 100);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometries.add(geometry);
    const material = new THREE.PointsMaterial({ color: "#fff1cb", size: 0.065, transparent: true, opacity: 0.37, depthWrite: false, sizeAttenuation: true });
    materials.add(material);
    dust = new THREE.Points(geometry, material);
    scene.add(dust);
  }

  async function loadTexture(url: string) {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 4);
    return trackTexture(texture);
  }

  async function loadWhales() {
    await Promise.all(WHALE_SPECIES.map(async (species, index) => {
      let model: THREE.Object3D;
      let original: ReturnType<typeof createOriginalCetacean> | undefined;
      let mixer: THREE.AnimationMixer | undefined;
      const normalized = new THREE.Group();
      let bodyLength: number;
      let bodyHeight: number;
      if (species.model === "gltf") {
        if (!species.asset || !species.clip) throw new Error(`${species.name}: 모델 정보가 없습니다.`);
        const response = await fetch(species.asset, { signal: abort.signal });
        if (!response.ok) throw new Error(`${species.name} 모델을 불러오지 못했습니다 (${response.status}).`);
        const bytes = await response.arrayBuffer();
        if (disposed || failed) return;
        // A separate source scene and mixer per species. No cloning/recolour fallback.
        const gltf = await new GLTFLoader().parseAsync(bytes, species.asset.slice(0, species.asset.lastIndexOf("/") + 1));
        model = gltf.scene;
        registerModel(model);
        if (disposed || failed) { disposeResources(); return; }
        const swimming = gltf.animations.find(clip => clip.name === species.clip);
        if (!swimming || !swimming.tracks.length) throw new Error(`${species.name}의 ${species.clip} 애니메이션이 없습니다.`);
        // Keep GLTFLoader's authored local transforms. Skeleton.pose() rebuilds
        // them from inverse binds (including synthetic identity-bind joints),
        // not this FBX hierarchy's authored rest pose. Partial clips retain a
        // 90-degree fold; dolphin bounds inflate ~100x before its clip resets.
        model.updateMatrixWorld(true);
        model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
        // precise=true measures the intact authored reference-pose skin vertices.
        const bounds = new THREE.Box3().setFromObject(model, true);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const axis = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
        const length = size.getComponent(axis);
        if (!Number.isFinite(length) || length <= 0) throw new Error(`${species.name}: 유효한 몸길이가 없습니다.`);
        const translation = new THREE.Group();
        translation.position.copy(center).negate();
        translation.add(model);
        const alignment = new THREE.Group();
        alignment.add(translation);
        // Imported coordinates are normalised to nose +Z. Named head bones resolve sign.
        let headCoordinate: number | undefined;
        model.traverse(object => {
          if (object instanceof THREE.Bone && /head|snout|rostrum/i.test(object.name) && headCoordinate === undefined) {
            headCoordinate = object.getWorldPosition(new THREE.Vector3()).getComponent(axis);
          }
        });
        const sign = headCoordinate !== undefined && headCoordinate < 0 ? -1 : 1;
        const sourceForward = new THREE.Vector3().setComponent(axis, sign);
        // Z-up exporters (longitudinal Y) need a full orthonormal basis, not
        // shortest-arc rotation: the latter flips their dorsum upside down.
        const sourceUp = axis === 1 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        const sourceRight = new THREE.Vector3().crossVectors(sourceUp, sourceForward).normalize();
        const correctedUp = new THREE.Vector3().crossVectors(sourceForward, sourceRight).normalize();
        alignment.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sourceRight, correctedUp, sourceForward).invert());
        normalized.add(alignment);
        normalized.scale.setScalar(species.length / length);
        normalized.updateMatrixWorld(true);
        const measured = new THREE.Box3().setFromObject(normalized, true).getSize(new THREE.Vector3());
        bodyLength = measured.z;
        bodyHeight = measured.y;
        normalized.userData.bindPoseExtent = size.toArray();
        normalized.userData.lengthAxis = axis;
        normalized.userData.headSign = sign;
        mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(swimming);
        action.setLoop(THREE.LoopRepeat, Infinity).play();
        action.timeScale = 0.8;
        mixer.update(0);
      } else {
        original = createOriginalCetacean(species.id as SpeciesId);
        model = original.root;
        normalized.add(model);
        normalized.scale.setScalar(species.length);
        normalized.updateMatrixWorld(true);
        const bodyBounds = new THREE.Box3();
        model.traverse(object => {
          if (object instanceof THREE.Mesh && !/tusk/i.test(object.name)) bodyBounds.union(new THREE.Box3().setFromObject(object, true));
        });
        const measured = bodyBounds.getSize(new THREE.Vector3());
        bodyLength = measured.z;
        bodyHeight = measured.y;
      }
      const root = new THREE.Group();
      root.name = `species-${species.id}`;
      root.userData.species = species.id;
      root.add(normalized);
      const label = document.createElement("div");
      label.dataset.species = species.id;
      label.textContent = `${species.name} · ${species.length}m`;
      Object.assign(label.style, { position: "absolute", transform: "translateY(-50%)", font: "600 clamp(10px, 1.1vw, 14px) system-ui, sans-serif", whiteSpace: "nowrap", textShadow: "0 1px 3px #dcefed" });
      labels.appendChild(label);
      const probes: Whale["probes"] = [];
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const count = object.geometry.getAttribute("position")?.count ?? 0;
        if (count) probes.push({ mesh: object, indices: [0, Math.floor(count * 0.19), Math.floor(count * 0.63), count - 1] });
      });
      if (!probes.length || !Number.isFinite(bodyLength) || Math.abs(bodyLength - species.length) > 0.01) {
        original?.dispose();
        mixer?.stopAllAction();
        if (mixer) mixer.uncacheRoot(model);
        label.remove();
        throw new Error(`${species.name}: 실제 모델 몸길이 검증에 실패했습니다.`);
      }
      const whale: Whale = { species, root, model, mixer, original, probes, label, bodyLength, bodyHeight,
        animationTime: 0, phase: index * 1.13, focus: species.id === focusTarget ? 1 : 0,
        position: new THREE.Vector3(), orientation: new THREE.Quaternion() };
      if (disposed || failed) { original?.dispose(); mixer?.stopAllAction(); if (mixer) mixer.uncacheRoot(model); label.remove(); return; }
      scene.add(root);
      whales.push(whale);
    }));
    whales.sort((a, b) => WHALE_SPECIES.indexOf(a.species) - WHALE_SPECIES.indexOf(b.species));
    if (!disposed && !failed && (whales.length !== 10 || new Set(whales.map(whale => whale.species.id)).size !== 10 || new Set(whales.map(whale => whale.model.uuid)).size !== 10)) {
      throw new Error("서로 다른 고래 10종을 모두 준비하지 못했습니다.");
    }
    snapPlacement = true;
  }

  async function initialize() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setClearColor("#90b7b7", 1);
      canvas.addEventListener("webglcontextlost", contextLost);
      buildAtmosphere();
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(layout);
        resizeObserver.observe(canvas);
      } else window.addEventListener("resize", layout);
      layout();
      const [, background] = await Promise.all([
        loadWhales(),
        loadTexture("/whale-flight/sky.webp"),
      ]);
      if (disposed || failed) return;
      skyMaterial.map = background;
      skyMaterial.needsUpdate = true;
      const skyImage = background.image as { width: number; height: number };
      skyAspect = skyImage.width / skyImage.height;
      sky.visible = true;

      ready = true;
      layout();
      if (disposed || failed) return;
      canvas.dataset.flightReady = "true";
      sample(true);
      options.onReady();
      options.onSpecies(activeSpecies);
      synchronizePlayback();
    } catch (error: unknown) {
      if (disposed) return;
      reportError(error instanceof Error ? error.message : "하늘 여행을 준비하지 못했습니다.");
      abort.abort();
      disposeResources();
    }
  }

  // Defer even synchronous WebGL failures until the caller receives its controller.
  void Promise.resolve().then(() => {
    if (!disposed) return initialize();
  });
  return controller;
}
