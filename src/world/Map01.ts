import { Heightmap, CompositeTerrain, Polyline, smoothPath } from '../terrain/Heightmap';
import { createDetailPatch, sinkBaseUnderPatch } from '../terrain/DetailPatch';
import { stampRidge, stampTechnicalTrail } from './TechnicalTrail';
import { Noise, smoothstep } from '../terrain/Noise';
import { stampWadi, stampCrossings, stampDirtRoad } from '../terrain/Stamps';
import { TRAILS, type TrailDef } from '../trails/trails';

export const MAP_SEED = 20261102;
export const MAP_SIZE = 2048;      // metres per side
export const MAP_CELLS = 512;      // heightfield subdivisions per side (4 m cells)

export interface BuiltMap {
  hm: Heightmap;
  /** 1 m detail patch holding the technical trail */
  patch: Heightmap;
  terrain: CompositeTerrain;
  paths: Map<string, Polyline>;
  hubHeight: number;
}

export const PATCH = { cx: 420, cz: -380, size: 640, cell: 1 };

/**
 * Deterministic desert: rolling dune country in the south, broken hills in the
 * west, a rocky massif in the north-east, and a flat hub at the origin. The three
 * trails are carved after the base terrain so their surfaces are drivable.
 */
export function buildMap(): BuiltMap {
  const hm = new Heightmap(MAP_CELLS, MAP_SIZE);
  const noise = new Noise(MAP_SEED);
  const detail = new Noise(MAP_SEED + 7);

  // Massif centre (NE) and dune basin centre (S).
  const massif = { x: 840, z: -840, r: 560 };
  const basin = { x: 60, z: 620, r: 560 };

  const n1 = hm.n + 1;
  for (let i = 0; i < n1; i++) {
    const z = hm.worldZ(i);
    for (let j = 0; j < n1; j++) {
      const x = hm.worldX(j);
      const dm = Math.hypot(x - massif.x, z - massif.z);
      const db = Math.hypot(x - basin.x, z - basin.z);
      // Keep the big massif out of the technical-trail patch so its climb is the designed ridge only.
      const inPatch = (1 - smoothstep(PATCH.size / 2 - 10, PATCH.size / 2 + 160, Math.abs(x - PATCH.cx))) * (1 - smoothstep(PATCH.size / 2 - 10, PATCH.size / 2 + 160, Math.abs(z - PATCH.cz)));
      const massifW = (1 - smoothstep(massif.r * 0.35, massif.r, dm)) * (1 - 0.85 * inPatch);
      const basinW = 1 - smoothstep(basin.r * 0.4, basin.r, db);

      // Base rolling ground.
      let h = 14 * noise.fbm(x / 760, z / 760, 3) + 5 * noise.fbm(x / 210 + 3.1, z / 210 - 1.7, 3) + 0.9 * detail.fbm(x / 38, z / 38, 2);
      // Broken hills everywhere in the west half.
      const westW = smoothstep(-100, -500, x);
      h += westW * 12 * noise.ridged(x / 300 + 9, z / 300 + 2, 3);
      // Rocky massif: ridged, tall, with a gentle apron.
      h += massifW * (28 + 48 * noise.ridged(x / 420 - 4, z / 420 + 6, 4));
      // Dune basin: lower, long soft dunes.
      const dune = Math.sin((x * 0.6 + z) / 55 + 2 * noise.n2(x / 300, z / 300)) * 0.5 + 0.5;
      h += basinW * (-6 + 2.6 * dune * dune);

      const k = hm.idx(i, j);
      hm.heights[k] = h;
      hm.sand[k] = 0.6 * (1 - massifW) + 0.4 * basinW; // refined by slope below
    }
  }
  // Slope-aware sandiness: steep faces are rock, flats collect sand.
  for (let i = 0; i < n1; i++) for (let j = 0; j < n1; j++) {
    const k = hm.idx(i, j);
    const s = hm.slopeAt(i, j);
    hm.sand[k] = Math.min(1, Math.max(0, hm.sand[k] * (1 - smoothstep(0.12, 0.4, s))));
  }

  // Hub: flat pad for the start area.
  const hubHeight = hm.sample(0, 0);
  hm.flatten(0, 0, 55, hubHeight, 40, 0.3);

  // Carve the base-resolution trails and the access roads from the hub.
  const paths = new Map<string, Polyline>();
  for (const t of TRAILS) {
    const p = new Polyline(smoothPath(t.ctrl, t.kind === 'technical' ? 2 : 4));
    paths.set(t.id, p);
    if (t.kind !== 'technical') carve(hm, noise, t, p);
  }
  for (const t of TRAILS) {
    const s = t.ctrl[0];
    stampDirtRoad(hm, new Polyline([{ x: 0, z: 0 }, { x: s.x * 0.5, z: s.z * 0.5 }, s]), 4);
  }
  hm.flatten(0, 0, 18, hubHeight, 20, 0.3);

  // High-resolution patch for the technical trail: built from the base, then shaped.
  const patch = createDetailPatch(hm, PATCH.cx, PATCH.cz, PATCH.size, PATCH.cell, new Noise(MAP_SEED + 11));
  const tech = paths.get('technical')!;
  stampRidge(patch, tech);
  stampTechnicalTrail(patch, tech, new Noise(MAP_SEED + 12));
  sinkBaseUnderPatch(hm, patch);

  return { hm, patch, terrain: new CompositeTerrain(hm, patch), paths, hubHeight };
}

function carve(hm: Heightmap, noise: Noise, t: TrailDef, p: Polyline): void {
  switch (t.kind) {
    case 'wadi': stampWadi(hm, p, noise); break;
    case 'crossings': stampCrossings(hm, p, noise); break;
    case 'technical': break;
  }
}
