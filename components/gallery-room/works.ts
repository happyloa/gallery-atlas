/**
 * The works on the walls: frame, primed linen, the picture itself, an invisible hit
 * target for picking, and a blank label card. Also loads the images and fades them in.
 */
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three";
import type { BakeOccluder } from "./bake";
import {
  createFrameGeometry,
  createFrameMaterial,
  FRAME_STYLES,
  lipHeight,
  REBATE,
} from "./frame";
import type { FrameStyle } from "./frame";
import type { BakeQueue, SceneKit } from "./kit";
import type { Placement } from "./layout";
import { PICTURE_IRRADIANCE } from "./lighting";
import { add3, clamp, hashId } from "./math";
import type { RoomShell } from "./shell";
import { PLAQUE_GAP, PLAQUE_HEIGHT } from "./shell";
import { quadGeometry } from "./surfaces";
import { createLinenTexture, LINEN_TILE } from "./textures";
import type { RoomArtwork } from "./types";

/** Brightest a picture's own white is shown (pictures are not tone mapped). */
const PICTURE_LEVEL = 0.94;
/** Works other than the one in focus are dimmed a little, to lead the eye. */
const INACTIVE_LEVEL = 0.74;

export interface Work {
  placement: Placement;
  hit: Mesh;
  linen: Mesh;
  linenMaterial: MeshBasicMaterial;
  picture: Mesh;
  pictureMaterial: MeshBasicMaterial;
  /** The image arrived. */
  loaded: boolean;
  /** The image arrived or failed. */
  settled: boolean;
  fade: number;
  level: number;
}

export function hangWorks(
  kit: SceneKit,
  bakes: BakeQueue,
  shell: RoomShell,
  artworks: readonly RoomArtwork[],
): Work[] {
  const { scene, layout, surfaces, track } = kit;
  const linen = track(createLinenTexture(kit.anisotropy));
  const hitMaterial = track(new MeshBasicMaterial({ visible: false }));
  const works: Work[] = [];
  let previousStyle: FrameStyle | null = null;

  layout.placements.forEach((p, index) => {
    const artwork = artworks[index];
    const group = new Object3D();
    group.position.set(...p.centre);
    group.quaternion.setFromRotationMatrix(
      new Matrix4().makeBasis(
        new Vector3(...p.tangent),
        new Vector3(0, 1, 0),
        new Vector3(...p.normal),
      ),
    );
    scene.add(group);

    // Frame: style follows the work's id, but never repeats its neighbour's.
    let style = FRAME_STYLES[hashId(artwork.id) % FRAME_STYLES.length];
    if (style === previousStyle) {
      style =
        FRAME_STYLES[(FRAME_STYLES.indexOf(style) + 1) % FRAME_STYLES.length];
    }
    previousStyle = style;
    group.add(
      new Mesh(
        track(
          createFrameGeometry(p.width, p.height, p.moulding, p.depth, style),
        ),
        track(createFrameMaterial(style)),
      ),
    );

    // The picture's own light: the same lamps, plus the shadow the frame's lip casts.
    const pictureZ = p.depth * REBATE;
    const pictureLight = track(
      bakes.lightmap(
        {
          origin: [
            p.centre[0] - p.tangent[0] * (p.width / 2) + p.normal[0] * pictureZ,
            p.centre[1] - p.height / 2,
            p.centre[2] - p.tangent[2] * (p.width / 2) + p.normal[2] * pictureZ,
          ],
          uDir: p.tangent,
          vDir: [0, 1, 0],
          normal: p.normal,
          uLength: p.width,
          vLength: p.height,
        },
        {
          density: clamp(72 / Math.max(p.width, p.height), 24, 160),
          occluders: frameLipShadows(p, lipHeight(style) * p.depth),
          neutral: true,
          gain: 1 / PICTURE_IRRADIANCE,
          flatten: 0.55,
          maxSize: 128,
        },
      ),
    );

    const plane = track(new PlaneGeometry(p.width, p.height));
    const linenMap = track(linen.clone());
    linenMap.repeat.set(p.width / LINEN_TILE, p.height / LINEN_TILE);
    const linenMaterial = track(
      new MeshBasicMaterial({
        map: linenMap,
        lightMap: pictureLight,
        lightMapIntensity: Math.PI * PICTURE_LEVEL,
        toneMapped: false,
      }),
    );
    const linenMesh = new Mesh(plane, linenMaterial);
    linenMesh.position.z = pictureZ;
    const pictureMaterial = track(
      new MeshBasicMaterial({
        // Stands in until the image arrives, so the shader for a loaded picture is
        // compiled with everything else instead of when the first image lands.
        map: linenMap,
        lightMap: pictureLight,
        lightMapIntensity: Math.PI * PICTURE_LEVEL,
        toneMapped: false,
        transparent: true,
        opacity: 0,
      }),
    );
    const picture = new Mesh(plane, pictureMaterial);
    picture.position.z = pictureZ + 0.0008;
    picture.visible = false;
    group.add(linenMesh, picture);

    const hit = new Mesh(
      track(new PlaneGeometry(p.outerWidth, p.outerHeight)),
      hitMaterial,
    );
    hit.position.z = p.depth;
    hit.userData.index = index;
    group.add(hit);

    // The label: a blank card beside the work. Its words are in the HTML overlay. It
    // borrows the wall's own lightmap, so it sits in the same falloff as the plaster
    // behind it.
    const wall = surfaces.wall(p.wall);
    const plaqueU = p.along + wall.uLength / 2 + p.outerWidth / 2 + PLAQUE_GAP;
    const plaque = new Mesh(
      track(
        quadGeometry(
          { ...wall, origin: add3(wall.origin, wall.normal, 0.005) },
          plaqueU - 0.075,
          plaqueU + 0.075,
          PLAQUE_HEIGHT - 0.05,
          PLAQUE_HEIGHT + 0.05,
          null,
        ),
      ),
      shell.plaqueMaterials[p.wall],
    );
    scene.add(plaque);

    works.push({
      placement: p,
      hit,
      linen: linenMesh,
      linenMaterial,
      picture,
      pictureMaterial,
      loaded: false,
      settled: false,
      fade: 0,
      level: 1,
    });
  });

  return works;
}

/** The four rails of the frame's lip, as occluders over the picture's own lightmap. */
function frameLipShadows(p: Placement, lip: number): BakeOccluder[] {
  const half = p.width / 2;
  return [
    {
      u: half,
      v: p.height + p.moulding / 2,
      halfU: half + p.moulding,
      halfV: p.moulding / 2,
      depth: lip,
    },
    {
      u: half,
      v: -p.moulding / 2,
      halfU: half + p.moulding,
      halfV: p.moulding / 2,
      depth: lip,
    },
    {
      u: -p.moulding / 2,
      v: p.height / 2,
      halfU: p.moulding / 2,
      halfV: p.height / 2,
      depth: lip,
    },
    {
      u: p.width + p.moulding / 2,
      v: p.height / 2,
      halfU: p.moulding / 2,
      halfV: p.height / 2,
      depth: lip,
    },
  ];
}

export interface TextureCallbacks {
  isDisposed(): boolean;
  onLoaded(): void;
  onError(id: number): void;
}

/** Loads every work's image. A failed image leaves the primed linen in the frame. */
export function loadWorkTextures(
  kit: SceneKit,
  works: Work[],
  artworks: readonly RoomArtwork[],
  callbacks: TextureCallbacks,
): void {
  const loader = new TextureLoader();
  loader.setCrossOrigin("anonymous");
  works.forEach((work, index) => {
    const artwork = artworks[index];
    loader.load(
      artwork.textureUrl,
      (texture) => {
        if (callbacks.isDisposed()) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = kit.anisotropy;
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        kit.track(texture);
        work.pictureMaterial.map = texture;
        work.picture.visible = true;
        work.loaded = true;
        work.settled = true;
        callbacks.onLoaded();
      },
      undefined,
      () => {
        if (callbacks.isDisposed()) return;
        // Leave the primed linen in the frame and say so. No stand-in picture.
        work.settled = true;
        callbacks.onError(artwork.id);
      },
    );
  });
}

/** Shows a loaded picture at once, without the fade (used when the room first appears). */
export function showImmediately(work: Work): void {
  work.fade = 1;
  work.pictureMaterial.opacity = 1;
  work.pictureMaterial.transparent = false;
  work.pictureMaterial.needsUpdate = true;
  work.linen.visible = false;
}

/**
 * Advances picture fade-ins and focus dimming. `scroll` (0..1) dims every work as the
 * hero leaves the screen. Returns true when anything changed and needs drawing.
 */
export function updateWorks(
  works: Work[],
  dt: number,
  activeIndex: number,
  motion: boolean,
  scroll: number,
): boolean {
  let changed = false;
  works.forEach((work, index) => {
    if (work.loaded && work.fade < 1) {
      work.fade = motion ? Math.min(1, work.fade + dt / 0.9) : 1;
      work.pictureMaterial.opacity = work.fade;
      if (work.fade >= 1) showImmediately(work);
      changed = true;
    }
    const targetLevel = index === activeIndex ? 1 : INACTIVE_LEVEL;
    if (Math.abs(work.level - targetLevel) > 1e-3) {
      work.level = motion
        ? work.level + (targetLevel - work.level) * (1 - Math.exp(-dt * 3))
        : targetLevel;
      changed = true;
    }
    const intensity = Math.PI * PICTURE_LEVEL * work.level * (1 - 0.4 * scroll);
    work.pictureMaterial.lightMapIntensity = intensity;
    work.linenMaterial.lightMapIntensity = intensity;
  });
  return changed;
}

