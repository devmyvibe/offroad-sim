import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/World';
import type { TerrainQuery, Polyline } from '../terrain/Heightmap';
import { Noise } from '../terrain/Noise';
import { Rng } from '../core/Random';
import { TRAILS, type TrailDef } from '../trails/trails';

/**
 * Hard obstacles the 4 m heightfield cannot represent: rock ledges on the
 * climb and half-buried rock humps (axle twisters) on the crossings trail.
 * Each gets a physics collider and a mesh sharing one rock material.
 */
export function buildObstacles(physics: PhysicsWorld, hm: TerrainQuery, paths: Map<string, Polyline>, rockMaterial: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const rng = new Rng(777);
  const noise = new Noise(31);
  for (const t of TRAILS) {
    const path = paths.get(t.id)!;
    if (t.kind === 'crossings') addHumps(physics, hm, path, t, group, rockMaterial, rng, noise);
  }
  return group;
}

/** A rock shelf across the trail: flat top at the upper level, steep front face. (Unused since the technical trail; kept for other maps.) */
export function addLedge(physics: PhysicsWorld, hm: TerrainQuery, path: Polyline, t: number, h: number, group: THREE.Group, mat: THREE.Material, rng: Rng): void {
  const { R, world } = physics;
  const p = path.at(t), tg = path.tangent(t);
  const yaw = Math.atan2(tg.x, tg.z);
  // Ledge top = ground just before the step + step height; the back follows the trail's own slope.
  const lower = hm.sample(p.x - tg.x * 1, p.z - tg.z * 1);
  const upper = lower + h;
  const width = 9.5, length = 11, faceRun = h * 0.9;
  const backRise = Math.max(0, hm.sample(p.x + tg.x * length, p.z + tg.z * length) - upper);
  // Cross-section in local (z forward, y up): steep front face, flat-ish top, deep bottom so nothing shows underneath.
  const pts: [number, number][] = [[0, -2.0], [0, -0.05 - h], [faceRun, 0], [length, backRise], [length, -2.0]];
  const geo = prismGeometry(pts, width);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.position.set(p.x, upper, p.z);
  mesh.rotation.y = yaw;
  group.add(mesh);

  const verts = new Float32Array(pts.length * 2 * 3);
  let k = 0;
  for (const x of [-width / 2, width / 2]) for (const [z, y] of pts) { verts[k++] = x; verts[k++] = y; verts[k++] = z; }
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const desc = R.ColliderDesc.convexHull(verts)!.setTranslation(p.x, upper, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(1.1);
  world.createCollider(desc);
  void rng;
}

/** Convex prism: cross-section points (z, y) extruded along x over [-w/2, w/2], with proper normals. */
function prismGeometry(pts: [number, number][], width: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const hw = width / 2;
  const tri = (a: number[], b: number[], c: number[]) => { pos.push(...a, ...b, ...c); };
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [z0, y0] = pts[i], [z1, y1] = pts[(i + 1) % n];
    const a = [-hw, y0, z0], b = [hw, y0, z0], c = [hw, y1, z1], d = [-hw, y1, z1];
    tri(a, c, b); tri(a, d, c);
  }
  for (let i = 1; i < n - 1; i++) {
    const [za, ya] = pts[0], [zb, yb] = pts[i], [zc, yc] = pts[i + 1];
    tri([hw, ya, za], [hw, yb, zb], [hw, yc, zc]);
    tri([-hw, ya, za], [-hw, yc, zc], [-hw, yb, zb]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // Flip winding if the normals point inward (top face must face up).
  const nrm = g.getAttribute('normal');
  let sumY = 0; for (let i = 0; i < nrm.count; i++) sumY += nrm.getY(i);
  if (sumY < 0) { const idx = Array.from({ length: pos.length / 3 }, (_, i) => i); for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  // Per-face planar UVs chosen by the face normal so no face gets stretched stripes.
  const uv = new Float32Array(nrm.count * 2);
  const P = g.getAttribute('position');
  for (let i = 0; i < nrm.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const [u, v] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y] : [x, y];
    uv[i * 2] = u * 0.3; uv[i * 2 + 1] = v * 0.3;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Half-buried rock humps alternating left/right so one wheel lifts at a time. */
function addHumps(physics: PhysicsWorld, hm: TerrainQuery, path: Polyline, def: TrailDef, group: THREE.Group, mat: THREE.Material, rng: Rng, noise: Noise): void {
  const { R, world } = physics;
  // Lumpy capsule so the half-buried humps read as weathered rock, not pipes.
  const geo = new THREE.CapsuleGeometry(1, 1, 8, 16);
  { const p = geo.getAttribute('position'); const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + 0.3 * noise.fbm(v.x * 3.1 + 3, v.y * 2.4 + v.z * 3.1, 3); p.setXYZ(i, v.x * n, v.y, v.z * n); }
    geo.computeVertexNormals(); }
  const count = Math.floor((path.length - 140) / 9);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < count; i++) {
    const t = 140 + i * 9 + rng.range(-1.5, 1.5);
    const p = path.at(t), tg = path.tangent(t);
    const side = i % 2 === 0 ? 1 : -1;
    const nx = -tg.z, nz = tg.x; // left normal
    const lateral = side * rng.range(1.0, 1.9);
    const x = p.x + nx * lateral, z = p.z + nz * lateral;
    const r = rng.range(0.26, 0.4), len = rng.range(1.6, 2.6);
    const bury = r * rng.range(0.35, 0.55);
    const y = hm.sample(x, z) - bury;
    const yaw = Math.atan2(tg.x, tg.z) + Math.PI / 2 + rng.range(-0.5, 0.5) + 0.25 * noise.n2(x * 0.1, z * 0.1);
    q.setFromEuler(new THREE.Euler(0, yaw, Math.PI / 2));
    s.set(r, len / 2, r); pos.set(x, y, z);
    m.compose(pos, q, s);
    mesh.setMatrixAt(n++, m);
    world.createCollider(R.ColliderDesc.capsule(len / 2, r).setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(1.0));
  }
  mesh.count = n;
  // Darker, slightly varied tint per hump (multiplies the shared triplanar rock texture).
  const tint = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { const t = rng.range(0.55, 0.72); tint[i * 3] = t; tint[i * 3 + 1] = t * 0.95; tint[i * 3 + 2] = t * 0.86; }
  mesh.instanceColor = new THREE.InstancedBufferAttribute(tint, 3);
  group.add(mesh);
  void def;
}
