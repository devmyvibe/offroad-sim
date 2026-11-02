import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { mulberry32 } from '../core/Random';

/** Seeded simplex noise with fbm / ridged helpers. */
export class Noise {
  private s: SimplexNoise;
  constructor(seed: number) {
    const rnd = mulberry32(seed);
    this.s = new SimplexNoise({ random: rnd });
  }

  n2(x: number, y: number): number { return this.s.noise(x, y); }

  /** Fractal Brownian motion, output roughly in [-1, 1]. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.s.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged multifractal, output in [0, 1], sharp crests. */
  ridged(x: number, y: number, octaves = 4, lacunarity = 2.1, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0, weight = 1;
    for (let i = 0; i < octaves; i++) {
      let n = 1 - Math.abs(this.s.noise(x * freq, y * freq));
      n *= n * weight;
      weight = Math.min(1, Math.max(0, n * 2));
      sum += n * amp; norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Seamless tileable 2D noise over a unit square via 4D torus mapping. */
  tile(u: number, v: number, scale = 1): number {
    const a = u * Math.PI * 2, b = v * Math.PI * 2;
    const r = scale / (Math.PI * 2);
    return this.s.noise4d(Math.cos(a) * r, Math.sin(a) * r, Math.cos(b) * r, Math.sin(b) * r);
  }

  tileFbm(u: number, v: number, scale = 1, octaves = 4): number {
    let amp = 1, freq = scale, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.tile(u, v, freq);
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  }
}

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
