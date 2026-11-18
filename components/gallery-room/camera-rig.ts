/**
 * The visitor's eye: where to stand for each work, the walk between works, and the small
 * movements layered on top (pointer look-around, idle breathing, scroll response).
 */
import { Euler, PerspectiveCamera, Quaternion, Vector2, Vector3 } from "three";
import { EYE_HEIGHT } from "./layout";
import type { RoomLayout } from "./layout";
import { clamp, DEG, easeInOut, easeOut } from "./math";

const LANDSCAPE_FOV = 48;
const MIN_HORIZONTAL_HALF_FOV = 17 * DEG;
const MAX_FOV = 68;
const MIN_VIEW_DISTANCE = 3;
const WALK_SECONDS = 1.2;
const INTRO_SECONDS = 2.6;

interface Pose {
  position: Vector3;
  quaternion: Quaternion;
}

const newPose = (): Pose => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
});

export interface CameraRig {
  readonly camera: PerspectiveCamera;
  /** Smoothed scroll progress, 0..1. */
  readonly scroll: number;
  /** Canvas size in CSS pixels: sets aspect and field of view. */
  setViewSize(width: number, height: number): void;
  /** Before the room is shown: wait a few steps back from `index`, ready for the walk in. */
  placeBeforeIntro(index: number, reducedMotion: boolean): void;
  /** The opening walk in front of `index`. */
  walkIn(index: number, reducedMotion: boolean): void;
  /** Walk to `index`. Turning a corner takes a little longer. */
  walkTo(index: number, turnsCorner: boolean, reducedMotion: boolean): void;
  /** Re-frame `index` for a new canvas shape without walking. */
  reframe(index: number): void;
  /** Finish any walk at once (reduced motion switched on mid-walk). */
  settle(): void;
  setPointer(x: number, y: number): void;
  setScrollTarget(p: number): void;
  /** Advances the rig. Returns true when the camera moved and the frame needs drawing. */
  update(dt: number, motion: boolean): boolean;
}

export function createCameraRig(layout: RoomLayout): CameraRig {
  const camera = new PerspectiveCamera(LANDSCAPE_FOV, 1, 0.1, 60);
  camera.rotation.order = "YXZ";
  const { width: roomWidth, depth: roomDepth } = layout;

  let viewWidth = 1;
  let viewHeight = 1;
  let elapsed = 0;

  const base = newPose();
  const from = newPose();
  const to = newPose();
  let transition = 1;
  let transitionSeconds = WALK_SECONDS;
  let transitionEase = easeInOut;
  let transitionDip = 0;

  const pointerTarget = new Vector2();
  const pointer = new Vector2();
  let scrollTarget = 0;
  let scroll = 0;

  const euler = new Euler(0, 0, 0, "YXZ");
  const offsetQuaternion = new Quaternion();
  const right = new Vector3();
  const forward = new Vector3();

  const poseFor = (index: number, out: Pose, pullBack = 0): Pose => {
    const p = layout.placements[index];
    if (!p) {
      out.position.set(0, EYE_HEIGHT, roomDepth / 2 - 1.2);
      out.quaternion.identity();
      return out;
    }
    // Framing is worked out for a sane screen shape even if the canvas is momentarily
    // a sliver (a collapsed container, a mid-layout measurement).
    const aspect = clamp(viewWidth / viewHeight, 0.4, 3);
    const tanV = Math.tan((camera.fov * DEG) / 2);
    const tanH = tanV * aspect;
    const portrait = aspect < 1;
    // How much of the view the framed work may fill, and where it sits. On wide
    // screens the work is held right of centre: the headline sits bottom-left.
    const fillV = portrait ? 0.42 : 0.56;
    const fillH = portrait ? 0.84 : 0.46;
    const shiftX = portrait ? 0 : 0.2;
    const shiftY = portrait ? 0.3 : 0.2;
    // Stand a little to the right of the work and look back along the wall: the work
    // stays near, and the left of the frame opens onto the rest of the room.
    const oblique = (portrait ? 4 : 16) * DEG;

    const across = p.wall === "back" ? roomDepth : roomWidth;
    const distance = clamp(
      Math.max(
        p.outerHeight / (2 * tanV * fillV),
        p.outerWidth / (2 * tanH * fillH),
      ) + pullBack,
      MIN_VIEW_DISTANCE,
      across - 1.1,
    );
    const marginX = roomWidth / 2 - 0.8;
    const marginZ = roomDepth / 2 - 0.8;
    out.position.set(
      clamp(
        p.centre[0] +
          p.normal[0] * distance * Math.cos(oblique) +
          p.tangent[0] * distance * Math.sin(oblique),
        -marginX,
        marginX,
      ),
      EYE_HEIGHT,
      clamp(
        p.centre[2] +
          p.normal[2] * distance * Math.cos(oblique) +
          p.tangent[2] * distance * Math.sin(oblique),
        -marginZ,
        marginZ,
      ),
    );
    const dx = p.centre[0] - out.position.x;
    const dy = p.centre[1] - out.position.y;
    const dz = p.centre[2] - out.position.z;
    const yaw = Math.atan2(-dx, -dz) + Math.atan(shiftX * tanH);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz)) - Math.atan(shiftY * tanV);
    out.quaternion.setFromEuler(euler.set(pitch, yaw, 0, "YXZ"));
    return out;
  };

  const jumpToTarget = () => {
    base.position.copy(to.position);
    base.quaternion.copy(to.quaternion);
    transition = 1;
  };

  const startTransition = (
    seconds: number,
    ease: (t: number) => number,
    dip: number,
    reducedMotion: boolean,
  ) => {
    from.position.copy(base.position);
    from.quaternion.copy(base.quaternion);
    if (reducedMotion || seconds <= 0) {
      jumpToTarget();
    } else {
      transition = 0;
      transitionSeconds = seconds;
      transitionEase = ease;
      transitionDip = dip;
    }
  };

  return {
    camera,
    get scroll() {
      return scroll;
    },
    setViewSize(width, height) {
      viewWidth = width;
      viewHeight = height;
      const aspect = width / height;
      camera.aspect = aspect;
      // Hold the vertical field of view on wide screens; on tall ones open it up so
      // the horizontal view never gets narrower than a short telephoto.
      const landscapeTan = Math.tan((LANDSCAPE_FOV * DEG) / 2);
      const neededTan = Math.tan(MIN_HORIZONTAL_HALF_FOV) / aspect;
      camera.fov = Math.min(
        MAX_FOV,
        (2 * Math.atan(Math.max(landscapeTan, neededTan))) / DEG,
      );
      camera.updateProjectionMatrix();
    },
    placeBeforeIntro(index, reducedMotion) {
      poseFor(index, to, reducedMotion ? 0 : 1.3);
      base.position.copy(to.position);
      base.quaternion.copy(to.quaternion);
      if (!reducedMotion) base.position.y -= 0.03;
      poseFor(index, to);
      transition = 1;
    },
    walkIn(index, reducedMotion) {
      poseFor(index, to);
      startTransition(INTRO_SECONDS, easeOut, 0, reducedMotion);
    },
    walkTo(index, turnsCorner, reducedMotion) {
      poseFor(index, to);
      // ~1.2 s between neighbours; a little longer to cross the room or turn a corner.
      const travel = base.position.distanceTo(to.position);
      const turn = turnsCorner ? 0.25 : 0;
      startTransition(
        clamp(WALK_SECONDS + (travel - 3) * 0.07 + turn, WALK_SECONDS, 1.9),
        easeInOut,
        0.022,
        reducedMotion,
      );
    },
    reframe(index) {
      poseFor(index, to);
      if (transition >= 1) {
        base.position.copy(to.position);
        base.quaternion.copy(to.quaternion);
      }
    },
    settle() {
      if (transition < 1) jumpToTarget();
    },
    setPointer(x, y) {
      pointerTarget.set(clamp(x, -1, 1), clamp(y, -1, 1));
    },
    setScrollTarget(p) {
      scrollTarget = clamp(p, 0, 1);
    },
    update(dt, motion) {
      let moved = false;
      elapsed += dt;

      if (transition < 1) {
        transition = Math.min(1, transition + dt / transitionSeconds);
        const e = transitionEase(transition);
        base.position.lerpVectors(from.position, to.position, e);
        base.quaternion.slerpQuaternions(from.quaternion, to.quaternion, e);
        // A slight sink mid-stride reads as a step rather than a dolly.
        base.position.y -= Math.sin(Math.PI * e) * transitionDip;
        moved = true;
      }

      const follow = 1 - Math.exp(-dt * 3.2);
      if (motion) {
        if (pointer.distanceToSquared(pointerTarget) > 1e-7) {
          pointer.lerp(pointerTarget, follow);
          moved = true;
        }
      } else if (pointer.lengthSq() > 0) {
        pointer.set(0, 0);
        moved = true;
      }
      if (Math.abs(scroll - scrollTarget) > 1e-4) {
        scroll += (scrollTarget - scroll) * (1 - Math.exp(-dt * 9));
        moved = true;
      }

      // Compose the camera: base pose, then look-around, breathing and scroll.
      const idle = motion ? 1 : 0;
      const yaw =
        -pointer.x * 2.6 * DEG + idle * Math.sin(elapsed * 0.31) * 0.2 * DEG;
      const pitch =
        pointer.y * 1.5 * DEG +
        idle * Math.sin(elapsed * 0.23 + 1.3) * 0.12 * DEG +
        (motion ? scroll * 2.5 * DEG : 0);
      camera.position.copy(base.position);
      camera.quaternion.copy(base.quaternion);
      offsetQuaternion.setFromEuler(euler.set(pitch, yaw, 0, "YXZ"));
      camera.quaternion.multiply(offsetQuaternion);
      right.set(1, 0, 0).applyQuaternion(base.quaternion);
      forward.set(0, 0, -1).applyQuaternion(base.quaternion);
      camera.position.addScaledVector(
        right,
        pointer.x * 0.12 + idle * Math.sin(elapsed * 0.27) * 0.018,
      );
      camera.position.y +=
        pointer.y * 0.04 + idle * Math.sin(elapsed * 0.9) * 0.004;
      if (motion) camera.position.addScaledVector(forward, -scroll * 0.7);
      camera.position.x = clamp(
        camera.position.x,
        -roomWidth / 2 + 0.45,
        roomWidth / 2 - 0.45,
      );
      camera.position.z = clamp(
        camera.position.z,
        -roomDepth / 2 + 0.45,
        roomDepth / 2 - 0.45,
      );
      camera.updateMatrixWorld();
      return moved;
    },
  };
}
