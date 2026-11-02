import * as THREE from 'three';
import type { ProceduralTextures } from './ProceduralTextures';

/**
 * MeshStandardMaterial with a slope + sandiness splat (sand / gravel / rock),
 * two-scale sampling to hide tiling, and a detail normal derived from the
 * blended normal maps. World-space UVs so chunks share one material.
 */
export function createTerrainMaterial(tex: ProceduralTextures): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  const uniforms = {
    tSandA: { value: tex.sand.albedo }, tSandN: { value: tex.sand.normal },
    tRockA: { value: tex.rock.albedo }, tRockN: { value: tex.rock.normal },
    tGravelA: { value: tex.gravel.albedo }, tGravelN: { value: tex.gravel.normal },
    tMacro: { value: tex.macro },
    uTexScale: { value: 1 / 3.0 },   // one tile every 3 m
    uNormalStrength: { value: 0.9 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSand;
        varying float vSand;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vSand = aSand;
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tSandA, tSandN, tRockA, tRockN, tGravelA, tGravelN, tMacro;
        uniform float uTexScale, uNormalStrength;
        varying float vSand;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        float gSandW, gRockW, gGravelW; vec2 gUv1, gUv2; float gMacro;`)
      .replace('#include <map_fragment>', `
        gUv1 = vWorldPos.xz * uTexScale;
        gUv2 = vWorldPos.xz * uTexScale * 0.27 + vec2(0.37, 0.11);
        gMacro = texture2D(tMacro, vWorldPos.xz * 0.0035).r;
        float slope = 1.0 - clamp(vWorldNormal.y, 0.0, 1.0);
        gRockW = smoothstep(0.22, 0.5, slope + 0.14 * (gMacro - 0.5));
        gSandW = (1.0 - gRockW) * smoothstep(0.2, 0.8, vSand + 0.2 * (gMacro - 0.5));
        gGravelW = 1.0 - gRockW - gSandW;
        vec3 sandC = mix(texture2D(tSandA, gUv1).rgb, texture2D(tSandA, gUv2).rgb, 0.45);
        vec3 rockC = mix(texture2D(tRockA, gUv1).rgb, texture2D(tRockA, gUv2).rgb, 0.5);
        vec3 gravelC = mix(texture2D(tGravelA, gUv1).rgb, texture2D(tGravelA, gUv2).rgb, 0.45);
        vec3 albedo = sandC * gSandW + rockC * gRockW + gravelC * gGravelW;
        albedo *= 0.82 + 0.36 * gMacro;
        diffuseColor.rgb *= albedo;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.97, 0.78, gRockW);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 nS = texture2D(tSandN, gUv1).xyz * 2.0 - 1.0;
          vec3 nR = texture2D(tRockN, gUv1).xyz * 2.0 - 1.0;
          vec3 nG = texture2D(tGravelN, gUv1).xyz * 2.0 - 1.0;
          vec3 nT = normalize(nS * gSandW + nR * gRockW + nG * gGravelW);
          // Terrain is mostly up-facing: treat texture x/y as world x/z tangents.
          vec3 nW = normalize(vWorldNormal + vec3(nT.x, 0.0, nT.y) * uNormalStrength);
          normal = normalize(mat3(viewMatrix) * nW);
        }`);
  };
  mat.customProgramCacheKey = () => 'terrain-splat-v1';
  (mat as THREE.MeshStandardMaterial & { splatUniforms: typeof uniforms }).splatUniforms = uniforms;
  return mat;
}
