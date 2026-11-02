import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TROOPER } from './TrooperSpec';

/**
 * Procedural Isuzu Trooper (2nd gen, UBS, LWB) built from reference photos:
 * two-box body with a tall glasshouse, flat hood with a turbo scoop, square
 * headlamps flanked by amber indicators, black grille with a chrome frame,
 * grey lower cladding, wheel-arch flares, side steps and roof rails.
 * Local +Z is forward, origin = chassis origin (~0.85 m above ground at rest).
 */
export interface VehicleVisual {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  steeringWheel?: THREE.Object3D;
  eye: THREE.Object3D;
  headlights: THREE.SpotLight[];
}

export function buildTrooperVisual(): VehicleVisual {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x2f5c47, metalness: 0.6, roughness: 0.35, envMapIntensity: 1.3 });
  const cladding = new THREE.MeshStandardMaterial({ color: 0x5e5b57, metalness: 0.05, roughness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.1, roughness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.95, roughness: 0.2, envMapIntensity: 1.5 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x18262f, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.8, envMapIntensity: 1.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.95 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.85, roughness: 0.35 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xf4f1e6, emissive: 0xfff0c0, emissiveIntensity: 0.2, roughness: 0.25 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xe88a1a, emissive: 0xd06a00, emissiveIntensity: 0.3, roughness: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb01818, emissive: 0x600000, emissiveIntensity: 0.35, roughness: 0.3 });
  const interior = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.95 });

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = root): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const box = (w: number, h: number, l: number, m: THREE.Material, x = 0, y = 0, z = 0, r = 0, parent: THREE.Object3D = root): THREE.Mesh =>
    add(r > 0 ? new RoundedBoxGeometry(w, h, l, 3, r) : new BoxGeometry(w, h, l), m, x, y, z, parent);

  const W = 1.75, L = 4.70, HW = W / 2;
  const floorY = -0.42, beltY = 0.20, roofY = 1.00;

  // --- Body shell ---
  box(W, beltY - floorY, L - 0.1, paint, 0, (beltY + floorY) / 2, 0.0, 0.06);            // main tub to the belt line
  box(W + 0.02, 0.27, L - 0.08, cladding, 0, floorY + 0.135, 0.0, 0.03);                   // grey lower cladding band
  // Hood (slightly sloped) and scoop.
  const hood = box(W - 0.1, 0.1, 1.45, paint, 0, beltY + 0.02, 1.62, 0.04); hood.rotation.x = 0.035;
  box(0.42, 0.07, 0.32, paint, 0.2, beltY + 0.1, 1.55, 0.02);                              // turbo scoop
  box(0.3, 0.03, 0.05, black, 0.2, beltY + 0.12, 1.72);                                   // scoop opening
  // Cabin: glass house + pillars + roof.
  const cabZ0 = -2.28, cabZ1 = 0.42; // rear to windshield base
  const cabL = cabZ1 - cabZ0, cabC = (cabZ0 + cabZ1) / 2;
  box(W - 0.14, roofY - beltY - 0.02, cabL, glass, 0, (roofY + beltY) / 2, cabC);         // side/rear glass volume
  // Windshield: raked box from the hood to the roof front edge.
  const ws = box(W - 0.16, 0.06, 0.95, glass, 0, (roofY + beltY) / 2 + 0.02, cabZ1 + 0.26); ws.rotation.x = Math.atan2(roofY - beltY, 0.55);
  // A-pillars (raked), B, C, D pillars.
  for (const s of [-1, 1]) {
    const a = box(0.08, 0.9, 0.09, black, s * (HW - 0.1), (roofY + beltY) / 2 + 0.02, cabZ1 + 0.26); a.rotation.x = Math.atan2(roofY - beltY, 0.55);
    box(0.07, roofY - beltY, 0.09, black, s * (HW - 0.08), (roofY + beltY) / 2, -0.38);   // B
    box(0.07, roofY - beltY, 0.09, black, s * (HW - 0.08), (roofY + beltY) / 2, -1.42);   // C
    box(0.07, roofY - beltY, 0.22, paint, s * (HW - 0.08), (roofY + beltY) / 2, cabZ0 + 0.12); // D (painted, thick)
    // Belt-line trim and door seams.
    box(0.012, beltY - floorY - 0.25, 0.01, black, s * (HW + 0.005), (beltY + floorY) / 2 + 0.12, 0.78);
    box(0.012, beltY - floorY - 0.25, 0.01, black, s * (HW + 0.005), (beltY + floorY) / 2 + 0.12, -0.38);
    box(0.012, beltY - floorY - 0.25, 0.01, black, s * (HW + 0.005), (beltY + floorY) / 2 + 0.12, -1.42);
    // Door handles.
    box(0.02, 0.035, 0.14, chrome, s * (HW + 0.01), beltY - 0.12, 0.2);
    box(0.02, 0.035, 0.14, chrome, s * (HW + 0.01), beltY - 0.12, -0.9);
    // Mirrors on the doors.
    box(0.08, 0.16, 0.2, black, s * (HW + 0.13), beltY + 0.26, 0.62, 0.02);
    box(0.02, 0.12, 0.16, chrome, s * (HW + 0.17), beltY + 0.26, 0.62);
    // Side steps.
    box(0.28, 0.05, 2.0, cladding, s * (HW + 0.1), floorY - 0.06, -0.3, 0.02);
    // Wheel-arch flares: half torus over each wheel.
    for (const wz of [TROOPER.wheelbase / 2, -TROOPER.wheelbase / 2]) {
      const flare = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 8, 18, Math.PI), cladding);
      flare.position.set(s * (HW + 0.02), TROOPER.wheelY - 0.3, wz); flare.rotation.y = Math.PI / 2; flare.castShadow = true; root.add(flare);
    }
    // Roof rails.
    box(0.06, 0.07, 2.5, black, s * 0.68, roofY + 0.09, cabC + 0.05, 0.02);
  }
  box(W - 0.1, 0.06, cabL + 0.25, paint, 0, roofY + 0.0, cabC + 0.1, 0.03);              // roof
  for (const z of [-1.6, -0.4, 0.8]) box(1.42, 0.04, 0.05, black, 0, roofY + 0.11, z);      // rail crossbars
  box(0.9, 0.05, 0.05, black, 0, roofY + 0.03, cabZ1 + 0.52);                               // windshield header

  // --- Front fascia ---
  const fz = L / 2 - 0.02;
  box(0.86, 0.2, 0.05, black, 0, beltY - 0.17, fz);                                        // grille
  box(0.9, 0.03, 0.06, chrome, 0, beltY - 0.06, fz); box(0.9, 0.03, 0.06, chrome, 0, beltY - 0.28, fz);
  for (const s of [-1, 1]) {
    box(0.03, 0.22, 0.06, chrome, s * 0.45, beltY - 0.17, fz);
    box(0.28, 0.17, 0.05, lamp, s * 0.62, beltY - 0.17, fz);                              // headlamp
    box(0.14, 0.17, 0.05, amber, s * 0.84, beltY - 0.17, fz);                             // indicator
    box(0.16, 0.06, 0.04, lamp, s * 0.58, floorY + 0.1, fz + 0.1);                        // fog lamp
  }
  box(0.08, 0.08, 0.03, red, 0, beltY - 0.17, fz + 0.03);                                 // badge
  box(W + 0.08, 0.2, 0.2, cladding, 0, floorY + 0.1, fz + 0.02, 0.03);                    // front bumper
  box(W - 0.3, 0.04, 0.5, black, 0, floorY - 0.02, fz - 0.2);                             // skid pan
  // --- Rear ---
  const rz = -L / 2 + 0.03;
  box(W + 0.08, 0.2, 0.18, cladding, 0, floorY + 0.1, rz, 0.03);                          // rear bumper
  for (const s of [-1, 1]) { box(0.14, 0.34, 0.04, red, s * 0.76, beltY - 0.17, rz - 0.02); box(0.14, 0.1, 0.045, amber, s * 0.76, beltY + 0.06, rz - 0.02); }
  box(0.22, 0.14, 0.03, chrome, 0, beltY - 0.1, rz - 0.02);                               // plate holder
  box(0.3, 0.05, 0.04, black, 0, roofY - 0.04, rz - 0.02);                                // rear wiper base
  // Snorkel on the right A-pillar.
  const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 10), black);
  snorkel.position.set(HW + 0.02, beltY + 0.45, 0.9); snorkel.castShadow = true; root.add(snorkel);
  const snorkelHead = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.18, 10), black);
  snorkelHead.rotation.x = Math.PI / 2; snorkelHead.position.set(HW + 0.02, roofY - 0.02, 0.98); root.add(snorkelHead);
  // Wipers, antenna.
  for (const x of [-0.35, 0.25]) { const w = box(0.02, 0.015, 0.5, black, x, beltY + 0.08, 1.0); w.rotation.y = 0.3; }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.7, 5), black); ant.position.set(-0.7, beltY + 0.4, 1.3); root.add(ant);

  // --- Wheels: tyre + shoulder rings + 5-spoke rim ---
  const wheels: THREE.Object3D[] = [];
  const R = TROOPER.wheelRadius, TW = TROOPER.wheelWidth;
  const tireGeo = new THREE.CylinderGeometry(R, R, TW, 32).rotateZ(Math.PI / 2);
  const shoulderGeo = new THREE.TorusGeometry(R - 0.05, 0.05, 8, 32).rotateY(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.235, 0.235, TW * 0.5, 20).rotateZ(Math.PI / 2);
  const dishGeo = new THREE.CylinderGeometry(0.22, 0.17, 0.08, 20).rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.03, 0.2, 0.06);
  const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12).rotateZ(Math.PI / 2);
  const lugGeo = new THREE.BoxGeometry(TW + 0.03, 0.045, 0.1);
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    const spin = new THREE.Group();
    const side = i % 2 === 0 ? -1 : 1; // -x = right side of the truck (local +x is left)
    add(tireGeo, rubber, 0, 0, 0, spin);
    for (const sx of [-1, 1]) add(shoulderGeo, rubber, sx * TW * 0.5, 0, 0, spin);
    add(rimGeo, black, 0, 0, 0, spin);
    add(dishGeo, rim, side * (TW * 0.5 - 0.02), 0, 0, spin);
    for (let k = 0; k < 5; k++) {
      const spoke = add(spokeGeo, rim, side * (TW * 0.5 + 0.02), 0, 0, spin);
      spoke.rotation.x = (k / 5) * Math.PI * 2; spoke.position.y = Math.cos(spoke.rotation.x) * 0.1; spoke.position.z = -Math.sin(spoke.rotation.x) * 0.1;
    }
    add(hubGeo, rim, side * (TW * 0.5 + 0.03), 0, 0, spin);
    for (let k = 0; k < 18; k++) {
      const lug = new THREE.Mesh(lugGeo, rubber);
      const a = (k / 18) * Math.PI * 2;
      lug.position.set(0, Math.cos(a) * R, Math.sin(a) * R); lug.rotation.x = -a; spin.add(lug);
    }
    pivot.add(spin); root.add(pivot); wheels.push(pivot);
  }

  // --- Interior (seen through the glass and from the cockpit camera) ---
  box(1.5, 0.28, 0.5, interior, 0, beltY + 0.2, 0.55);                                   // dashboard
  box(1.5, 0.08, 0.35, interior, 0, beltY + 0.36, 0.7);                                   // dash top
  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 28), black);
  steeringWheel.position.set(-0.42, beltY + 0.42, 0.42); steeringWheel.rotation.x = -1.15; root.add(steeringWheel);
  for (const x of [-0.42, 0.42]) { box(0.5, 0.22, 0.5, interior, x, beltY + 0.1, -0.1); box(0.5, 0.55, 0.14, interior, x, beltY + 0.45, -0.38); }
  for (const x of [-0.42, 0.42]) { box(0.5, 0.2, 0.45, interior, x, beltY + 0.1, -1.05); box(0.5, 0.5, 0.12, interior, x, beltY + 0.42, -1.3); }
  const eye = new THREE.Object3D(); eye.position.set(-0.42, beltY + 0.62, 0.05); root.add(eye);

  const headlights: THREE.SpotLight[] = [];
  for (const x of [-0.62, 0.62]) {
    const l = new THREE.SpotLight(0xfff0d0, 0, 60, 0.5, 0.5, 1.2);
    l.position.set(x, beltY - 0.17, fz); l.target.position.set(x, -0.6, fz + 12);
    root.add(l, l.target); headlights.push(l);
  }
  return { root, wheels, steeringWheel, eye, headlights };
}

class BoxGeometry extends THREE.BoxGeometry {}
