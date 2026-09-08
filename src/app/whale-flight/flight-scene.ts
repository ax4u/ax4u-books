import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

export type FlightController = {
  setPaused(paused: boolean): void;
  setReducedMotion(reduced: boolean): void;
  setPointer(x: number, y: number): void;
  dispose(): void;
  getStats(): { time: number; frames: number; whales: number; drawCalls: number };
};

type FlightOptions = {
  reducedMotion: boolean;
  onReady: () => void;
  onError: (message: string) => void;
  onStage: (stage: number) => void;
};

type Whale = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  phase: number;
  radius: number;
  depth: number;
  reach: number;
  altitude: number;
  speed: number;
};

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
  let frames = 0;
  let stage = -1;
  let lastSample = -1;
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
  const camera = new THREE.PerspectiveCamera(48, 1, 0.2, 300);
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
    stopLoop();
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
      whale.mixer.stopAllAction();
      whale.mixer.uncacheRoot(whale.mixer.getRoot());
    }
    for (const skeleton of skeletons) skeleton.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) {
      texture.dispose();
      const image: unknown = texture.image;
      if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
    }
    skeletons.clear();
    geometries.clear();
    materials.clear();
    textures.clear();
  }

  function sample(force = false) {
    if (!force && elapsed - lastSample < 0.3) return;
    lastSample = elapsed;
    canvas.dataset.flightTime = elapsed.toFixed(2);
    canvas.dataset.whaleCount = String(whales.length);
    canvas.dataset.flightPaused = String(paused || reduced);
  }

  function render() {
    if (disposed || failed || !renderer) return;
    try {
      renderer.render(scene, camera);
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
    for (let index = 0; index < whales.length; index += 1) {
      const whale = whales[index];
      const a = whale.phase + t * TAU / CYCLE * whale.speed;
      const horizontal = mobile ? 0.56 : 1;
      whale.root.position.set(
        Math.sin(a) * whale.radius * horizontal,
        whale.altitude + Math.sin(a * 2 + index * 0.7) * (index === 0 ? 3.5 : 2),
        whale.depth + Math.cos(a) * whale.reach,
      );
      // Tangent-aligned, closed paths: approach, bank overhead, return behind fog.
      direction.set(
        Math.cos(a) * whale.radius * horizontal,
        Math.cos(a * 2 + index * 0.7) * (index === 0 ? 7 : 4),
        -Math.sin(a) * whale.reach,
      ).normalize();
      whale.root.quaternion.setFromUnitVectors(forward, direction);
      roll.setFromAxisAngle(forward, Math.sin(a + index) * 0.1);
      whale.root.quaternion.multiply(roll);
      whale.mixer.update(delta);
    }
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
    const delta = Math.min(rawDelta, 0.05);
    elapsed += delta;
    updateWorld(delta);
    render();
    if (rawDelta > 0 && rawDelta < 0.3) {
      fpsSeconds += rawDelta;
      fpsFrames += 1;
      if (fpsSeconds > 4) {
        if (fpsFrames / fpsSeconds < 35 && pixelRatio > 0.85 && renderer) {
          pixelRatio = Math.max(0.85, pixelRatio * 0.83);
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
    if (paused || reduced) render();
    else raf = requestAnimationFrame(tick);
  }

  const controller: FlightController = {
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
      return { time: elapsed, frames, whales: whales.length, drawCalls: renderer?.info.render.calls ?? 0 };
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
    const response = await fetch("/whale-flight/blue-whale.glb", { signal: abort.signal });
    if (!response.ok) throw new Error("고래 모델을 불러오지 못했습니다.");
    const bytes = await response.arrayBuffer();
    if (disposed || failed) return;
    const gltf = await new GLTFLoader().parseAsync(bytes, "/whale-flight/");
    registerModel(gltf.scene);
    if (disposed || failed) {
      disposeResources();
      return;
    }
    const swimming = gltf.animations.find((clip) => clip.name === "Swimming");
    if (!swimming) throw new Error("고래의 수영 애니메이션이 없습니다.");
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const length = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(length) || length <= 0) throw new Error("고래 모델의 크기를 확인할 수 없습니다.");
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.metalness = 0.02;
          material.roughness = 0.67;
          material.envMapIntensity = 0.4;
          material.normalScale.setScalar(0.72);
        }
      }
    });
    const count = mobile ? 6 : 10;
    for (let i = 0; i < count; i += 1) {
      const model = cloneSkeleton(gltf.scene);
      registerModel(model);
      const centered = new THREE.Group();
      centered.add(model);
      model.position.sub(center);
      // Keep every imported bone transform; scale only the enclosing group.
      const targetLength = i === 0 ? (mobile ? 18 : 29) : 16 + (i % 4) * 3.5;
      centered.scale.setScalar(targetLength / length);
      const root = new THREE.Group();
      root.add(centered);
      scene.add(root);
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(swimming);
      action.setLoop(THREE.LoopRepeat, Infinity).play();
      action.timeScale = 0.65 + (i % 4) * 0.1;
      mixer.update((i * 0.73) % Math.max(swimming.duration, 0.01));
      whales.push({
        root, mixer,
        phase: i === 0 ? -0.38 : i * 1.13,
        radius: i === 0 ? 22 : 25 + (i % 4) * 10,
        depth: i === 0 ? -27 : -48 - i * 8,
        reach: i === 0 ? 14 : 13 + (i % 3) * 6,
        altitude: i === 0 ? 6 : 1 + (i % 4) * 5,
        speed: i === 0 ? 1 : 0.6 + (i % 3) * 0.2,
      });
    }
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
