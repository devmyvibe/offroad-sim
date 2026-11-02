import { Heightmap } from './Heightmap';
import { Noise, clamp } from './Noise';

/**
 * A high-resolution heightmap over part of the base map. It starts as the
 * base surface plus fine detail (fading to zero at the patch border so the
 * seam is invisible), then trail stamps carve into it.
 */
export function createDetailPatch(base: Heightmap, cx: number, cz: number, size: number, cell: number, noise: Noise): Heightmap {
  const n = Math.round(size / cell);
  const patch = new Heightmap(n, size, cx, cz);
  const n1 = n + 1;
  for (let i = 0; i < n1; i++) for (let j = 0; j < n1; j++) {
    const x = patch.worldX(j), z = patch.worldZ(i);
    const edge = clamp(Math.min(x - patch.minX, patch.maxX - x, z - patch.minZ, patch.maxZ - z) / 24, 0, 1);
    const detail = 0.14 * noise.fbm(x / 9, z / 9, 3) + 0.045 * noise.fbm(x / 2.6 + 5, z / 2.6, 2);
    const k = patch.idx(i, j);
    patch.heights[k] = base.sample(x, z) + detail * edge;
    patch.sand[k] = base.sampleSand(x, z);
  }
  return patch;
}

/**
 * Sink the base heightfield under the patch so the two colliders never fight:
 * inside the patch (with a margin) the base sits ≥ 0.6 m below the lowest
 * nearby patch height. The patch mesh hides it.
 */
export function sinkBaseUnderPatch(base: Heightmap, patch: Heightmap): void {
  const margin = base.cell * 1.01;
  base.forEachInBox(patch.minX + margin, patch.minZ + margin, patch.maxX - margin, patch.maxZ - margin, (x, z, i, j) => {
    let lo = Infinity;
    const r = base.cell;
    for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) lo = Math.min(lo, patch.sample(x + ox, z + oz));
    const k = base.idx(i, j);
    base.heights[k] = Math.min(base.heights[k], lo - 0.6);
  });
}
