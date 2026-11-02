import type { Input } from '../core/Input';
import type { I18n } from './i18n';

/**
 * On-screen controls for phones/tablets: a horizontal steering slider on the
 * left, throttle/brake pedals on the right, and small action buttons on top.
 * Everything goes through Input.setOverride so gameplay never sees "touch".
 */
export class TouchControls {
  readonly el: HTMLElement;
  active = false;
  private steer = 0;
  private steerPointer: number | null = null;
  private steerOriginX = 0;
  private throttle = 0;
  private brake = 0;
  private handbrake = false;
  private held = new Map<number, string>();
  private invert = false;

  constructor(parent: HTMLElement, private input: Input, i18n: I18n) {
    this.el = document.createElement('div');
    this.el.className = 'touch hidden';
    this.el.innerHTML = `
      <div class="t-top">
        <button class="t-btn" data-act="pause">☰</button>
        <button class="t-btn" data-act="camera">📷</button>
        <button class="t-btn" data-act="reset">↺</button>
        <button class="t-btn wide" data-act="driveModeDown">◀ 2H</button>
        <button class="t-btn wide" data-act="driveModeUp">4L ▶</button>
      </div>
      <div class="t-steer" id="t-steer"><div class="t-track"><div class="t-knob" id="t-knob"></div></div><div class="t-hint" data-k="hud.steer"></div></div>
      <div class="t-pedals">
        <div class="t-pedal brake" data-pedal="brake">▼</div>
        <div class="t-pedal hb" data-pedal="handbrake">P</div>
        <div class="t-pedal gas" data-pedal="throttle">▲</div>
      </div>`;
    parent.appendChild(this.el);
    void i18n;

    // Action buttons.
    this.el.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); input.fire(b.dataset.act as never); });
    });
    // Pedals: hold.
    this.el.querySelectorAll<HTMLElement>('[data-pedal]').forEach((p) => {
      const name = p.dataset.pedal!;
      const down = (e: PointerEvent) => { e.preventDefault(); this.held.set(e.pointerId, name); p.classList.add('on'); try { p.setPointerCapture(e.pointerId); } catch { /* synthetic */ } };
      const up = (e: PointerEvent) => { if (this.held.get(e.pointerId) === name) { this.held.delete(e.pointerId); p.classList.remove('on'); } };
      p.addEventListener('pointerdown', down); p.addEventListener('pointerup', up); p.addEventListener('pointercancel', up); p.addEventListener('lostpointercapture', up);
    });
    // Steering slider: relative drag from the first touch point, full lock at ±110 px.
    const steer = this.el.querySelector<HTMLElement>('#t-steer')!;
    steer.addEventListener('pointerdown', (e) => { e.preventDefault(); this.steerPointer = e.pointerId; this.steerOriginX = e.clientX - this.steer * 110; try { steer.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
    steer.addEventListener('pointermove', (e) => { if (e.pointerId !== this.steerPointer) return; this.steer = Math.max(-1, Math.min(1, (e.clientX - this.steerOriginX) / 110)); });
    const end = (e: PointerEvent) => { if (e.pointerId === this.steerPointer) this.steerPointer = null; };
    steer.addEventListener('pointerup', end); steer.addEventListener('pointercancel', end); steer.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', () => { this.held.clear(); this.steerPointer = null; });
  }

  setInvert(on: boolean): void { this.invert = on; }

  show(on: boolean): void {
    this.active = on;
    this.el.classList.toggle('hidden', !on);
    if (!on) { this.held.clear(); this.steerPointer = null; this.steer = 0; this.input.clearOverride('steer', 'throttle', 'brake', 'reverse', 'handbrake'); }
  }

  /** Call every frame while active. */
  update(dt: number): void {
    if (!this.active) return;
    // Auto-centre when released.
    if (this.steerPointer === null && this.steer !== 0) { const k = Math.min(1, dt * 7); this.steer += (0 - this.steer) * k; if (Math.abs(this.steer) < 0.02) this.steer = 0; }
    const knob = this.el.querySelector<HTMLElement>('#t-knob')!;
    knob.style.transform = `translateX(${this.steer * 70}px)`;
    const names = new Set(this.held.values());
    this.throttle = names.has('throttle') ? 1 : 0;
    this.brake = names.has('brake') ? 1 : 0;
    this.handbrake = names.has('handbrake');
    const steerVal = (this.invert ? -1 : 1) * this.steer;
    this.input.setOverride({ steer: steerVal, throttle: this.throttle, brake: this.brake, reverse: this.brake > 0, handbrake: this.handbrake });
  }
}
