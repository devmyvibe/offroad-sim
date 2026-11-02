import { Heightmap, Polyline, type Vec2 } from './Heightmap';
import { Noise, clamp, lerp, smoothstep } from './Noise';

/**
 * Trail stamps modify the heightmap along a polyline. All of them first build
 * a smoothed "centreline profile" so the road surface is drivable, then shape
 * the cross-section (U-channel for a wadi, humps for axle twisters, ledges for
 * rock steps).
 */

export interface TrailStampBase {
  path: Polyline;
  /** half-width of the drivable surface in metres */
  width: number;
  /** extra blend margin outside the width */
  edge: number;
  /** moving-average window (m) applied to the centreline height */
  smooth: number;
  /** sand weight written inside the trail (0 rock .. 1 sand) */
  sand: number;
}

function buildProfile(hm: Heightmap, path: Polyline, smooth: number, step = 2): Float32Array {
  const count = Math.ceil(path.length / step) + 1;
  const raw = new Float32Array(count);
  const p = { x: 0, z: 0 };
  for (let k = 0; k < count; k++) { path.at(k * step, p); raw[k] = hm.sample(p.x, p.z); }
  const w = Math.max(1, Math.round(smooth / step / 2));
  const out = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    let sum = 0, n = 0;
    for (let m = -w; m <= w; m++) { const q = clamp(k + m, 0, count - 1); sum += raw[q]; n++; }
    out[k] = sum / n;
  }
  return out;
}

function profileAt(prof: Float32Array, t: number, step = 2): number {
  const f = clamp(t / step, 0, prof.length - 1);
  const k = Math.floor(f);
  return lerp(prof[k], prof[Math.min(prof.length - 1, k + 1)], f - k);
}

export interface CrossSectionCtx { t: number; d: number; side: number; x: number; z: number; }

/**
 * Generic trail stamp. `shape(ctx)` returns a height offset relative to the
 * smoothed centreline; `extra(ctx)` may return an additional longitudinal
 * offset (e.g. steps) added before blending.
 */
export function stampTrail(
  hm: Heightmap,
  s: TrailStampBase,
  shape: (c: CrossSectionCtx) => number = () => 0,
  along: (t: number) => number = () => 0,
): void {
  const prof = buildProfile(hm, s.path, s.smooth);
  const b = s.path.bounds(s.width + s.edge);
  hm.forEachInBox(b.minX, b.minZ, b.maxX, b.maxZ, (x, z, i, j) => {
    const { t, d, side } = s.path.nearest(x, z);
    if (d > s.width + s.edge) return;
    const w = 1 - smoothstep(s.width, s.width + s.edge, d);
    const k = hm.idx(i, j);
    const target = profileAt(prof, t) + along(t) + shape({ t, d, side, x, z });
    hm.heights[k] = lerp(hm.heights[k], target, w);
    hm.sand[k] = lerp(hm.sand[k], s.sand, w);
  });
}

/** Wide sandy channel with a U-shaped bed and small ripples. */
export function stampWadi(hm: Heightmap, path: Polyline, noise: Noise, width = 16, depth = 2.5): void {
  stampTrail(hm, { path, width, edge: 18, smooth: 60, sand: 1 }, (c) => {
    const u = clamp(c.d / width, 0, 1);
    const bed = -depth * (1 - u * u);
    const ripple = 0.12 * noise.fbm(c.x * 0.25, c.z * 0.25, 2) + 0.08 * Math.sin(c.t * 0.8 + noise.n2(c.x * 0.05, c.z * 0.05) * 3);
    return bed + ripple;
  });
}

/** Narrow track with alternating diagonal humps (axle twisters) and some side-slope. */
export function stampCrossings(hm: Heightmap, path: Polyline, noise: Noise, width = 4.5): void {
  stampTrail(hm, { path, width, edge: 5, smooth: 30, sand: 0.25 }, (c) => {
    // Alternate humps left/right along the trail. Period ~9m, amplitude up to 0.55m.
    const phase = (c.t / 9) * Math.PI * 2;
    const intensity = smoothstep(120, 220, c.t) * (1 - smoothstep(0.9, 1.0, 0)); // ramp in after 120m
    const left = Math.max(0, Math.sin(phase)) * (c.side > 0 ? 1 : 0);
    const right = Math.max(0, -Math.sin(phase)) * (c.side < 0 ? 1 : 0);
    const lateral = smoothstep(0.4, 2.2, c.d); // hump sits on the wheel track, not the centre
    const hump = 0.55 * intensity * (left + right) * lateral;
    // Camber: the track leans sideways in places so the player feels roll.
    const camber = 0.10 * Math.sin(c.t / 70) * c.side * c.d * smoothstep(80, 160, c.t);
    const rough = 0.06 * noise.fbm(c.x * 0.4, c.z * 0.4, 2);
    return hump + camber + rough;
  });
}

export interface StepSpec { t: number; h: number; }

/** Rocky climb with hard ledges of height h at arc-length t (face ≈ 60°). */
export function stampRockSteps(hm: Heightmap, path: Polyline, noise: Noise, steps: StepSpec[], width = 5): void {
  stampTrail(
    hm,
    { path, width, edge: 6, smooth: 40, sand: 0.05 },
    (c) => 0.05 * noise.fbm(c.x * 0.5, c.z * 0.5, 2) + 0.04 * noise.n2(c.x * 2, c.z * 2),
    (t) => {
      let h = 0;
      for (const s of steps) {
        const face = s.h * 0.6; // horizontal run of the face
        h += s.h * smoothstep(s.t - face * 0.5, s.t + face * 0.5, t);
      }
      return h;
    },
  );
}

/** Smooth graded dirt track (the hub access roads). */
export function stampDirtRoad(hm: Heightmap, path: Polyline, width = 4): void {
  stampTrail(hm, { path, width, edge: 4, smooth: 40, sand: 0.4 }, (c) => -0.08 * smoothstep(width, 0, c.d));
}

export const pathFrom = (ctrl: Vec2[]): Polyline => new Polyline(ctrl);
