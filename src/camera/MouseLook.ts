/**
 * Drag on the 3D view (mouse or a finger on empty screen) to look around the
 * truck; mouse wheel / pinch to zoom. After letting go the view eases back
 * behind the truck, unless "hold" is on.
 */
export class MouseLook {
  yaw = 0;
  pitch = 0;
  zoom = 1;
  dragging = false;
  /** seconds since the last drag ended */
  idle = 99;
  private last = { x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) this.pinchDist = this.spread();
      this.dragging = true; this.last = { x: e.clientX, y: e.clientY };
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const d = this.spread();
        if (this.pinchDist > 0) this.zoom = clamp(this.zoom * (this.pinchDist / d), 0.5, 2.4);
        this.pinchDist = d;
        return;
      }
      const dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
      this.last = { x: e.clientX, y: e.clientY };
      this.yaw -= dx * 0.006;
      this.pitch = clamp(this.pitch + dy * 0.004, -0.35, 1.0);
    });
    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (this.pointers.size === 0) { this.dragging = false; this.idle = 0; }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = clamp(this.zoom * Math.exp(e.deltaY * 0.001), 0.5, 2.4); }, { passive: false });
    el.addEventListener('dblclick', () => this.reset());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private spread(): number {
    const p = [...this.pointers.values()];
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
  }

  reset(): void { this.yaw = 0; this.pitch = 0; this.idle = 99; }

  /** Ease the look offsets back to zero a moment after the user lets go. */
  update(dt: number, autoReturn: boolean): void {
    if (this.dragging) return;
    this.idle += dt;
    if (!autoReturn || this.idle < 1.5) return;
    const k = Math.min(1, dt * 1.6);
    this.yaw = wrap(this.yaw) * (1 - k);
    this.pitch *= 1 - k;
    if (Math.abs(this.yaw) < 0.002) this.yaw = 0;
    if (Math.abs(this.pitch) < 0.002) this.pitch = 0;
  }
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
