/**
 * The gallery room: a framework-agnostic three.js scene.
 *
 * An evening gallery with three hung walls. Works hang at their real size, each under
 * its own picture light. Room lighting is baked (see bake.ts); the only realtime lights
 * shade the frames and fittings. The canvas is decorative: titles, labels and controls
 * live in HTML.
 *
 * createGalleryScene() returns at once. The lightmaps are then baked in short slices and
 * the shaders compiled in the background; the first frame is drawn, and onReady called,
 * when that is done and the opening work's image has loaded or failed.
 *
 * This file wires the parts together and runs the frame loop:
 *   surfaces.ts  room geometry        lighting.ts  picture lights and track hardware
 *   shell.ts     walls, floor, door   works.ts     frames, pictures, labels, images
 *   camera-rig.ts  the visitor's eye  picking.ts   clicking a painting
 */
import {
  AgXToneMapping,
  Color,
  FogExp2,
  Mesh,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import type { BufferGeometry, Material } from "three";
import { createCameraRig } from "./camera-rig";
import { createBakeQueue, createTracker } from "./kit";
import type { SceneKit } from "./kit";
import { EYE_HEIGHT, layoutRoom, MAX_WORKS } from "./layout";
import { lightPictures } from "./lighting";
import { clamp } from "./math";
import { attachPicking } from "./picking";
import { buildShell } from "./shell";
import { createRoomSurfaces } from "./surfaces";
import type { GalleryScene, GallerySceneOptions } from "./types";
import {
  hangWorks,
  loadWorkTextures,
  showImmediately,
  updateWorks,
} from "./works";

export type { GalleryScene, GallerySceneOptions, RoomArtwork } from "./types";

const MAX_PIXEL_RATIO = 1.75;
const EXPOSURE = 1.25;
const BACKGROUND = 0x0d0b09;
const FOG_DENSITY = 0.03;
const READY_TIMEOUT_MS = 2500;
/** Longest a background build slice may hold the main thread. */
const BUILD_SLICE_MS = 8;

export function createGalleryScene(
  canvas: HTMLCanvasElement,
  options: GallerySceneOptions,
): GalleryScene {
  const artworks = options.artworks.slice(0, MAX_WORKS);
  const tracker = createTracker();

  // --- Renderer and scene ---------------------------------------------------------

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.setClearColor(BACKGROUND, 1);

  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  scene.fog = new FogExp2(BACKGROUND, FOG_DENSITY);

  const layout = layoutRoom(artworks);
  const kit: SceneKit = {
    renderer,
    scene,
    layout,
    surfaces: createRoomSurfaces(layout),
    anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    track: tracker.track,
  };

  // --- The room -------------------------------------------------------------------

  const lighting = lightPictures(kit);
  const bakes = createBakeQueue(lighting);
  const shell = buildShell(kit, bakes, lighting);
  const works = hangWorks(kit, bakes, shell, artworks);
  const rig = createCameraRig(layout);
  const { camera } = rig;
  const { floor, floorMesh } = shell;

  // --- State ----------------------------------------------------------------------

  let disposed = false;
  let running = false;
  let frameHandle = 0;
  let lastTime = 0;
  let dirty = true;
  let reducedMotion = options.reducedMotion;
  let activeIndex = clamp(
    Math.round(options.initialIndex) || 0,
    0,
    Math.max(0, works.length - 1),
  );
  let viewWidth = Math.max(1, canvas.clientWidth);
  let viewHeight = Math.max(1, canvas.clientHeight);
  let pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  let readyFired = false;
  let built = false;
  let framesDrawn = 0;
  const createdAt = performance.now();

  const applySize = () => {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(viewWidth, viewHeight, false);
    rig.setViewSize(viewWidth, viewHeight);
    floor.setSize(viewWidth * pixelRatio * 0.5, viewHeight * pixelRatio * 0.5);
    dirty = true;
  };

  loadWorkTextures(kit, works, artworks, {
    isDisposed: () => disposed,
    onLoaded: () => {
      dirty = true;
    },
    onError: (id) => options.onTextureError?.(id),
  });

  // --- Frame loop -----------------------------------------------------------------

  const draw = () => {
    floorMesh.visible = false;
    floor.render(renderer, scene, camera);
    floorMesh.visible = true;
    renderer.render(scene, camera);
    framesDrawn++;
    dirty = false;
  };

  // Frame-time governor: if the device cannot hold the frame rate, give up resolution
  // before giving up smoothness. Only ever steps down.
  let sampledFrames = 0;
  let slowFrames = 0;
  const governPixelRatio = (dt: number) => {
    if (!readyFired || performance.now() - createdAt < 3000) return;
    if (dt >= 0.1) {
      // A stall (tab throttled, main thread busy elsewhere) says nothing about the GPU.
      sampledFrames = 0;
      slowFrames = 0;
      return;
    }
    sampledFrames++;
    if (dt > 1 / 45) slowFrames++;
    if (sampledFrames < 120) return;
    const mostlySlow = slowFrames > sampledFrames * 0.7;
    sampledFrames = 0;
    slowFrames = 0;
    if (mostlySlow && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.4);
      applySize();
    }
  };

  const fireReadyIfDue = () => {
    if (readyFired || framesDrawn === 0) return;
    const first = works[activeIndex];
    const waiting =
      first &&
      !first.settled &&
      performance.now() - createdAt < READY_TIMEOUT_MS;
    if (waiting) return;
    readyFired = true;
    // Already here: show it with the room rather than fading it in afterwards.
    if (first?.loaded) showImmediately(first);
    // Walk in: start a little further back and settle in front of the first work.
    rig.walkIn(activeIndex, reducedMotion);
    dirty = true;
    options.onReady?.();
  };

  const frame = (now: number) => {
    if (!running) return;
    frameHandle = requestAnimationFrame(frame);
    // Everything below is closed-form in dt, so a long gap between frames (a busy
    // main thread, a throttled tab) just lands the motion where it should be by now.
    const dt = Math.min(3, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const motion = !reducedMotion;
    if (rig.update(dt, motion)) dirty = true;
    if (updateWorks(works, dt, activeIndex, motion, rig.scroll)) dirty = true;
    renderer.toneMappingExposure = EXPOSURE * (1 - 0.45 * rig.scroll);
    if (built && (dirty || motion)) {
      draw();
      if (motion) governPixelRatio(dt);
    }
    fireReadyIfDue();
  };

  const detachPicking = attachPicking({
    canvas,
    camera,
    targets: works.map((work) => work.hit),
    activeIndex: () => activeIndex,
    isDisposed: () => disposed,
    onPick: (index) => options.onActiveChange?.(index),
  });

  // --- Finish building, off the critical path ------------------------------------

  // Environment for the frames: the room itself, not a stock studio.
  const buildEnvironment = () => {
    const pmrem = new PMREMGenerator(renderer);
    floorMesh.visible = false;
    const environment = pmrem.fromScene(scene, 0.02, 0.1, 40, {
      size: 128,
      position: new Vector3(0, EYE_HEIGHT, 0),
    });
    floorMesh.visible = true;
    scene.environment = environment.texture;
    scene.environmentIntensity = 1.1;
    tracker.track(environment);
    pmrem.dispose();
  };

  /**
   * Compiles every shader the first frame needs before that frame is drawn. Where the
   * browser can compile in parallel this happens off the main thread; elsewhere it
   * costs what the first draw would have cost anyway.
   */
  const compileAll = async () => {
    floor.compile(renderer, scene, camera);
    await renderer.compileAsync(scene, camera);
  };

  const finishBuild = async () => {
    try {
      await compileAll();
      if (disposed) return;
      buildEnvironment();
      await compileAll();
    } catch {
      // Not fatal: anything left uncompiled is compiled by the first draw.
    }
    if (disposed) return;
    if (!scene.environment) buildEnvironment();
    built = true;
    dirty = true;
  };

  // A MessageChannel yields to the browser between slices without the 4 ms clamp
  // that nested setTimeout calls get.
  const buildChannel = new MessageChannel();
  buildChannel.port1.onmessage = () => {
    if (disposed) return;
    const sliceStart = performance.now();
    const done = bakes.run(
      () => performance.now() - sliceStart > BUILD_SLICE_MS,
    );
    if (!done) {
      buildChannel.port2.postMessage(null);
      return;
    }
    buildChannel.port1.close();
    void finishBuild();
  };
  buildChannel.port2.postMessage(null);

  // --- Start ----------------------------------------------------------------------

  applySize();
  rig.placeBeforeIntro(activeIndex, reducedMotion);

  const start = () => {
    if (running || disposed) return;
    running = true;
    lastTime = performance.now();
    frameHandle = requestAnimationFrame(frame);
  };
  start();

  return {
    focus(index) {
      if (disposed || works.length === 0) return;
      const next = clamp(Math.round(index) || 0, 0, works.length - 1);
      if (next === activeIndex) return;
      const previousWall = works[activeIndex].placement.wall;
      activeIndex = next;
      canvas.style.cursor = "";
      if (!readyFired) {
        rig.placeBeforeIntro(next, reducedMotion);
        return;
      }
      rig.walkTo(
        next,
        previousWall !== works[next].placement.wall,
        reducedMotion,
      );
      dirty = true;
    },
    setPointer(x, y) {
      rig.setPointer(x, y);
    },
    setScrollProgress(p) {
      rig.setScrollTarget(p);
    },
    resize(width, height) {
      if (disposed) return;
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      if (w === viewWidth && h === viewHeight) return;
      viewWidth = w;
      viewHeight = h;
      applySize();
      // Re-frame for the new shape without a walk.
      if (!readyFired) rig.placeBeforeIntro(activeIndex, reducedMotion);
      else rig.reframe(activeIndex);
    },
    setReducedMotion(reduced) {
      if (reduced === reducedMotion) return;
      reducedMotion = reduced;
      if (reduced) rig.settle();
      dirty = true;
    },
    pause() {
      running = false;
      cancelAnimationFrame(frameHandle);
    },
    resume() {
      dirty = true;
      start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(frameHandle);
      detachPicking();
      buildChannel.port1.close();
      bakes.clear();
      scene.environment = null;
      tracker.disposeAll();
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          (object.geometry as BufferGeometry).dispose();
          const materials: Material[] = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      scene.clear();
      // Leave the context as we found it: a later renderer on this same canvas (new
      // works, or a remount) must not inherit our unpack flags.
      renderer.resetState();
      const gl = renderer.getContext();
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      renderer.renderLists.dispose();
      renderer.dispose();
    },
  };
}
