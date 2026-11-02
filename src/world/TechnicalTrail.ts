import { Heightmap, Polyline, type Vec2 } from '../terrain/Heightmap';
import { Noise, clamp, smoothstep } from '../terrain/Noise';
import { stampTrail } from '../terrain/Stamps';
import type { RockField } from './Rocks';
import { Rng } from '../core/Random';

/**
 * The technical trail lives entirely inside the 1 m detail patch. Sections by
 * arc length (metres): sandy wadi → rock garden → ledge rows → V-ditch →
 * off-camber traverse → loose gravel climb over a ridge → descent.
 */
export const TECH = {
  wadi: [0, 160], garden: [165, 295], ledges: [320, 350, 385, 415] as number[], ledgeH: [0.3, 0.38, 0.35, 0.4],
  ditch: 445, camber: [470, 560], climb: [570, 660], crest: 640, descent: [660, 730],
};

export function ridgeFor(path: Polyline): { c: Vec2; along: Vec2; across: Vec2 } {
  const c = path.at(TECH.crest), tg = path.tangent(TECH.crest);
  return { c, along: tg, across: { x: -tg.z, z: tg.x } };
}

/** Raise a ridge across the trail so the climb/descent has something to climb. Call before stamping. */
export function stampRidge(patch: Heightmap, path: Polyline): void {
  const { c, along, across } = ridgeFor(path);
  const n1 = patch.n + 1;
  for (let i = 0; i < n1; i++) for (let j = 0; j < n1; j++) {
    const x = patch.worldX(j), z = patch.worldZ(i);
    const dx = x - c.x, dz = z - c.z;
    const dAlong = dx * along.x + dz * along.z;    // distance along the trail direction (across the ridge)
    const dAcross = dx * across.x + dz * across.z;  // distance along the ridge line
    const profile = Math.exp(-(dAlong * dAlong) / (2 * 42 * 42));
    const extent = Math.exp(-Math.pow(Math.abs(dAcross) / 130, 4));
    const edge = clamp(Math.min(x - patch.minX, patch.maxX - x, z - patch.minZ, patch.maxZ - z) / 45, 0, 1);
    patch.heights[patch.idx(i, j)] += 15 * profile * extent * edge;
  }
}

export function stampTechnicalTrail(patch: Heightmap, path: Polyline, noise: Noise): void {
  const sandAt = (t: number): number => {
    if (t < TECH.wadi[1]) return 1;
    if (t < TECH.garden[1] + 10) return 0.12;
    if (t < TECH.ditch + 20) return 0.05;
    if (t < TECH.camber[1] + 10) return 0.2;
    if (t < TECH.climb[1]) return 0.6;  // loose gravel: less grip, some drag
    return 0.3;
  };
  stampTrail(
    patch,
    { path, width: 5.5, edge: 7, smooth: 22, sand: sandAt },
    (c) => {
      let h = 0.06 * noise.fbm(c.x * 0.5, c.z * 0.5, 2) + 0.025 * noise.n2(c.x * 2.1, c.z * 2.1);
      // Wadi: U-channel that fades in/out.
      const wadiW = smoothstep(0, 25, c.t) * (1 - smoothstep(TECH.wadi[1] - 25, TECH.wadi[1], c.t));
      const u = clamp(c.d / 7, 0, 1);
      h += wadiW * (-1.1 * (1 - u * u) + 0.1 * Math.sin(c.t * 0.9 + c.d));
      // Off-camber traverse: the track leans ~17° to one side.
      const camW = smoothstep(TECH.camber[0], TECH.camber[0] + 20, c.t) * (1 - smoothstep(TECH.camber[1] - 20, TECH.camber[1], c.t));
      h += camW * 0.31 * c.d * c.side;
      // Gravel climb: bumpier.
      const climbW = smoothstep(TECH.climb[0], TECH.climb[0] + 10, c.t) * (1 - smoothstep(TECH.climb[1], TECH.climb[1] + 10, c.t));
      h += climbW * 0.08 * noise.fbm(c.x * 1.3, c.z * 1.3, 2);
      return h;
    },
    (t) => {
      // Ground steps up a few metres behind each ledge row, so the slabs are a real step.
      let h = 0;
      TECH.ledges.forEach((lt, i) => { h += TECH.ledgeH[i] * smoothstep(lt + 2.5, lt + 7, t); });
      return h;
    },
  );
  stampDitch(patch, path);
}

/** Diagonal V-ditch across the track: lifts opposite wheels as you cross it. */
function stampDitch(patch: Heightmap, path: Polyline): void {
  const c = path.at(TECH.ditch), tg = path.tangent(TECH.ditch);
  const ang = 38 * Math.PI / 180;
  // ditch axis = tangent rotated by `ang`
  const ax = tg.x * Math.cos(ang) - tg.z * Math.sin(ang), az = tg.x * Math.sin(ang) + tg.z * Math.cos(ang);
  patch.forEachInBox(c.x - 24, c.z - 24, c.x + 24, c.z + 24, (x, z, i, j) => {
    const dx = x - c.x, dz = z - c.z;
    const along = dx * ax + dz * az;
    const perp = Math.abs(-dx * az + dz * ax);
    if (perp > 4.2) return;
    const extent = 1 - smoothstep(10, 16, Math.abs(along));
    const depth = 0.95 * (1 - perp / 4.2);
    patch.heights[patch.idx(i, j)] -= depth * extent;
  });
}

/** Rocks: garden, ledge slabs, loose stones on the climb, boulders on the shoulders. */
/** Lateral offset (m, +left) of the clear line through the rock garden. */
export function gardenLine(t: number): number { return 2.3 * Math.sin(t / 16) + 0.6 * Math.sin(t / 5.3); }

export function placeTechnicalRocks(rocks: RockField, patch: Heightmap, path: Polyline, rng: Rng): void {
  const at = (t: number, lateral: number): Vec2 => { const p = path.at(t), tg = path.tangent(t); return { x: p.x - tg.z * lateral, z: p.z + tg.x * lateral }; };
  const yaw = (t: number): number => { const tg = path.tangent(t); return Math.atan2(tg.x, tg.z); };

  // Rock garden: a sinuous clear line through a field of rocks.
  for (let t = TECH.garden[0]; t < TECH.garden[1]; t += 2.4) {
    const line = gardenLine(t);
    for (let k = 0; k < 3; k++) {
      const lat = rng.range(-5.5, 5.5);
      const inCorridor = Math.abs(lat - line) < 2.3;
      if (inCorridor && rng.float() > 0.3) continue;
      const size = inCorridor ? rng.range(0.14, 0.26) : rng.range(0.3, 0.85);
      const p = at(t + rng.range(-1, 1), lat);
      rocks.add(p.x, patch.sample(p.x, p.z), p.z, size, { bury: inCorridor ? 0.45 : 0.3 });
    }
  }
  // Ledge rows: slabs across the track with rubble at the foot (a natural ledge is climbable because of it).
  TECH.ledges.forEach((lt, i) => {
    const h = TECH.ledgeH[i];
    for (let lat = -5.5; lat <= 5.5; lat += 1.9) {
      const p = at(lt + rng.range(-0.4, 0.4), lat + rng.range(-0.3, 0.3));
      // Rock local x is elongated; yaw = trail heading puts local x across the track.
      rocks.add(p.x, patch.sample(p.x, p.z), p.z, 1.0, { variant: 4, sx: 1.25, sz: 0.9, sy: h * 1.3, yaw: yaw(lt) + rng.range(-0.1, 0.1), tilt: 0, bury: 0.1, tint: rng.range(0.7, 0.9) });
      if (rng.float() < 0.8) {
        const f = at(lt - 1.1 + rng.range(-0.2, 0.2), lat + rng.range(-0.8, 0.8));
        rocks.add(f.x, patch.sample(f.x, f.z), f.z, rng.range(0.2, 0.3) * (0.6 + h), { bury: 0.35, tint: rng.range(0.75, 0.95) });
      }
    }
  });
  // Loose stones on the gravel climb.
  for (let t = TECH.climb[0]; t < TECH.climb[1]; t += 4) {
    const p = at(t + rng.range(-1.5, 1.5), rng.range(-4.5, 4.5));
    rocks.add(p.x, patch.sample(p.x, p.z), p.z, rng.range(0.15, 0.32), { bury: 0.4 });
  }
  // Descent: a couple of boulders to steer around.
  for (let t = TECH.descent[0] + 10; t < TECH.descent[1]; t += 11) {
    const p = at(t, rng.range(-3.5, 3.5));
    rocks.add(p.x, patch.sample(p.x, p.z), p.z, rng.range(0.4, 0.7), { bury: 0.3 });
  }
  // Shoulders: boulders either side along the whole trail.
  for (let t = 10; t < path.length - 10; t += 3.5) {
    if (rng.float() > 0.55) continue;
    const side = rng.float() < 0.5 ? -1 : 1;
    const p = at(t, side * rng.range(7.5, 15));
    rocks.add(p.x, patch.sample(p.x, p.z), p.z, rng.range(0.45, 1.5), { bury: 0.35 });
  }
  // Off-trail scatter inside the patch.
  for (let k = 0; k < 420; k++) {
    const x = rng.range(patch.minX + 15, patch.maxX - 15), z = rng.range(patch.minZ + 15, patch.maxZ - 15);
    if (path.nearest(x, z).d < 17) continue;
    const slope = 1 - patch.normal(x, z).y;
    if (rng.float() > 0.25 + slope * 2.5) continue;
    rocks.add(x, patch.sample(x, z), z, rng.range(0.25, 1.4), { bury: 0.35, collider: rng.float() < 0.5 });
  }
}
