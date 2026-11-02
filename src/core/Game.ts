import * as THREE from 'three';
import { Time } from './Time';
import { Input } from './Input';
import { Settings } from './Settings';
import { Save } from './Save';
import { PhysicsWorld, loadRapier, type Rapier } from '../physics/World';

/** Anything that participates in the simulation/render loop. */
export interface System {
  /** Called at the fixed physics rate, before world.step(). */
  fixedUpdate?(dt: number): void;
  /** Called once per rendered frame after physics. */
  update?(dt: number, alpha: number): void;
}

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly time = new Time(60);
  readonly input = new Input();
  readonly settings = new Settings();
  readonly save = new Save();
  physics!: PhysicsWorld;
  R!: Rapier;
  private systems: System[] = [];
  private running = false;
  paused = false;
  /** Debug stats exposed for automated checks. */
  readonly stats = { frames: 0, fps: 0, physicsSteps: 0 };
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.62;
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 6000);
    if (new URLSearchParams(location.search).has('fastsim')) this.time.maxSteps = 30;
    this.applyQuality();
    this.settings.onChange(() => this.applyQuality());
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  async init(): Promise<void> {
    this.R = await loadRapier();
    this.physics = new PhysicsWorld(this.R, this.time.fixedDt);
  }

  applyQuality(): void {
    const p = this.settings.preset;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
    this.renderer.shadowMap.enabled = p.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  add(system: System): void {
    this.systems.push(system);
  }

  remove(system: System): void {
    this.systems = this.systems.filter((s) => s !== system);
  }

  /** Test mode: physics paced by the wall clock on a timer, rendering only occasionally. */
  readonly headless = new URLSearchParams(location.search).has('headless');

  start(): void {
    if (this.running) return;
    this.running = true;
    this.time.start(performance.now());
    if (this.headless) {
      this.time.maxSteps = 120;
      let lastRender = 0;
      const tick = () => {
        if (!this.running) return;
        const now = performance.now();
        this.frame(now, now - lastRender > 1000);
        if (now - lastRender > 1000) lastRender = now;
        setTimeout(tick, 5);
      };
      tick();
      return;
    }
    const loop = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private frame(now: number, render = true): void {
    const steps = this.time.tick(now);
    const fdt = this.time.fixedDt;
    this.input.update(this.time.frameDt);
    if (!this.paused) {
      for (let i = 0; i < steps; i++) {
        for (const s of this.systems) s.fixedUpdate?.(fdt);
        this.physics.step();
        this.stats.physicsSteps++;
      }
    }
    for (const s of this.systems) s.update?.(this.time.frameDt, this.time.alpha);
    if (render) this.renderer.render(this.scene, this.camera);
    this.stats.frames++;
    this.fpsAcc += this.time.frameDt; this.fpsFrames++;
    if (this.fpsAcc >= 0.5) { this.stats.fps = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; }
  }
}
