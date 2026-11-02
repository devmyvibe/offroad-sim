import * as THREE from 'three';
import type { TerrainQuery } from '../terrain/Heightmap';

/** Spring-damped third-person camera that stays above the terrain. */
export class ChaseCamera {
  distance = 7.5;
  height = 2.6;
  lookHeight = 1.1;
  stiffness = 5.5;
  private pos = new THREE.Vector3();
  private heading = new THREE.Vector3(0, 0, 1);
  private initialized = false;
  private tmp = new THREE.Vector3();
  private look = new THREE.Vector3();
  /** manual orbit offset (touch drag / mouse) in radians, decays back to 0 */
  orbit = 0;
  /** when set, the orbit holds this angle instead of decaying (debug views) */
  orbitLock: number | null = null;
  /** extra elevation (radians) and distance multiplier from mouse look */
  pitchOffset = 0;
  zoom = 1;

  constructor(private camera: THREE.PerspectiveCamera, private hm: TerrainQuery) {}

  snap(): void { this.initialized = false; }

  update(dt: number, targetPos: THREE.Vector3, forward: THREE.Vector3, velocity: THREE.Vector3): void {
    // Heading follows the velocity when moving, the body when stopped; never flips when reversing fast.
    const speed = velocity.length();
    const horizF = this.tmp.set(forward.x, 0, forward.z).normalize();
    if (speed > 2.5) {
      const hv = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
      if (hv.dot(horizF) < 0) hv.negate();
      horizF.lerp(hv, 0.5).normalize();
    }
    const k = this.initialized ? Math.min(1, dt * 3.5) : 1;
    this.heading.lerp(horizF, k).normalize();
    if (this.orbitLock !== null) this.orbit = this.orbitLock;
    else if (this.orbit !== 0) {
      this.orbit *= Math.max(0, 1 - dt * 1.2);
      if (Math.abs(this.orbit) < 0.01) this.orbit = 0;
    }
    const dir = this.heading.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.orbit);
    const dynDist = (this.distance + Math.min(3, speed * 0.08)) * this.zoom;
    const radius = Math.hypot(dynDist, this.height * this.zoom);
    const elev = Math.max(-0.05, Math.min(1.35, Math.atan2(this.height, this.distance) + this.pitchOffset));
    const desired = targetPos.clone().addScaledVector(dir, -Math.cos(elev) * radius);
    desired.y = targetPos.y + Math.sin(elev) * radius;
    // Keep above ground.
    const ground = this.hm.sample(desired.x, desired.z);
    if (desired.y < ground + 1.2) desired.y = ground + 1.2;

    if (!this.initialized) { this.pos.copy(desired); this.initialized = true; }
    else this.pos.lerp(desired, Math.min(1, dt * this.stiffness));

    this.camera.position.copy(this.pos);
    this.look.copy(targetPos); this.look.y += this.lookHeight;
    this.camera.lookAt(this.look);
  }
}
