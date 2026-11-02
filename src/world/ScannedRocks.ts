import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PhysicsWorld } from '../physics/World';
import type { Heightmap, Polyline, TerrainQuery } from '../terrain/Heightmap';
import { Rng } from '../core/Random';

/**
 * Photogrammetry boulders (Poly Haven, CC0) placed as landmarks along the
 * trails and scattered over rocky ground. Loaded after the game starts so the
 * first frame never waits on them; each instance gets a convex-hull collider.
 */
const MODELS = ['boulder_02', 'boulder_03', 'boulder_04', 'boulder_05'];

interface Placement { model: number; x: number; z: number; scale: number; yaw: number; tilt: number; }

export async function loadScannedRocks(
  scene: THREE.Scene, physics: PhysicsWorld, terrain: TerrainQuery, base: Heightmap,
  paths: Map<string, Polyline>, density: number,
): Promise<number> {
  const loader = new GLTFLoader();
  const url = (m: string) => `${import.meta.env.BASE_URL}models/rocks/${m}.glb`;
  const loaded = await Promise.all(MODELS.map((m) => loader.loadAsync(url(m)).then((g) => {
    let mesh: THREE.Mesh | null = null;
    g.scene.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    return mesh as THREE.Mesh | null;
  }).catch(() => null)));

  const parts = loaded.map((mesh) => {
    if (!mesh) return null;
    const geo = mesh.geometry as THREE.BufferGeometry;
    geo.computeBoundingBox();
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.envMapIntensity = 0.45;
    mat.side = THREE.FrontSide;
    mat.color = new THREE.Color(1.05, 0.98, 0.9);
    // Hull points: a strided subset of the vertices is plenty for a convex collider.
    const pos = geo.getAttribute('position');
    const stride = Math.max(1, Math.floor(pos.count / 300));
    const pts: number[] = [];
    for (let i = 0; i < pos.count; i += stride) pts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    return { geo, mat, pts: new Float32Array(pts), minY: geo.boundingBox!.min.y, height: geo.boundingBox!.max.y - geo.boundingBox!.min.y };
  });
  const available = parts.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  if (available.length === 0) return 0;

  const placements = planPlacements(terrain, base, paths, density, available);
  const byModel = new Map<number, Placement[]>();
  for (const p of placements) { const arr = byModel.get(p.model) ?? []; arr.push(p); byModel.set(p.model, arr); }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const group = new THREE.Group();
  for (const [mi, list] of byModel) {
    const part = parts[mi]!;
    const inst = new THREE.InstancedMesh(part.geo, part.mat, list.length);
    inst.castShadow = true; inst.receiveShadow = true;
    list.forEach((p, k) => {
      // Sit on the lowest ground under the footprint, sunk by ~18% of the height.
      const r = 1.1 * p.scale;
      const g = Math.min(terrain.sample(p.x, p.z), terrain.sample(p.x + r, p.z), terrain.sample(p.x - r, p.z), terrain.sample(p.x, p.z + r), terrain.sample(p.x, p.z - r));
      const y = g - part.minY * p.scale - part.height * p.scale * 0.18;
      q.setFromEuler(new THREE.Euler(p.tilt, p.yaw, p.tilt * 0.6));
      s.setScalar(p.scale); v.set(p.x, y, p.z);
      m.compose(v, q, s); inst.setMatrixAt(k, m);
      const scaled = new Float32Array(part.pts.length);
      for (let i = 0; i < scaled.length; i++) scaled[i] = part.pts[i] * p.scale;
      const desc = physics.R.ColliderDesc.convexHull(scaled);
      if (desc) physics.world.createCollider(desc.setTranslation(p.x, y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(1.05));
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }
  scene.add(group);
  return placements.length;
}

function planPlacements(terrain: TerrainQuery, base: Heightmap, paths: Map<string, Polyline>, density: number, models: number[]): Placement[] {
  const rng = new Rng(5150);
  const out: Placement[] = [];
  const trailList = [...paths.values()];
  const distToTrail = (x: number, z: number): number => {
    let best = Infinity;
    for (const p of trailList) {
      const b = p.bounds(40);
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      best = Math.min(best, p.nearest(x, z).d);
    }
    return best;
  };
  const ok = (x: number, z: number, minTrail: number): boolean =>
    Math.hypot(x, z) > 60 && distToTrail(x, z) > minTrail && out.every((o) => Math.hypot(o.x - x, o.z - z) > 3 + 2.2 * o.scale);
  const add = (x: number, z: number, scale: number) => out.push({ model: rng.pick(models), x, z, scale, yaw: rng.range(0, Math.PI * 2), tilt: rng.range(-0.12, 0.12) });

  // Landmarks along every trail's shoulders.
  for (const [id, path] of paths) {
    const every = id === 'technical' ? 22 : 38;
    for (let t = 30; t < path.length - 20; t += every * rng.range(0.7, 1.3)) {
      const p = path.at(t), tg = path.tangent(t);
      const side = rng.float() < 0.5 ? -1 : 1;
      const lat = side * rng.range(id === 'wadi' ? 22 : 10, id === 'wadi' ? 34 : 20);
      const x = p.x - tg.z * lat, z = p.z + tg.x * lat;
      if (ok(x, z, 9)) add(x, z, rng.range(0.8, 1.9));
      // Small cluster companion.
      if (rng.float() < 0.5) { const cx = x + rng.range(-4, 4), cz = z + rng.range(-4, 4); if (ok(cx, cz, 9)) add(cx, cz, rng.range(0.35, 0.8)); }
    }
  }
  // Scatter over rocky ground across the whole map.
  const half = base.size / 2 - 40;
  const target = out.length + Math.round(90 * density);
  for (let tries = 0; out.length < target && tries < 4000; tries++) {
    const x = rng.range(-half, half), z = rng.range(-half, half);
    const sand = terrain.sampleSand(x, z);
    if (rng.float() > 0.15 + 0.85 * (1 - sand)) continue;
    if (!ok(x, z, 14)) continue;
    add(x, z, rng.range(0.5, 2.2));
  }
  return out;
}
