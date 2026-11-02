import * as THREE from 'three';
import { TROOPER } from './TrooperSpec';

/**
 * Procedural stand-in for the Isuzu Trooper: boxy two-box SUV with the
 * proportions of a UBS69 (LWB). Local +Z is forward, origin = chassis origin.
 * Built to be swapped for a GLB later: `TrooperVisual` only needs `root` and
 * `wheels[4]` (FL, FR, RL, RR) with the wheel pivot at the hub.
 */
export interface VehicleVisual {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  steeringWheel?: THREE.Object3D;
  /** cockpit camera anchor (driver's eyes) */
  eye: THREE.Object3D;
  headlights: THREE.SpotLight[];
}

export function buildTrooperVisual(): VehicleVisual {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x2e5a3f, metalness: 0.55, roughness: 0.38, envMapIntensity: 1.2 });
  const paintLower = new THREE.MeshStandardMaterial({ color: 0xc9c3b2, metalness: 0.3, roughness: 0.55 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.1, roughness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9, roughness: 0.25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1d2a33, metalness: 0.2, roughness: 0.08, transmission: 0, transparent: true, opacity: 0.82, envMapIntensity: 1.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.7, roughness: 0.4 });
  const lightLens = new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xffe9b0, emissiveIntensity: 0.25, roughness: 0.2 });
  const tailLens = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0x660000, emissiveIntensity: 0.4, roughness: 0.3 });

  const box = (w: number, h: number, l: number, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = root): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };

  const W = 1.74, L = 4.62;
  // Lower body: sills + doors, two-tone like many Troopers.
  box(W, 0.34, L - 0.3, paintLower, 0, -0.17, 0.05);
  // Main body (belt line).
  box(W, 0.42, L, paint, 0, 0.17, 0.05);
  // Hood slope: slightly lower front section.
  box(W - 0.08, 0.12, 1.1, paint, 0, 0.42, 1.65);
  // Greenhouse (glass) behind the hood, with pillars and a roof.
  const ghL = 3.05, ghZ = -0.45, ghY = 0.72;
  box(W - 0.16, 0.5, ghL, glass, 0, ghY, ghZ);
  const pillar = (x: number, z: number) => box(0.07, 0.52, 0.09, black, x, ghY, z);
  for (const x of [-(W / 2 - 0.1), W / 2 - 0.1]) { pillar(x, ghZ + ghL / 2 - 0.05); pillar(x, ghZ - ghL / 2 + 0.05); pillar(x, ghZ + 0.35); pillar(x, ghZ - 0.8); }
  box(W - 0.1, 0.07, ghL + 0.05, paint, 0, ghY + 0.28, ghZ);
  // Roof rack.
  for (const x of [-0.6, 0.6]) box(0.05, 0.08, 2.4, black, x, ghY + 0.36, ghZ - 0.1);
  for (const z of [-1.5, -0.6, 0.3, 1.0]) box(1.25, 0.04, 0.04, black, 0, ghY + 0.36, ghZ - 0.1 + z);
  // Bumpers.
  box(W + 0.06, 0.18, 0.22, black, 0, -0.32, L / 2 + 0.05);
  box(W + 0.06, 0.18, 0.2, black, 0, -0.32, -L / 2 + 0.05);
  // Grille, headlights, indicators.
  box(0.9, 0.22, 0.04, black, 0, 0.14, L / 2 + 0.06);
  for (const x of [-0.62, 0.62]) box(0.3, 0.16, 0.05, lightLens, x, 0.16, L / 2 + 0.06);
  for (const x of [-0.55, 0.55]) box(0.24, 0.08, 0.05, tailLens, x, 0.05, -L / 2 + 0.03);
  // Spare wheel on the tailgate.
  const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 24), rubber);
  spare.rotation.x = Math.PI / 2; spare.position.set(0.45, 0.2, -L / 2 - 0.1); spare.castShadow = true; root.add(spare);
  // Mirrors.
  for (const x of [-(W / 2 + 0.12), W / 2 + 0.12]) box(0.08, 0.14, 0.2, black, x, 0.55, 0.95);
  // Snorkel on the right A-pillar.
  const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 10), black);
  snorkel.position.set(W / 2 + 0.03, 0.7, 1.05); snorkel.castShadow = true; root.add(snorkel);
  // Fender flares over the wheels.
  for (const x of [-(W / 2 + 0.04), W / 2 + 0.04]) for (const z of [TROOPER.wheelbase / 2, -TROOPER.wheelbase / 2]) box(0.1, 0.12, 1.0, black, x, -0.1, z);
  // Chrome exhaust tip.
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), chrome);
  exhaust.rotation.x = Math.PI / 2; exhaust.position.set(-0.6, -0.45, -L / 2 + 0.05); root.add(exhaust);

  // Wheels: tire + rim + hub, axis along X.
  const wheels: THREE.Object3D[] = [];
  // Cylinder axis Y → X so the wheel spins about local X.
  const tireGeo = new THREE.CylinderGeometry(TROOPER.wheelRadius, TROOPER.wheelRadius, TROOPER.wheelWidth, 28).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.23, 0.23, TROOPER.wheelWidth + 0.02, 16).rotateZ(Math.PI / 2);
  const lugGeo = new THREE.BoxGeometry(TROOPER.wheelWidth + 0.03, 0.05, 0.12);
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, rubber); tire.castShadow = true;
    const r = new THREE.Mesh(rimGeo, rim);
    spin.add(tire, r);
    // Tread lugs around the tyre give the rotation a visual cue.
    for (let k = 0; k < 14; k++) {
      const lug = new THREE.Mesh(lugGeo, rubber);
      const a = (k / 14) * Math.PI * 2;
      lug.position.set(0, Math.cos(a) * TROOPER.wheelRadius, Math.sin(a) * TROOPER.wheelRadius);
      lug.rotation.x = -a;
      spin.add(lug);
    }
    pivot.add(spin);
    root.add(pivot);
    wheels.push(pivot);
  }

  // Interior: seats, dash and steering wheel (visible through glass and in cockpit view).
  box(1.5, 0.3, 0.5, black, 0, 0.5, 0.75);
  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 10, 28), black);
  steeringWheel.position.set(-0.42, 0.62, 0.55); steeringWheel.rotation.x = -1.2; root.add(steeringWheel);
  for (const x of [-0.42, 0.42]) { box(0.5, 0.25, 0.5, black, x, 0.4, -0.05); box(0.5, 0.5, 0.15, black, x, 0.7, -0.32); }

  const eye = new THREE.Object3D(); eye.position.set(-0.42, 0.98, 0.15); root.add(eye);

  const headlights: THREE.SpotLight[] = [];
  for (const x of [-0.62, 0.62]) {
    const l = new THREE.SpotLight(0xfff0d0, 0, 60, 0.5, 0.5, 1.2);
    l.position.set(x, 0.16, L / 2); l.target.position.set(x, -0.6, L / 2 + 12);
    root.add(l, l.target); headlights.push(l);
  }

  return { root, wheels, steeringWheel, eye, headlights };
}
