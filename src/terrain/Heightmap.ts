import { clamp, lerp, smoothstep } from './Noise';

export interface Vec2 { x: number; z: number; }

/**
 * Square heightmap with (n+1)^2 samples over a world extent of `size` metres,
 * centred at the origin. Index (i, j): i ↔ z row, j ↔ x column.
 * `sand` is a per-sample surface weight: 1 = loose sand, 0 = hard rock.
 */
export class Heightmap {
  readonly n: number;
  readonly size: number;
  readonly cell: number;
  readonly heights: Float32Array;
  readonly sand: Float32Array;
  private readonly half: number;

  constructor(n: number, size: number) {
    this.n = n; this.size = size; this.cell = size / n; this.half = size / 2;
    this.heights = new Float32Array((n + 1) * (n + 1));
    this.sand = new Float32Array((n + 1) * (n + 1));
  }

  idx(i: number, j: number): number { return i * (this.n + 1) + j; }
  worldX(j: number): number { return j * this.cell - this.half; }
  worldZ(i: number): number { return i * this.cell - this.half; }

  /** Bilinear height at world (x, z). Clamped at the borders. */
  sample(x: number, z: number): number { return this.bilinear(this.heights, x, z); }
  sampleSand(x: number, z: number): number { return this.bilinear(this.sand, x, z); }

  private bilinear(arr: Float32Array, x: number, z: number): number {
    const fx = clamp((x + this.half) / this.cell, 0, this.n - 1e-6);
    const fz = clamp((z + this.half) / this.cell, 0, this.n - 1e-6);
    const j = Math.floor(fx), i = Math.floor(fz);
    const tx = fx - j, tz = fz - i;
    const a = arr[this.idx(i, j)], b = arr[this.idx(i, j + 1)];
    const c = arr[this.idx(i + 1, j)], d = arr[this.idx(i + 1, j + 1)];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  /** Surface normal (world space, unit) at (x, z) by central differences. */
  normal(x: number, z: number, out: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 }): { x: number; y: number; z: number } {
    const e = this.cell * 0.5;
    const dx = this.sample(x + e, z) - this.sample(x - e, z);
    const dz = this.sample(x, z + e) - this.sample(x, z - e);
    const nx = -dx / (2 * e), nz = -dz / (2 * e);
    const len = Math.hypot(nx, 1, nz);
    out.x = nx / len; out.y = 1 / len; out.z = nz / len;
    return out;
  }

  /** Slope in [0,1] = 1 - normal.y at a sample index. */
  slopeAt(i: number, j: number): number {
    const i0 = Math.max(0, i - 1), i1 = Math.min(this.n, i + 1);
    const j0 = Math.max(0, j - 1), j1 = Math.min(this.n, j + 1);
    const dx = (this.heights[this.idx(i, j1)] - this.heights[this.idx(i, j0)]) / ((j1 - j0) * this.cell);
    const dz = (this.heights[this.idx(i1, j)] - this.heights[this.idx(i0, j)]) / ((i1 - i0) * this.cell);
    return 1 - 1 / Math.hypot(dx, 1, dz);
  }

  /** Apply fn(x, z, h, sand) → [h, sand] to every sample inside a world-space box. */
  forEachInBox(minX: number, minZ: number, maxX: number, maxZ: number, fn: (x: number, z: number, i: number, j: number) => void): void {
    const j0 = clamp(Math.floor((minX + this.half) / this.cell), 0, this.n);
    const j1 = clamp(Math.ceil((maxX + this.half) / this.cell), 0, this.n);
    const i0 = clamp(Math.floor((minZ + this.half) / this.cell), 0, this.n);
    const i1 = clamp(Math.ceil((maxZ + this.half) / this.cell), 0, this.n);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) fn(this.worldX(j), this.worldZ(i), i, j);
  }

  /** Flatten a disc toward a target height with a soft edge. */
  flatten(cx: number, cz: number, radius: number, targetH: number, edge = radius * 0.5, sand?: number): void {
    const r = radius + edge;
    this.forEachInBox(cx - r, cz - r, cx + r, cz + r, (x, z, i, j) => {
      const d = Math.hypot(x - cx, z - cz);
      const w = 1 - smoothstep(radius, radius + edge, d);
      if (w <= 0) return;
      const k = this.idx(i, j);
      this.heights[k] = lerp(this.heights[k], targetH, w);
      if (sand !== undefined) this.sand[k] = lerp(this.sand[k], sand, w);
    });
  }
}

/* ---------- Polyline helpers used by trail stamps ---------- */

export class Polyline {
  readonly pts: Vec2[];
  readonly cum: number[] = [0];
  readonly length: number;
  constructor(pts: Vec2[]) {
    this.pts = pts;
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    this.length = this.cum[this.cum.length - 1];
  }

  /** Point at arc length t. */
  at(t: number, out: Vec2 = { x: 0, z: 0 }): Vec2 {
    t = clamp(t, 0, this.length);
    let s = 1;
    while (s < this.cum.length - 1 && this.cum[s] < t) s++;
    const a = this.pts[s - 1], b = this.pts[s];
    const segLen = this.cum[s] - this.cum[s - 1];
    const u = segLen > 0 ? (t - this.cum[s - 1]) / segLen : 0;
    out.x = lerp(a.x, b.x, u); out.z = lerp(a.z, b.z, u);
    return out;
  }

  /** Unit tangent at arc length t. */
  tangent(t: number, out: Vec2 = { x: 0, z: 0 }): Vec2 {
    t = clamp(t, 0, this.length);
    let s = 1;
    while (s < this.cum.length - 1 && this.cum[s] < t) s++;
    const a = this.pts[s - 1], b = this.pts[s];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    out.x = (b.x - a.x) / l; out.z = (b.z - a.z) / l;
    return out;
  }

  /**
   * Nearest point: returns arc length t, unsigned distance d and signed side
   * (+1 = left of travel direction, -1 = right).
   */
  nearest(x: number, z: number): { t: number; d: number; side: number } {
    let best = Infinity, bt = 0, bside = 1;
    for (let s = 1; s < this.pts.length; s++) {
      const a = this.pts[s - 1], b = this.pts[s];
      const ex = b.x - a.x, ez = b.z - a.z;
      const l2 = ex * ex + ez * ez || 1;
      let u = ((x - a.x) * ex + (z - a.z) * ez) / l2;
      u = clamp(u, 0, 1);
      const px = a.x + ex * u, pz = a.z + ez * u;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) {
        best = d; bt = this.cum[s - 1] + Math.sqrt(l2) * u;
        // cross(tangent, toPoint): y-up world, tangent (ex, ez), point offset (x-px, z-pz)
        const cross = ex * (z - pz) - ez * (x - px);
        bside = cross > 0 ? -1 : 1;
      }
    }
    return { t: bt, d: best, side: bside };
  }

  bounds(pad: number): { minX: number; minZ: number; maxX: number; maxZ: number } {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const p of this.pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
  }
}

/** Smooth Catmull-Rom resampling of control points into a dense polyline. */
export function smoothPath(ctrl: Vec2[], step = 4): Vec2[] {
  if (ctrl.length < 3) return ctrl.slice();
  const pts: Vec2[] = [];
  const P = (i: number) => ctrl[clamp(i, 0, ctrl.length - 1)];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const steps = Math.max(2, Math.ceil(segLen / step));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
      pts.push({ x, z });
    }
  }
  pts.push({ ...ctrl[ctrl.length - 1] });
  return pts;
}
