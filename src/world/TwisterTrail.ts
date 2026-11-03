import { Heightmap, Polyline, type Vec2 } from '../terrain/Heightmap';
import { Noise, clamp, smoothstep } from '../terrain/Noise';
import { stampTrail } from '../terrain/Stamps';
import type { RockField } from './Rocks';
import { Rng } from '../core/Random';

/**
 * "Twister Gully": a trail that is hard only because of the ground. Every
 * section is shaped so the wheels sit at different heights: diagonal moguls
 * (egg-crate), alternating diagonal ditches, an off-camber traverse with a
 * rut under the low wheels, a V-gully crossed at an angle, and see-saw ruts.
 * Arc lengths in metres along the trail.
 */
export const TWIST = {
  moguls: [45, 190] as const,
  ditches: [200, 290] as const,
  camber: [300, 390] as const,
  gully: 425,
  seesaw: [460, 555] as const,
  moguls2: [565, 650] as const,
};

/** 0..1 window with soft ends. */
const win = (t: number, a: number, b: number, ramp = 12): number => smoothstep(a, a + ramp, t) * (1 - smoothstep(b - ramp, b, t));

/** Lateral offset (m, +left) at a cross-section point. */
const lat = (d: number, side: number): number => d * side;

export function stampTwisterTrail(patch: Heightmap, path: Polyline, noise: Noise): void {
  const sandAt = (t: number): number => (Math.abs(t - TWIST.gully) < 25 ? 0.45 : t < 40 ? 0.35 : 0.12);
  stampTrail(patch, { path, width: 5.2, edge: 9, smooth: 26, sand: sandAt }, (c) => {
    const s = c.t, l = lat(c.d, c.side);
    // Fine roughness everywhere so nothing is perfectly smooth.
    let h = 0.05 * noise.fbm(c.x * 0.45, c.z * 0.45, 2) + 0.025 * noise.n2(c.x * 1.9, c.z * 1.9);

    // 1) Diagonal moguls: an egg-crate rotated 45°, so the bumps under the four
    //    wheels alternate diagonally and the axles twist against each other.
    const eggs = (A: number, lambda: number): number => {
      const u = (s + l) / Math.SQRT2, v = (s - l) / Math.SQRT2;
      return A * Math.sin((2 * Math.PI * u) / lambda) * Math.sin((2 * Math.PI * v) / lambda);
    };
    const m1 = win(s, TWIST.moguls[0], TWIST.moguls[1], 25);
    if (m1 > 0) h += m1 * eggs(0.28 + 0.24 * smoothstep(TWIST.moguls[0], TWIST.moguls[1], s), 7.2);

    // 2) Alternating diagonal ditches (±40°) every 11 m: one front wheel drops,
    //    then the opposite rear one.
    const dw = win(s, TWIST.ditches[0], TWIST.ditches[1], 6);
    if (dw > 0) {
      for (let k = 0; k < 9; k++) {
        const s0 = TWIST.ditches[0] + 6 + k * 11;
        const a = (k % 2 === 0 ? 1 : -1) * (40 * Math.PI) / 180;
        const dist = Math.abs((s - s0) * Math.cos(a) - l * Math.sin(a));
        if (dist < 1.8) h -= dw * 0.55 * (1 - dist / 1.8) ** 1.3;
      }
    }

    // 3) Off-camber traverse (~20°) with a wandering rut under the low-side wheels.
    const cw = win(s, TWIST.camber[0], TWIST.camber[1], 18);
    if (cw > 0) {
      h += cw * 0.33 * l;
      const rutC = -0.8 + 0.35 * Math.sin(s / 7.5);
      h -= cw * 0.32 * Math.exp(-((l - rutC) ** 2) / (2 * 0.32 * 0.32));
    }

    // 4) V-gully crossed at 28°: steep drop-in and climb-out, wheels hit it one at a time.
    {
      const a = (28 * Math.PI) / 180;
      const dist = Math.abs((s - TWIST.gully) * Math.cos(a) - l * Math.sin(a));
      if (dist < 10) h -= 2.1 * (1 - (dist / 10) ** 1.4);
    }

    // 5) See-saw ruts: a deep rut swaps sides every 12 m, rocking the truck left/right.
    const sw = win(s, TWIST.seesaw[0], TWIST.seesaw[1], 10);
    if (sw > 0) {
      const ph = Math.sin((2 * Math.PI * (s - TWIST.seesaw[0])) / 24);
      const side = Math.sign(ph) || 1;
      h -= sw * 0.48 * Math.sqrt(Math.abs(ph)) * Math.exp(-((l - side * 0.78) ** 2) / (2 * 0.38 * 0.38));
      h += sw * 0.12 * Math.abs(ph) * Math.exp(-((l + side * 0.78) ** 2) / (2 * 0.5 * 0.5)); // berm on the other side
    }

    // 6) Heavier moguls with a tighter wavelength before the exit.
    const m2 = win(s, TWIST.moguls2[0], TWIST.moguls2[1], 15);
    if (m2 > 0) h += m2 * eggs(0.5, 6.4);

    return h;
  });
}

/** Rocks: packed shoulders that keep you on the line, plus loose stones on the track. */
export function placeTwisterRocks(rocks: RockField, patch: Heightmap, path: Polyline, rng: Rng): void {
  const at = (t: number, l: number): Vec2 => { const p = path.at(t), tg = path.tangent(t); return { x: p.x - tg.z * l, z: p.z + tg.x * l }; };
  for (let t = 15; t < path.length - 10; t += 2.2) {
    for (const side of [-1, 1]) {
      if (rng.float() > 0.62) continue;
      // Tighter walls through the twisty bits; the gully banks are left open.
      if (Math.abs(t - TWIST.gully) < 12) continue;
      const near = rng.float() < 0.35;
      const l = side * (near ? rng.range(5.4, 6.6) : rng.range(6.6, 11));
      const p = at(t + rng.range(-1, 1), l);
      rocks.add(p.x, patch.sample(p.x, p.z), p.z, near ? rng.range(0.35, 0.8) : rng.range(0.5, 1.5), { bury: 0.32 });
    }
    // Loose stones on the track (visual only: too small to matter physically).
    if (rng.float() < 0.25) {
      const p = at(t + rng.range(-1, 1), rng.range(-3.5, 3.5));
      rocks.add(p.x, patch.sample(p.x, p.z), p.z, rng.range(0.08, 0.15), { bury: 0.45, collider: false });
    }
  }
  // Rock slabs lining the gully banks (outside the crossing line).
  for (let k = 0; k < 14; k++) {
    const t = TWIST.gully + rng.range(-14, 14), side = rng.float() < 0.5 ? -1 : 1;
    const p = at(t, side * rng.range(6.5, 12));
    rocks.add(p.x, patch.sample(p.x, p.z), p.z, rng.range(0.6, 1.4), { variant: 4, sy: rng.range(0.5, 0.8), bury: 0.25 });
  }
  void clamp;
}
