import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/World';
import { Noise } from '../terrain/Noise';
import type { ProceduralTextures } from '../terrain/ProceduralTextures';
import { Rng } from '../core/Random';

/**
 * Irregular rocks with convex-hull colliders. A handful of noise-displaced
 * variants are instanced; each placement scales a variant and builds a hull
 * from the scaled vertices so the physics shape matches what you see.
 */
export class RockField {
  readonly group = new THREE.Group();
  private variants: { geo: THREE.BufferGeometry; pts: Float32Array }[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private counts: number[] = [];
  private colors: Float32Array[] = [];
  private rng = new Rng(9001);
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private s = new THREE.Vector3(); private p = new THREE.Vector3();

  constructor(private physics: PhysicsWorld, material: THREE.Material, capacityPerVariant = 400) {
    const noise = new Noise(321);
    const specs = [
      { detail: 2, amp: 0.3, freq: 1.4, flat: 0.8 },
      { detail: 2, amp: 0.4, freq: 2.2, flat: 0.7 },
      { detail: 1, amp: 0.25, freq: 1.0, flat: 0.9 },
      { detail: 2, amp: 0.35, freq: 1.8, flat: 0.55 },
      { detail: 1, amp: 0.2, freq: 2.6, flat: 0.35 }, // slab
    ];
    specs.forEach((sp, vi) => {
      const geo = new THREE.IcosahedronGeometry(1, sp.detail);
      const pos = geo.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = noise.fbm(v.x * sp.freq + vi * 7, v.y * sp.freq + v.z * sp.freq * 0.7 + vi * 3, 3);
        v.multiplyScalar(1 + sp.amp * n);
        v.y *= sp.flat;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      // Unique points for the hull (icosahedron geometry is non-indexed → many duplicates).
      const seen = new Set<string>(); const pts: number[] = [];
      for (let i = 0; i < pos.count; i++) { const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`; if (!seen.has(key)) { seen.add(key); pts.push(pos.getX(i), pos.getY(i), pos.getZ(i)); } }
      this.variants.push({ geo, pts: new Float32Array(pts) });
      const mesh = new THREE.InstancedMesh(geo, material, capacityPerVariant);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.count = 0;
      this.meshes.push(mesh); this.counts.push(0);
      this.colors.push(new Float32Array(capacityPerVariant * 3));
      this.group.add(mesh);
    });
  }

  /**
   * Place a rock. `size` is the nominal radius; `stretch` scales x/z vs y;
   * `bury` is the fraction of the height sunk into the ground.
   */
  add(x: number, groundY: number, z: number, size: number, opts: { yaw?: number; tilt?: number; variant?: number; sx?: number; sz?: number; sy?: number; bury?: number; collider?: boolean; tint?: number } = {}): void {
    const vi = opts.variant ?? this.rng.int(0, this.variants.length - 2);
    const { geo, pts } = this.variants[vi];
    const sx = size * (opts.sx ?? this.rng.range(0.85, 1.3)), sz = size * (opts.sz ?? this.rng.range(0.85, 1.3)), sy = size * (opts.sy ?? this.rng.range(0.7, 1.0));
    const bury = opts.bury ?? 0.3;
    const y = groundY + sy * (1 - 2 * bury) * 0.5 + sy * 0.15;
    this.q.setFromEuler(new THREE.Euler(opts.tilt ?? this.rng.range(-0.25, 0.25), opts.yaw ?? this.rng.range(0, Math.PI * 2), (opts.tilt ?? 0) * 0.5));
    this.s.set(sx, sy, sz); this.p.set(x, y, z);
    this.m.compose(this.p, this.q, this.s);
    const mesh = this.meshes[vi];
    const idx = this.counts[vi]++;
    if (idx >= mesh.count) mesh.count = idx + 1;
    if (idx >= (mesh.instanceMatrix.count)) return; // capacity exhausted
    mesh.setMatrixAt(idx, this.m);
    const t = opts.tint ?? this.rng.range(0.8, 1.15);
    const c = this.colors[vi]; c[idx * 3] = t; c[idx * 3 + 1] = t * this.rng.range(0.95, 1.02); c[idx * 3 + 2] = t * this.rng.range(0.9, 1.0);
    if (opts.collider !== false && size > 0.18) {
      const scaled = new Float32Array(pts.length);
      for (let i = 0; i < pts.length; i += 3) { scaled[i] = pts[i] * sx; scaled[i + 1] = pts[i + 1] * sy; scaled[i + 2] = pts[i + 2] * sz; }
      const desc = this.physics.R.ColliderDesc.convexHull(scaled);
      if (desc) this.physics.world.createCollider(desc.setTranslation(x, y, z).setRotation({ x: this.q.x, y: this.q.y, z: this.q.z, w: this.q.w }).setFriction(1.05));
    }
    void geo;
  }

  /** Call once after placing everything. */
  finalize(): void {
    this.meshes.forEach((mesh, vi) => {
      mesh.count = Math.min(this.counts[vi], mesh.instanceMatrix.count);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colors[vi].slice(0, mesh.instanceMatrix.count * 3), 3);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }

  get total(): number { return this.counts.reduce((a, b) => a + b, 0); }
}

/** Triplanar rock material: world-space projection so instanced rocks of any shape look consistent. */
export function createRockMaterial(tex: ProceduralTextures): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xcdbb9e, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tRockA = { value: tex.rock.albedo };
    shader.uniforms.tRockN = { value: tex.rock.normal };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vWp; varying vec3 vWn;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n #ifdef USE_INSTANCING\n vWn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);\n #else\n vWn = normalize(mat3(modelMatrix) * objectNormal);\n #endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n uniform sampler2D tRockA, tRockN; varying vec3 vWp; varying vec3 vWn;\n vec3 triW; vec2 uvX, uvY, uvZ;')
      .replace('#include <map_fragment>', `
        triW = pow(abs(vWn), vec3(3.0)); triW /= (triW.x + triW.y + triW.z);
        float sc = 0.45;
        uvX = vWp.zy * sc; uvY = vWp.xz * sc; uvZ = vWp.xy * sc;
        vec3 a = texture2D(tRockA, uvX).rgb * triW.x + texture2D(tRockA, uvY).rgb * triW.y + texture2D(tRockA, uvZ).rgb * triW.z;
        diffuseColor.rgb *= a * 1.15;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 nX = texture2D(tRockN, uvX).xyz * 2.0 - 1.0;
          vec3 nY = texture2D(tRockN, uvY).xyz * 2.0 - 1.0;
          vec3 nZ = texture2D(tRockN, uvZ).xyz * 2.0 - 1.0;
          vec3 bump = vec3(nY.x + nZ.x, nX.x + nZ.y, nX.y + nY.y) * 0.5;
          vec3 nW = normalize(vWn + bump * 0.8);
          normal = normalize(mat3(viewMatrix) * nW);
        }`);
  };
  mat.customProgramCacheKey = () => 'rock-triplanar-v1';
  return mat;
}
