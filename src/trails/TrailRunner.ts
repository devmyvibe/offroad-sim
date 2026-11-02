import * as THREE from 'three';
import type { Polyline } from '../terrain/Heightmap';
import type { TrailDef } from './trails';
import type { Save } from '../core/Save';

export type RunState = 'idle' | 'countdown' | 'running' | 'finished';

export interface Checkpoint { t: number; x: number; z: number; heading: number; }

export interface RunResult { timeMs: number; resets: number; stars: number; improved: boolean; }

export const RESET_PENALTY_S = 10;

/** One attempt at a trail: checkpoints, timer, resets, stars. */
export class TrailRunner {
  readonly checkpoints: Checkpoint[] = [];
  state: RunState = 'idle';
  next = 0;              // index of the next checkpoint to hit
  timeMs = 0;
  resets = 0;
  countdown = 0;
  result: RunResult | null = null;
  private radius = 9;
  onCheckpoint: ((n: number, total: number) => void) | null = null;
  onFinish: ((r: RunResult) => void) | null = null;
  onCountdown: ((n: number) => void) | null = null;

  constructor(readonly def: TrailDef, readonly path: Polyline, private save: Save) {
    const count = Math.max(1, Math.floor(path.length / def.checkpointEvery));
    for (let i = 1; i <= count; i++) {
      const t = i === count ? path.length - 2 : i * (path.length / count);
      this.checkpoints.push(this.cpAt(t));
    }
  }

  private cpAt(t: number): Checkpoint {
    const p = this.path.at(t), tg = this.path.tangent(t);
    return { t, x: p.x, z: p.z, heading: Math.atan2(tg.x, tg.z) };
  }

  /** Start pose for the trail. */
  startPose(): Checkpoint { return this.cpAt(0); }

  /** Pose to respawn at after a reset. */
  respawnPose(): Checkpoint {
    if (this.next === 0) return this.startPose();
    const cp = this.checkpoints[this.next - 1];
    return this.cpAt(cp.t + 6);
  }

  begin(): void {
    this.state = 'countdown'; this.countdown = 3; this.next = 0; this.timeMs = 0; this.resets = 0; this.result = null;
    this.save.recordAttempt(this.def.id);
  }

  reset(): void {
    if (this.state !== 'running') return;
    this.resets++;
    this.timeMs += RESET_PENALTY_S * 1000;
  }

  update(dt: number, pos: THREE.Vector3): void {
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (now !== before) this.onCountdown?.(now);
      if (this.countdown <= 0) { this.state = 'running'; this.onCountdown?.(0); }
      return;
    }
    if (this.state !== 'running') return;
    this.timeMs += dt * 1000;
    const cp = this.checkpoints[this.next];
    const d = Math.hypot(pos.x - cp.x, pos.z - cp.z);
    if (d < this.radius) {
      this.next++;
      this.onCheckpoint?.(this.next, this.checkpoints.length);
      if (this.next >= this.checkpoints.length) this.finish();
    }
  }

  private finish(): void {
    this.state = 'finished';
    const [t3, t2] = this.def.starTimes;
    const stars = this.timeMs <= t3 && this.resets === 0 ? 3 : this.timeMs <= t2 ? 2 : 1;
    const improved = this.save.recordRun(this.def.id, this.timeMs, stars);
    this.result = { timeMs: this.timeMs, resets: this.resets, stars, improved };
    this.onFinish?.(this.result);
  }

  nextCheckpoint(): Checkpoint | null { return this.state === 'running' ? this.checkpoints[this.next] ?? null : null; }
}
