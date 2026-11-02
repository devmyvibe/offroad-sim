import type { I18n } from './i18n';
import { formatTime } from './i18n';
import type { VehicleTelemetry } from '../vehicle/Vehicle';

export interface HudRunInfo { timeMs: number; next: number; total: number; bearing: number | null; distance: number | null; }

/** In-game overlay: speed, gear, drive mode, inclinometer, timer, checkpoint compass, toasts. */
export class Hud {
  readonly el: HTMLElement;
  private speedEl!: HTMLElement; private gearEl!: HTMLElement; private modeEl!: HTMLElement; private rpmBar!: HTMLElement;
  private timeEl!: HTMLElement; private cpEl!: HTMLElement; private compass!: HTMLElement; private distEl!: HTMLElement; private runBox!: HTMLElement;
  private pitchEl!: HTMLElement; private rollEl!: HTMLElement; private truckIcon!: HTMLElement;
  private toastEl!: HTMLElement; private bigEl!: HTMLElement;
  private toastTimer = 0; private bigTimer = 0;
  private labels: HTMLElement[] = [];

  constructor(parent: HTMLElement, private i18n: I18n) {
    this.el = document.createElement('div');
    this.el.className = 'hud hidden';
    this.el.innerHTML = `
      <div class="hud-run">
        <div class="hud-time"><span class="lbl" data-k="hud.time"></span><span class="val" id="hud-time">0:00.0</span></div>
        <div class="hud-cp"><span class="lbl" data-k="hud.checkpoint"></span><span class="val" id="hud-cp">0/0</span></div>
        <div class="hud-compass"><div class="arrow" id="hud-arrow">➤</div><span id="hud-dist"></span></div>
      </div>
      <div class="hud-incl">
        <div class="truck" id="hud-truck">🚙</div>
        <div><span class="lbl" data-k="hud.pitch"></span> <span id="hud-pitch">0°</span></div>
        <div><span class="lbl" data-k="hud.roll"></span> <span id="hud-roll">0°</span></div>
      </div>
      <div class="hud-dash">
        <div class="hud-mode" id="hud-mode">4H</div>
        <div class="hud-speed"><span class="val" id="hud-speed">0</span><span class="lbl" data-k="hud.kmh"></span></div>
        <div class="hud-gear"><span class="lbl" data-k="hud.gear"></span><span class="val" id="hud-gear">1</span></div>
        <div class="hud-rpm"><div class="bar" id="hud-rpm"></div></div>
      </div>
      <div class="hud-toast" id="hud-toast"></div>
      <div class="hud-big" id="hud-big"></div>`;
    parent.appendChild(this.el);
    const q = (id: string) => this.el.querySelector<HTMLElement>('#' + id)!;
    this.speedEl = q('hud-speed'); this.gearEl = q('hud-gear'); this.modeEl = q('hud-mode'); this.rpmBar = q('hud-rpm');
    this.timeEl = q('hud-time'); this.cpEl = q('hud-cp'); this.compass = q('hud-arrow'); this.distEl = q('hud-dist'); this.runBox = this.el.querySelector('.hud-run')!;
    this.pitchEl = q('hud-pitch'); this.rollEl = q('hud-roll'); this.truckIcon = q('hud-truck');
    this.toastEl = q('hud-toast'); this.bigEl = q('hud-big');
    this.labels = Array.from(this.el.querySelectorAll<HTMLElement>('[data-k]'));
    this.relabel();
    i18n.onChange(() => this.relabel());
  }

  private relabel(): void { for (const l of this.labels) l.textContent = this.i18n.t(l.dataset.k!); }

  show(on: boolean): void { this.el.classList.toggle('hidden', !on); }

  toast(text: string, seconds = 2.5): void { this.toastEl.textContent = text; this.toastEl.classList.add('show'); this.toastTimer = seconds; }
  big(text: string, seconds = 1): void { this.bigEl.textContent = text; this.bigEl.classList.add('show'); this.bigTimer = seconds; }

  update(dt: number, t: VehicleTelemetry, run: HudRunInfo | null): void {
    this.speedEl.textContent = String(Math.round(t.speedKmh));
    this.gearEl.textContent = t.gear < 0 ? this.i18n.t('hud.gearR') : t.gear === 0 ? this.i18n.t('hud.gearN') : String(t.gear);
    this.modeEl.textContent = t.mode;
    this.modeEl.dataset.mode = t.mode;
    this.rpmBar.style.width = `${Math.min(100, (t.rpm / 4400) * 100)}%`;
    this.rpmBar.classList.toggle('hot', t.rpm > 3800);
    this.pitchEl.textContent = `${Math.round(t.pitchDeg)}°`;
    this.rollEl.textContent = `${Math.round(t.rollDeg)}°`;
    this.truckIcon.style.transform = `rotate(${-t.rollDeg}deg)`;
    this.truckIcon.classList.toggle('warn', Math.abs(t.rollDeg) > 25 || Math.abs(t.pitchDeg) > 30);
    if (run) {
      this.runBox.classList.remove('hidden');
      this.timeEl.textContent = formatTime(run.timeMs);
      this.cpEl.textContent = `${run.next}/${run.total}`;
      if (run.bearing !== null) { this.compass.style.transform = `rotate(${run.bearing}deg)`; this.distEl.textContent = run.distance !== null ? `${Math.round(run.distance)} m` : ''; }
    } else this.runBox.classList.add('hidden');
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.toastEl.classList.remove('show'); }
    if (this.bigTimer > 0) { this.bigTimer -= dt; if (this.bigTimer <= 0) this.bigEl.classList.remove('show'); }
  }
}
