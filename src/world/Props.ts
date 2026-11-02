import * as THREE from 'three';
import type { Heightmap, Polyline } from '../terrain/Heightmap';
import type { PhysicsWorld } from '../physics/World';
import { Rng } from '../core/Random';
import { Noise, smoothstep } from '../terrain/Noise';

/**
 * Scattered rocks and desert shrubs (instanced). Rocks prefer rocky ground and
 * the massif, shrubs prefer sandy lows; nothing spawns on the trails or hub.
 * Larger rocks get sphere colliders so they are real obstacles.
 */
export function buildProps(physics: PhysicsWorld, hm: Heightmap, paths: Map<string, Polyline>, rockMat: THREE.Material, density: number): THREE.Group {
  const group = new THREE.Group();
  const rng = new Rng(4242);
  const noise = new Noise(55);
  const half = hm.size / 2 - 20;
  const trailList = Array.from(paths.entries());
  const rockTrail = paths.get('rocksteps');

  const nearTrail = (x: number, z: number): { d: number; rocky: boolean } => {
    let best = Infinity, rocky = false;
    for (const [id, p] of trailList) {
      // Cheap reject using bounds before the exact search.
      const b = p.bounds(30);
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      const n = p.nearest(x, z);
      if (n.d < best) { best = n.d; rocky = id === 'rocksteps'; }
    }
    return { d: best, rocky };
  };

  // --- Rocks ---
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  {
    const pos = rockGeo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); v.multiplyScalar(0.8 + 0.35 * noise.n2(v.x * 1.7 + 3, v.y * 1.7 + v.z)); pos.setXYZ(i, v.x, v.y * 0.7, v.z); }
    rockGeo.computeVertexNormals();
  }
  const rockCount = Math.floor(2600 * density);
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocks.castShadow = true; rocks.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0, tries = 0;
  while (n < rockCount && tries < rockCount * 12) {
    tries++;
    const x = rng.range(-half, half), z = rng.range(-half, half);
    if (Math.hypot(x, z) < 70) continue;
    const sand = hm.sampleSand(x, z);
    const nt = nearTrail(x, z);
    // Rocky ground and the rock trail's shoulders get far more rocks.
    let chance = 0.12 + 0.6 * (1 - sand);
    if (nt.rocky && nt.d > 5 && nt.d < 16) chance = 0.95;
    if (nt.d < 6) continue;
    if (rng.float() > chance) continue;
    const size = nt.rocky ? rng.range(0.35, 1.3) : rng.range(0.25, 1.1) * (sand > 0.6 ? 0.6 : 1);
    const y = hm.sample(x, z) - size * 0.3;
    q.setFromEuler(new THREE.Euler(rng.range(0, 0.5), rng.range(0, Math.PI * 2), rng.range(0, 0.4)));
    s.set(size * rng.range(0.8, 1.4), size * rng.range(0.6, 1.0), size * rng.range(0.8, 1.4));
    p.set(x, y, z);
    m.compose(p, q, s); rocks.setMatrixAt(n++, m);
    if (size > 0.7) physics.world.createCollider(physics.R.ColliderDesc.ball(size * 0.75).setTranslation(x, y, z).setFriction(1.0));
  }
  rocks.count = n;
  group.add(rocks);

  // --- Shrubs ---
  const shrubGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const pos = shrubGeo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); v.multiplyScalar(0.75 + 0.5 * rng.float()); pos.setXYZ(i, v.x, Math.max(0, v.y) * 0.75, v.z); }
    shrubGeo.computeVertexNormals();
  }
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x6f7a4a, roughness: 1, flatShading: true });
  const shrubCount = Math.floor(1800 * density);
  const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCount);
  shrubs.castShadow = true; shrubs.receiveShadow = true;
  n = 0; tries = 0;
  const colorAttr = new Float32Array(shrubCount * 3);
  while (n < shrubCount && tries < shrubCount * 12) {
    tries++;
    const x = rng.range(-half, half), z = rng.range(-half, half);
    if (Math.hypot(x, z) < 70) continue;
    const sand = hm.sampleSand(x, z);
    const slope = 1 - hm.normal(x, z).y;
    const clump = noise.fbm(x / 120, z / 120, 2) * 0.5 + 0.5; // vegetation patches
    const chance = 0.1 + 0.6 * smoothstep(0.3, 0.9, sand) * (1 - smoothstep(0.08, 0.25, slope)) * clump;
    if (rng.float() > chance) continue;
    if (nearTrail(x, z).d < 5) continue;
    const size = rng.range(0.5, 1.4);
    p.set(x, hm.sample(x, z) - 0.05, z);
    q.setFromEuler(new THREE.Euler(0, rng.range(0, Math.PI * 2), 0));
    s.set(size * rng.range(0.9, 1.5), size * rng.range(0.5, 0.9), size * rng.range(0.9, 1.5));
    m.compose(p, q, s); shrubs.setMatrixAt(n, m);
    const g = rng.range(0.75, 1.1), c = new THREE.Color(0x7a8a52).multiplyScalar(g).lerp(new THREE.Color(0xa09060), rng.range(0, 0.5));
    colorAttr[n * 3] = c.r; colorAttr[n * 3 + 1] = c.g; colorAttr[n * 3 + 2] = c.b;
    n++;
  }
  shrubs.count = n;
  shrubs.instanceColor = new THREE.InstancedBufferAttribute(colorAttr, 3);
  group.add(shrubs);
  void rockTrail;
  return group;
}
