import { TROOPER, type DriveMode } from './TrooperSpec';

export interface DrivetrainState {
  rpm: number;
  gear: number;          // 1..5, 0 = neutral, -1 = reverse
  mode: DriveMode;
  shifting: boolean;
  wheelTorqueNm: number; // total torque delivered at the driven wheels (signed)
  engineBrakeNm: number; // positive magnitude applied against rotation
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Engine + automatic gearbox + transfer case. Input: throttle, reverse intent,
 * current forward speed. Output: torque at the wheels and a believable RPM.
 */
export class Drivetrain {
  readonly state: DrivetrainState = { rpm: TROOPER.engine.idleRpm, gear: 1, mode: '4H', shifting: false, wheelTorqueNm: 0, engineBrakeNm: 0 };
  private shiftTimer = 0;
  private sinceShift = 10;

  setMode(mode: DriveMode): void { this.state.mode = mode; }

  private get transfer(): number { return this.state.mode === '4L' ? TROOPER.gearbox.lowRange : 1; }

  /** Overall ratio engine→wheel for the current gear (signed for reverse). */
  totalRatio(): number {
    const g = this.state.gear;
    const gb = g > 0 ? TROOPER.gearbox.ratios[g - 1] : g < 0 ? -TROOPER.gearbox.reverse : 0;
    return gb * TROOPER.gearbox.finalDrive * this.transfer;
  }

  engineTorqueAt(rpm: number): number {
    const c = TROOPER.engine.torqueCurve;
    if (rpm <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) if (rpm <= c[i][0]) {
      const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
      return lerp(c[i - 1][1], c[i][1], t);
    }
    return c[c.length - 1][1] * Math.max(0, 1 - (rpm - c[c.length - 1][0]) / 600);
  }

  update(dt: number, throttle: number, reverse: boolean, forwardSpeed: number, wheelSpin = 0, forwardIntent = throttle > 0): void {
    const s = this.state;
    const { idleRpm, redlineRpm } = TROOPER.engine;
    const wheelRadPerS = forwardSpeed / TROOPER.wheelRadius;
    this.sinceShift += dt;

    // Reverse / forward engagement only near standstill.
    if (reverse && s.gear >= 0 && forwardSpeed < 1.0) { s.gear = -1; }
    else if (!reverse && s.gear < 0 && forwardSpeed > -1.0 && forwardIntent) { s.gear = 1; }

    // Automatic shifting with hysteresis; lower points in low range to keep torque.
    if (s.shifting) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) s.shifting = false;
    } else if (s.gear > 0) {
      const ratio = Math.abs(this.totalRatio());
      const rpmNow = Math.abs(wheelRadPerS) * ratio * 60 / (2 * Math.PI);
      const low = s.mode === '4L';
      const up = low ? 3100 : 3400, down = low ? 1400 : 1500;
      if (rpmNow > up && s.gear < TROOPER.gearbox.ratios.length && throttle > 0.05 && this.sinceShift > 0.8) this.shift(s.gear + 1);
      else if (rpmNow < down && s.gear > 1 && this.sinceShift > 0.6) this.shift(s.gear - 1);
    }

    // RPM: follows wheels through the ratio; clutch slips near idle so it never stalls.
    const ratio = this.totalRatio();
    const geared = Math.abs(wheelRadPerS * ratio) * 60 / (2 * Math.PI);
    // Spinning wheels (traction lost) let the engine rev freely; a blocked truck lugs near idle.
    const spinRpm = idleRpm + wheelSpin * throttle * (redlineRpm * 0.7 - idleRpm);
    const target = Math.max(idleRpm + throttle * 250, Math.min(redlineRpm, geared), spinRpm);
    s.rpm = lerp(s.rpm, target, Math.min(1, dt * 10));

    // Torque at the wheels.
    const cut = s.shifting ? 0.15 : 1;
    const torque = this.engineTorqueAt(s.rpm) * throttle * cut * TROOPER.gearbox.efficiency * Math.abs(ratio);
    // Cut power at redline so the truck can't overrev in 1st low.
    const limiter = s.rpm > redlineRpm - 50 ? 0.2 : 1;
    s.wheelTorqueNm = (s.gear === 0 ? 0 : Math.sign(ratio)) * torque * limiter;
    // Engine braking grows with rpm, only when off throttle and in gear.
    s.engineBrakeNm = throttle < 0.05 && s.gear !== 0 ? TROOPER.engine.engineBrakeNm * (0.4 + 0.6 * s.rpm / redlineRpm) * Math.abs(ratio) * 0.35 : 0;
  }

  private shift(gear: number): void {
    this.state.gear = gear;
    this.state.shifting = true;
    this.shiftTimer = TROOPER.gearbox.shiftTimeS;
    this.sinceShift = 0;
  }
}
