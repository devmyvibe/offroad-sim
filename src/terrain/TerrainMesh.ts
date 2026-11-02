import * as THREE from 'three';
import type { Heightmap } from './Heightmap';
import type { PhysicsWorld } from '../physics/World';

/** Builds the render mesh for a heightmap at `segments` subdivisions per side. */
export function buildTerrainGeometry(hm: Heightmap, segments: number): THREE.BufferGeometry {
  const n1 = segments + 1;
  const pos = new Float32Array(n1 * n1 * 3);
  const nor = new Float32Array(n1 * n1 * 3);
  const sand = new Float32Array(n1 * n1);
  const uv = new Float32Array(n1 * n1 * 2);
  const step = hm.size / segments;
  const half = hm.size / 2;
  const nrm = { x: 0, y: 1, z: 0 };
  let k = 0;
  for (let i = 0; i < n1; i++) {
    const z = i * step - half;
    for (let j = 0; j < n1; j++, k++) {
      const x = j * step - half;
      pos[k * 3] = x; pos[k * 3 + 1] = hm.sample(x, z); pos[k * 3 + 2] = z;
      hm.normal(x, z, nrm);
      nor[k * 3] = nrm.x; nor[k * 3 + 1] = nrm.y; nor[k * 3 + 2] = nrm.z;
      sand[k] = hm.sampleSand(x, z);
      uv[k * 2] = j / segments; uv[k * 2 + 1] = i / segments;
    }
  }
  const idx = new Uint32Array(segments * segments * 6);
  let q = 0;
  for (let i = 0; i < segments; i++) for (let j = 0; j < segments; j++) {
    const a = i * n1 + j, b = a + 1, c = a + n1, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b;
    idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aSand', new THREE.BufferAttribute(sand, 1));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Rapier heightfield collider from the same samples the mesh uses.
 * Rapier stores the matrix column-major with rows along z and columns along x.
 */
export function createTerrainCollider(physics: PhysicsWorld, hm: Heightmap): void {
  const { R, world } = physics;
  const n1 = hm.n + 1;
  const heights = new Float32Array(n1 * n1);
  for (let i = 0; i < n1; i++) for (let j = 0; j < n1; j++) heights[j * n1 + i] = hm.heights[hm.idx(i, j)];
  const desc = R.ColliderDesc.heightfield(hm.n, hm.n, heights, { x: hm.size, y: 1, z: hm.size })
    .setFriction(1.0)
    .setRestitution(0.0);
  world.createCollider(desc);
}
