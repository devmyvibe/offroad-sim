import * as THREE from 'three';
import { Noise, clamp } from './Noise';

export interface SurfaceTextures {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
}

/**
 * Tileable procedural surfaces generated on the CPU at startup. They stand in
 * for CC0 photo textures (Poly Haven) which can be dropped into /public later
 * and loaded with the same interface.
 */
export class ProceduralTextures {
  readonly sand: SurfaceTextures;
  readonly rock: SurfaceTextures;
  readonly gravel: SurfaceTextures;
  readonly macro: THREE.DataTexture;

  constructor(size = 256, anisotropy = 4) {
    const noise = new Noise(99);
    this.sand = makeSurface(size, anisotropy, (u, v) => {
      // fine wind ripples + grain
      const warp = 0.08 * tileFbm(noise, u, v, 3, 2);
      const ripple = Math.sin((v + warp) * Math.PI * 2 * 14) * 0.5 + 0.5;
      const grain = tileFbm(noise, u * 3 + 0.3, v * 3, 24, 3) * 0.5 + 0.5;
      const h = 0.55 * ripple * ripple + 0.45 * grain;
      return { h, color: lerpColor([0.76, 0.60, 0.40], [0.58, 0.43, 0.27], 0.6 * (1 - h) + 0.25 * grain) };
    }, 0.6);
    this.rock = makeSurface(size, anisotropy, (u, v) => {
      const cracks = 1 - Math.abs(tileFbm(noise, u + 5, v + 2, 6, 3));
      const plates = tileFbm(noise, u + 9, v + 4, 3, 2) * 0.5 + 0.5;
      const h = clamp(0.6 * plates + 0.5 * cracks * cracks - 0.1, 0, 1);
      const tint = tileFbm(noise, u + 1, v + 8, 2, 2) * 0.5 + 0.5;
      return { h, color: lerpColor([0.5, 0.42, 0.33], [0.36, 0.3, 0.25], 0.7 * (1 - h) + 0.3 * tint) };
    }, 1.6);
    this.gravel = makeSurface(size, anisotropy, (u, v) => {
      const pebbles = tileFbm(noise, u + 3, v + 7, 16, 3) * 0.5 + 0.5;
      const dust = tileFbm(noise, u + 6, v + 1, 4, 2) * 0.5 + 0.5;
      const h = clamp(0.7 * pebbles * pebbles + 0.3 * dust, 0, 1);
      return { h, color: lerpColor([0.73, 0.6, 0.42], [0.55, 0.45, 0.33], 0.8 * (1 - pebbles)) };
    }, 1.0);
    this.macro = makeMacro(size, noise);
  }

  dispose(): void {
    for (const s of [this.sand, this.rock, this.gravel]) { s.albedo.dispose(); s.normal.dispose(); }
    this.macro.dispose();
  }
}

/* ---------- helpers ---------- */

type RGB = [number, number, number];
const lerpColor = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Tileable fbm on the unit square using the 4-corner blend trick (cheaper than 4D noise). */
function tileFbm(noise: Noise, u: number, v: number, freq: number, octaves: number): number {
  u -= Math.floor(u); v -= Math.floor(v);
  let amp = 1, f = freq, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const a = noise.n2(u * f, v * f), b = noise.n2((u - 1) * f, v * f);
    const c = noise.n2(u * f, (v - 1) * f), d = noise.n2((u - 1) * f, (v - 1) * f);
    const n = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    sum += n * amp; norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

function makeSurface(size: number, anisotropy: number, fn: (u: number, v: number) => { h: number; color: RGB }, bumpStrength: number): SurfaceTextures {
  const heights = new Float32Array(size * size);
  const albedo = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const { h, color } = fn(x / size, y / size);
    const k = y * size + x;
    heights[k] = h;
    albedo[k * 4] = color[0] * 255; albedo[k * 4 + 1] = color[1] * 255; albedo[k * 4 + 2] = color[2] * 255; albedo[k * 4 + 3] = 255;
  }
  const normal = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hl = heights[y * size + ((x - 1 + size) % size)], hr = heights[y * size + ((x + 1) % size)];
    const hd = heights[((y - 1 + size) % size) * size + x], hu = heights[((y + 1) % size) * size + x];
    let nx = (hl - hr) * bumpStrength * size * 0.02, ny = (hd - hu) * bumpStrength * size * 0.02, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * size + x) * 4;
    normal[k] = (nx * 0.5 + 0.5) * 255; normal[k + 1] = (ny * 0.5 + 0.5) * 255; normal[k + 2] = (nz * 0.5 + 0.5) * 255; normal[k + 3] = 255;
  }
  const a = new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat);
  a.colorSpace = THREE.SRGBColorSpace;
  const n = new THREE.DataTexture(normal, size, size, THREE.RGBAFormat);
  for (const t of [a, n]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = anisotropy; t.needsUpdate = true;
  }
  return { albedo: a, normal: n };
}

function makeMacro(size: number, noise: Noise): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = tileFbm(noise, x / size + 11, y / size + 3, 2, 4) * 0.5 + 0.5;
    const k = (y * size + x) * 4;
    data[k] = data[k + 1] = data[k + 2] = n * 255; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
