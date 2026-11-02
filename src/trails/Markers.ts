import * as THREE from 'three';
import type { Heightmap, Polyline } from '../terrain/Heightmap';
import type { Checkpoint } from './TrailRunner';

/** Trail stakes along a path and checkpoint gates (two poles + banner). */
export class TrailMarkers {
  readonly group = new THREE.Group();
  private gates: THREE.Group[] = [];
  private gateMats: THREE.MeshStandardMaterial[] = [];
  private t = 0;

  constructor(hm: Heightmap, path: Polyline, checkpoints: Checkpoint[], color: number) {
    // Stakes every 30 m, offset to the right of the trail.
    const count = Math.floor(path.length / 30);
    const stake = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.8 }), count);
    const band = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.25 }), count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const t = i * 30 + 15;
      const p = path.at(t), tg = path.tangent(t);
      const x = p.x + tg.z * 5.5, z = p.z - tg.x * 5.5; // right side
      const y = hm.sample(x, z);
      m.makeTranslation(x, y + 0.6, z); stake.setMatrixAt(i, m);
      m.makeTranslation(x, y + 1.15, z); band.setMatrixAt(i, m);
    }
    stake.castShadow = true;
    this.group.add(stake, band);

    // Gates.
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.7 });
    const bannerGeo = new THREE.PlaneGeometry(7.5, 0.9);
    for (const cp of checkpoints) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.15, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      this.gateMats.push(mat);
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        const x = s * 4; pole.position.set(x, 1.6 + (hm.sample(cp.x + Math.cos(cp.heading) * x, cp.z - Math.sin(cp.heading) * x) - hm.sample(cp.x, cp.z)), 0);
        pole.castShadow = true; g.add(pole);
      }
      const banner = new THREE.Mesh(bannerGeo, mat); banner.position.set(0, 3.1, 0); g.add(banner);
      g.position.set(cp.x, hm.sample(cp.x, cp.z), cp.z);
      g.rotation.y = cp.heading;
      this.group.add(g); this.gates.push(g);
    }
  }

  /** Highlight the next gate, dim passed ones. */
  update(dt: number, nextIndex: number): void {
    this.t += dt;
    for (let i = 0; i < this.gates.length; i++) {
      const m = this.gateMats[i];
      if (i < nextIndex) { m.emissiveIntensity = 0; m.opacity = 0.35; }
      else if (i === nextIndex) { m.emissiveIntensity = 0.5 + 0.4 * Math.sin(this.t * 4); m.opacity = 1; }
      else { m.emissiveIntensity = 0.15; m.opacity = 0.9; }
    }
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
  }
}
