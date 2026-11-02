import * as THREE from 'three';
import type { ProceduralTextures, SurfaceTextures } from './ProceduralTextures';

export interface SurfaceTextureSet {
  sand: SurfaceTextures; rock: SurfaceTextures; gravel: SurfaceTextures; boulder: SurfaceTextures;
  macro: THREE.Texture;
}

/**
 * Photo textures from /public/textures (Poly Haven, CC0) layered
 * over the procedural set: the files stream in asynchronously and replace
 * the procedural maps as they arrive, so first paint never waits on them.
 * A missing file simply leaves the procedural map in place.
 */
export function loadSurfaceTextures(proc: ProceduralTextures, anisotropy: number, onUpdate: () => void, enabled = true): SurfaceTextureSet {
  const set: SurfaceTextureSet = {
    sand: { ...proc.sand }, rock: { ...proc.rock }, gravel: { ...proc.gravel }, boulder: { ...proc.rock }, macro: proc.macro,
  };
  if (!enabled) return set;
  const loader = new THREE.TextureLoader();
  const base = `${import.meta.env.BASE_URL}textures/`;
  const load = (file: string, srgb: boolean, apply: (t: THREE.Texture) => void): void => {
    loader.load(base + file, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
      apply(t); onUpdate();
    }, undefined, () => { /* keep procedural */ });
  };
  const pair = (name: 'sand' | 'gravel' | 'rock' | 'boulder'): void => {
    load(`${name}_diff.jpg`, true, (t) => { set[name] = { albedo: t, normal: set[name].normal }; });
    load(`${name}_nor.jpg`, false, (t) => { set[name] = { albedo: set[name].albedo, normal: t }; });
  };
  pair('sand'); pair('gravel'); pair('rock'); pair('boulder');
  return set;
}

/** Sobel normal map from an albedo's luminance (for photos that ship without one). */
export function normalFromAlbedo(tex: THREE.Texture, strength: number, anisotropy: number): THREE.DataTexture {
  const img = tex.image as HTMLImageElement;
  const size = 512;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!; g.drawImage(img, 0, 0, size, size);
  const px = g.getImageData(0, 0, size, size).data;
  const lum = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) lum[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
  // Light blur so JPEG noise doesn't become sparkle.
  const bl = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += lum[((y + dy + size) % size) * size + ((x + dx + size) % size)];
    bl[y * size + x] = s / 9;
  }
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = bl[y * size + ((x - 1 + size) % size)], r = bl[y * size + ((x + 1) % size)];
    const d = bl[((y - 1 + size) % size) * size + x], u = bl[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const k = (y * size + x) * 4;
    out[k] = (nx * 0.5 + 0.5) * 255; out[k + 1] = (ny * 0.5 + 0.5) * 255; out[k + 2] = (nz * 0.5 + 0.5) * 255; out[k + 3] = 255;
  }
  const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
