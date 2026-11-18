/**
 * The floor: baked light on oak boards, plus a soft planar reflection of the room.
 * The reflection is what stops the scene reading as a set of flat cards: the lit works
 * and their pools of light carry down into the polish.
 *
 * It is the scene drawn a second time from a camera mirrored below the floor, at half
 * the resolution, then blurred and weighted by Fresnel in the shader. The room is all
 * baked, unlit materials, so the second pass costs very little.
 */
import {
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  PerspectiveCamera,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { Scene, Texture, WebGLRenderer } from "three";
import { FLOOR_TILE } from "./textures";

const vertexShader = /* glsl */ `
  uniform mat4 uTextureMatrix;
  uniform float uTileSize;
  varying vec2 vLightUv;
  varying vec2 vTileUv;
  varying vec3 vWorldPosition;
  varying vec4 vReflectCoord;
  #include <common>
  #include <fog_pars_vertex>

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vLightUv = uv;
    vTileUv = worldPosition.xz / uTileSize;
    vReflectCoord = uTextureMatrix * worldPosition;
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAlbedo;
  uniform sampler2D uLightMap;
  uniform sampler2D uReflection;
  uniform float uReflectivity;
  uniform float uLightScale;
  varying vec2 vLightUv;
  varying vec2 vTileUv;
  varying vec3 vWorldPosition;
  varying vec4 vReflectCoord;
  #include <common>
  #include <fog_pars_fragment>

  void main() {
    vec3 albedo = texture2D(uAlbedo, vTileUv).rgb;
    vec3 irradiance = texture2D(uLightMap, vLightUv).rgb * uLightScale;
    vec3 color = albedo * irradiance * RECIPROCAL_PI;

    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float cosTheta = clamp(viewDir.y, 0.0, 1.0);
    // Oiled wood: about 4% reflective head-on, rising steeply at a glancing angle.
    float fresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 5.0);

    // Each board is a slightly different mirror: tilt the lookup by the board's tone
    // and let lighter (more worn) boards reflect a little less.
    float tone = dot(albedo, vec3(0.3333));
    vec2 uv = vReflectCoord.xy / vReflectCoord.w;
    uv += (tone - 0.03) * vec2(0.035, 0.11);

    // Wide, mostly vertical blur: polished boards smear reflections toward the viewer.
    vec3 reflection = texture2D(uReflection, uv, 3.0).rgb * 0.2;
    reflection += texture2D(uReflection, uv + vec2(0.011, 0.024), 3.6).rgb * 0.1;
    reflection += texture2D(uReflection, uv + vec2(-0.011, 0.024), 3.6).rgb * 0.1;
    reflection += texture2D(uReflection, uv + vec2(0.011, -0.024), 3.6).rgb * 0.1;
    reflection += texture2D(uReflection, uv + vec2(-0.011, -0.024), 3.6).rgb * 0.1;
    reflection += texture2D(uReflection, uv + vec2(0.024, 0.0), 4.0).rgb * 0.08;
    reflection += texture2D(uReflection, uv - vec2(0.024, 0.0), 4.0).rgb * 0.08;
    reflection += texture2D(uReflection, uv + vec2(0.0, 0.056), 4.6).rgb * 0.12;
    reflection += texture2D(uReflection, uv - vec2(0.0, 0.056), 4.6).rgb * 0.12;

    float polish = clamp(1.15 - tone * 6.0, 0.55, 1.0);
    color += reflection * fresnel * polish * uReflectivity;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export interface ReflectiveFloor {
  material: ShaderMaterial;
  /** Starts compiling the shader variants the mirrored pass uses (linear, untonemapped). */
  compile(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
  ): void;
  /** Draws the mirrored view. Call before the main render, with the floor hidden. */
  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
  ): void;
  setSize(width: number, height: number): void;
  setLightScale(scale: number): void;
  dispose(): void;
}

export function createReflectiveFloor(
  renderer: WebGLRenderer,
  albedo: Texture,
  lightMap: Texture,
): ReflectiveFloor {
  const floatTarget =
    renderer.extensions.has("EXT_color_buffer_float") ||
    renderer.extensions.has("EXT_color_buffer_half_float");
  const target = new WebGLRenderTarget(256, 256, {
    type: floatTarget ? HalfFloatType : UnsignedByteType,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });

  const textureMatrix = new Matrix4();
  const uniforms = UniformsUtils.merge([
    UniformsLib.fog,
    {
      uTextureMatrix: { value: null },
      uTileSize: { value: FLOOR_TILE },
      uAlbedo: { value: null },
      uLightMap: { value: null },
      uReflection: { value: null },
      uReflectivity: { value: 0.75 },
      uLightScale: { value: 1 },
    },
  ]);
  uniforms.uTextureMatrix.value = textureMatrix;
  uniforms.uAlbedo.value = albedo;
  uniforms.uLightMap.value = lightMap;
  uniforms.uReflection.value = target.texture;

  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    fog: true,
  });

  const mirrorCamera = new PerspectiveCamera();
  const rotation = new Matrix4();
  const cameraPosition = new Vector3();
  const lookAt = new Vector3();
  const up = new Vector3();

  return {
    material,
    compile(renderer, scene, camera) {
      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.compile(scene, camera);
      renderer.setRenderTarget(previousTarget);
    },
    render(renderer, scene, camera) {
      // Mirror the camera in the plane y = 0.
      cameraPosition.setFromMatrixPosition(camera.matrixWorld);
      rotation.extractRotation(camera.matrixWorld);
      lookAt.set(0, 0, -1).applyMatrix4(rotation).add(cameraPosition);
      lookAt.y = -lookAt.y;
      up.set(0, 1, 0).applyMatrix4(rotation);
      up.y = -up.y;

      mirrorCamera.position.set(
        cameraPosition.x,
        -cameraPosition.y,
        cameraPosition.z,
      );
      mirrorCamera.up.copy(up);
      mirrorCamera.lookAt(lookAt);
      mirrorCamera.near = camera.near;
      mirrorCamera.far = camera.far;
      mirrorCamera.updateMatrixWorld();
      mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
      mirrorCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

      // World position → mirror camera clip space → 0..1 texture coordinates.
      textureMatrix.set(
        0.5,
        0,
        0,
        0.5,
        0,
        0.5,
        0,
        0.5,
        0,
        0,
        0.5,
        0.5,
        0,
        0,
        0,
        1,
      );
      textureMatrix.multiply(mirrorCamera.projectionMatrix);
      textureMatrix.multiply(mirrorCamera.matrixWorldInverse);

      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, mirrorCamera);
      renderer.setRenderTarget(previousTarget);
    },
    setSize(width, height) {
      target.setSize(
        Math.max(2, Math.round(width)),
        Math.max(2, Math.round(height)),
      );
    },
    setLightScale(scale) {
      uniforms.uLightScale.value = scale;
    },
    dispose() {
      target.dispose();
      material.dispose();
    },
  };
}
