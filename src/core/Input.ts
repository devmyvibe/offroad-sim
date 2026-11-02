/**
 * Unified input state. Keyboard writes directly; touch controls and gamepad
 * write through the same setters so gameplay never cares about the source.
 */
export interface InputState {
  /** -1 (left) .. 1 (right) */
  steer: number;
  /** 0..1 */
  throttle: number;
  /** 0..1 */
  brake: number;
  /** reverse intent (hold) */
  reverse: boolean;
  handbrake: boolean;
}

export type InputAction =
  | 'driveModeUp'
  | 'driveModeDown'
  | 'camera'
  | 'reset'
  | 'pause'
  | 'headlights'
  | 'debug';

type ActionHandler = (action: InputAction) => void;

export class Input {
  readonly state: InputState = { steer: 0, throttle: 0, brake: 0, reverse: false, handbrake: false };
  private keys = new Set<string>();
  private handlers = new Set<ActionHandler>();
  /** Touch/gamepad overrides: when set they win over keyboard for that axis. */
  private override: Partial<InputState> = {};
  private steerSmoothed = 0;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => this.onKey(e, true));
    target.addEventListener('keyup', (e) => this.onKey(e, false));
    target.addEventListener('blur', () => this.keys.clear());
  }

  onAction(handler: ActionHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** External sources (touch UI, gamepad) call this each frame with the axes they own. */
  setOverride(partial: Partial<InputState>): void {
    this.override = { ...this.override, ...partial };
  }

  clearOverride(...keys: (keyof InputState)[]): void {
    for (const k of keys) delete this.override[k];
  }

  fire(action: InputAction): void {
    for (const h of this.handlers) h(action);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const code = e.code;
    if (down && !e.repeat) {
      switch (code) {
        case 'KeyE': this.fire('driveModeUp'); break;
        case 'KeyQ': this.fire('driveModeDown'); break;
        case 'KeyC': this.fire('camera'); break;
        case 'KeyR': this.fire('reset'); break;
        case 'Escape': this.fire('pause'); break;
        case 'KeyL': this.fire('headlights'); break;
        case 'F3': this.fire('debug'); e.preventDefault(); break;
      }
    }
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
  }

  private has(...codes: string[]): boolean {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  /** Call once per frame before gameplay reads `state`. */
  update(dt: number): void {
    const s = this.state;
    const left = this.has('ArrowLeft', 'KeyA');
    const right = this.has('ArrowRight', 'KeyD');
    const targetSteer = (right ? 1 : 0) - (left ? 1 : 0);
    // Keyboard steering ramps so the wheel doesn't snap full-lock.
    const rate = targetSteer === 0 ? 6 : 3.2;
    this.steerSmoothed += (targetSteer - this.steerSmoothed) * Math.min(1, rate * dt);
    if (Math.abs(this.steerSmoothed) < 0.01 && targetSteer === 0) this.steerSmoothed = 0;

    const fwd = this.has('ArrowUp', 'KeyW');
    const back = this.has('ArrowDown', 'KeyS');

    s.steer = this.override.steer ?? this.steerSmoothed;
    s.throttle = this.override.throttle ?? (fwd ? 1 : 0);
    s.brake = this.override.brake ?? (back ? 1 : 0);
    s.reverse = this.override.reverse ?? back;
    s.handbrake = this.override.handbrake ?? this.has('Space');
  }
}
