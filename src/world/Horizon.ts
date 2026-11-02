import * as THREE from 'three';
import { Noise } from '../terrain/Noise';

/**
 * Distant mountain ring beyond the playable map. Cheap silhouettes that the
 * fog turns into layered haze, so the horizon is never a flat line.
 */
export function buildHorizon(mapSize: number): THREE.Mesh {
  const noise = new Noise(2024);
  const inner = mapSize * 0.72, outer = mapSize * 1.9;
  const radial = 10, around = 220;
  const pos: number[] = [], idx: number[] = [];
  for (let r = 0; r <= radial; r++) {
    const f = r / radial;
    const radius = inner + (outer - inner) * f;
    for (let a = 0; a <= around; a++) {
      const ang = (a / around) * Math.PI * 2;
      const x = Math.cos(ang) * radius, z = Math.sin(ang) * radius;
      // Height grows with distance, with ridges and peaks; zero at the inner edge so it meets the map.
      const ridge = noise.ridged(Math.cos(ang) * 3.2 + f * 2.1, Math.sin(ang) * 3.2 + 1.3, 4);
      const broad = noise.fbm(Math.cos(ang) * 1.3, Math.sin(ang) * 1.3 + f, 2) * 0.5 + 0.5;
      const rise = Math.pow(Math.min(1, f * 1.6), 1.4);
      const h = rise * (40 + 260 * ridge * (0.5 + 0.5 * broad)) - (f < 0.15 ? 0 : 0) - 12;
      pos.push(x, h, z);
    }
  }
  for (let r = 0; r < radial; r++) for (let a = 0; a < around; a++) {
    const i0 = r * (around + 1) + a, i1 = i0 + 1, i2 = i0 + around + 1, i3 = i2 + 1;
    idx.push(i0, i2, i1, i1, i2, i3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = false; mesh.castShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}
