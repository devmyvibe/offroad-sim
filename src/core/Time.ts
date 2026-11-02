/** Fixed-step accumulator clock. Physics runs at a fixed rate, rendering per frame. */
export class Time {
  readonly fixedDt: number;
  private last = 0;
  private acc = 0;
  /** Wall-clock seconds elapsed since start (unscaled). */
  elapsed = 0;
  /** Simulated seconds (sum of fixed steps actually run). */
  simElapsed = 0;
  /** Interpolation factor between the last two physics steps (0..1). */
  alpha = 0;
  frameDt = 0;
  /** Max physics steps per frame; tests raise it so the sim keeps real-time pace without a GPU. */
  maxSteps = 4;

  constructor(fixedHz = 60) {
    this.fixedDt = 1 / fixedHz;
  }

  start(nowMs: number): void {
    this.last = nowMs;
  }

  /** Advance the clock; returns how many fixed steps must be simulated this frame. */
  tick(nowMs: number): number {
    let dt = (nowMs - this.last) / 1000;
    this.last = nowMs;
    if (dt > 0.25) dt = 0.25; // tab was hidden: don't spiral
    this.frameDt = dt;
    this.elapsed += dt;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= this.fixedDt && steps < this.maxSteps) {
      this.acc -= this.fixedDt;
      steps++;
      this.simElapsed += this.fixedDt;
    }
    if (steps === this.maxSteps) this.acc = 0;
    this.alpha = this.acc / this.fixedDt;
    return steps;
  }
}
