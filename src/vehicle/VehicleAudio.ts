import type { VehicleTelemetry } from './Vehicle';

/**
 * Synthesized diesel engine, tyre noise and wind, all from Web Audio nodes.
 * No audio files. Starts muted until the first user gesture resumes the context.
 */
export class VehicleAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engineGain!: GainNode; private osc1!: OscillatorNode; private osc2!: OscillatorNode; private engineFilter!: BiquadFilterNode;
  private clatterGain!: GainNode; private clatterFilter!: BiquadFilterNode;
  private turboOsc!: OscillatorNode; private turboGain!: GainNode;
  private tyreGain!: GainNode; private tyreFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private volume = 0.7;
  private enabled = true;
  private started = false;

  constructor() {
    const unlock = () => { this.start(); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  setVolume(v: number): void { this.volume = v; this.apply(); }
  setEnabled(on: boolean): void { this.enabled = on; this.apply(); }
  private apply(): void { if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.5 : 0, this.ctx.currentTime, 0.05); }

  private start(): void {
    if (this.started) { this.ctx?.resume(); return; }
    this.started = true;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC(); this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);

    // Engine: two detuned sawtooths through a lowpass; firing frequency tracks rpm.
    this.engineFilter = ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 400; this.engineFilter.Q.value = 1.2;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
    const o2g = ctx.createGain(); o2g.gain.value = 0.35;
    this.osc1.connect(this.engineFilter); this.osc2.connect(o2g); o2g.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.osc1.start(); this.osc2.start();

    // Diesel clatter: noise burst train shaped by a bandpass, amplitude-modulated at the firing rate.
    const noise = this.noiseSource(ctx);
    this.clatterFilter = ctx.createBiquadFilter(); this.clatterFilter.type = 'bandpass'; this.clatterFilter.frequency.value = 1800; this.clatterFilter.Q.value = 0.8;
    this.clatterGain = ctx.createGain(); this.clatterGain.gain.value = 0;
    noise.connect(this.clatterFilter); this.clatterFilter.connect(this.clatterGain); this.clatterGain.connect(this.master);

    // Turbo whistle.
    this.turboOsc = ctx.createOscillator(); this.turboOsc.type = 'sine'; this.turboOsc.frequency.value = 1200;
    this.turboGain = ctx.createGain(); this.turboGain.gain.value = 0;
    this.turboOsc.connect(this.turboGain); this.turboGain.connect(this.master); this.turboOsc.start();

    // Tyres on sand/gravel.
    const noise2 = this.noiseSource(ctx);
    this.tyreFilter = ctx.createBiquadFilter(); this.tyreFilter.type = 'lowpass'; this.tyreFilter.frequency.value = 500;
    this.tyreGain = ctx.createGain(); this.tyreGain.gain.value = 0;
    noise2.connect(this.tyreFilter); this.tyreFilter.connect(this.tyreGain); this.tyreGain.connect(this.master);

    // Wind.
    const noise3 = this.noiseSource(ctx);
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 900; windFilter.Q.value = 0.3;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    noise3.connect(windFilter); windFilter.connect(this.windGain); this.windGain.connect(this.master);

    this.apply();
  }

  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.5 + last * 3) * 0.5; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.start();
    return src;
  }

  update(t: VehicleTelemetry, paused: boolean): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime, k = 0.06;
    if (paused) { this.engineGain.gain.setTargetAtTime(0, now, k); this.clatterGain.gain.setTargetAtTime(0, now, k); this.tyreGain.gain.setTargetAtTime(0, now, k); this.windGain.gain.setTargetAtTime(0, now, k); this.turboGain.gain.setTargetAtTime(0, now, k); return; }
    const rpm = Math.max(600, t.rpm);
    const fire = (rpm / 60) * 2; // 4-cylinder, 4-stroke: 2 firings per rev
    const load = 0.25 + 0.75 * t.throttle;
    this.osc1.frequency.setTargetAtTime(fire, now, k);
    this.osc2.frequency.setTargetAtTime(fire * 0.5, now, k);
    this.engineFilter.frequency.setTargetAtTime(250 + rpm * 0.25 + load * 300, now, k);
    this.engineGain.gain.setTargetAtTime(0.18 + 0.22 * load + 0.06 * (rpm / 4200), now, k);
    this.clatterFilter.frequency.setTargetAtTime(1200 + rpm * 0.5, now, k);
    this.clatterGain.gain.setTargetAtTime(0.05 + 0.12 * load * (0.5 + 0.5 * rpm / 4200), now, k);
    this.turboOsc.frequency.setTargetAtTime(600 + rpm * 0.9, now, k);
    this.turboGain.gain.setTargetAtTime(0.012 * load * Math.max(0, (rpm - 1500) / 2700), now, k);
    const speed = t.speedKmh / 3.6;
    const sand = t.wheels.reduce((a, w) => a + (w.contact ? w.sand : 0), 0) / 4;
    const slip = t.wheels.reduce((a, w) => a + w.slip, 0) / 4;
    const rolling = Math.min(1, speed / 15);
    this.tyreFilter.frequency.setTargetAtTime(300 + 900 * (1 - sand) + speed * 20, now, k);
    this.tyreGain.gain.setTargetAtTime(0.25 * rolling * (0.5 + 0.5 * sand) + 0.3 * slip * t.wheelSpin, now, k);
    this.windGain.gain.setTargetAtTime(0.35 * Math.min(1, (speed / 30) ** 2), now, k);
  }
}
