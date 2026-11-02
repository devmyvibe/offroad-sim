import * as THREE from 'three';

/** Debug fly camera: right-drag to look, WASD+QE to move (while active). */
export class FreeCamera {
  yaw = 0;
  pitch = -0.3;
  speed = 40;
  private keys = new Set<string>();
  private dragging = false;
  private active = false;

  constructor(private camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    dom.addEventListener('pointerdown', (e) => { if (e.button === 2 && this.active) { this.dragging = true; dom.requestPointerLock?.(); } });
    window.addEventListener('pointerup', () => { if (this.dragging) { this.dragging = false; document.exitPointerLock?.(); } });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0025, -1.5, 1.5);
    });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  setActive(on: boolean): void { this.active = on; }

  update(dt: number): void {
    if (!this.active) return;
    const c = this.camera;
    c.rotation.set(0, 0, 0);
    c.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion);
    if (this.keys.has('KeyW')) dir.add(fwd);
    if (this.keys.has('KeyS')) dir.sub(fwd);
    if (this.keys.has('KeyD')) dir.add(right);
    if (this.keys.has('KeyA')) dir.sub(right);
    if (this.keys.has('KeyE')) dir.y += 1;
    if (this.keys.has('KeyQ')) dir.y -= 1;
    const sp = this.keys.has('ShiftLeft') ? this.speed * 4 : this.speed;
    if (dir.lengthSq() > 0) c.position.addScaledVector(dir.normalize(), sp * dt);
  }
}
