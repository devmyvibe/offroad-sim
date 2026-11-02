import * as THREE from 'three';
import { Game } from './core/Game';
import { FreeCamera } from './camera/FreeCamera';
import { ChaseCamera } from './camera/ChaseCamera';
import { buildMap, type BuiltMap } from './world/Map01';
import { ProceduralTextures } from './terrain/ProceduralTextures';
import { createTerrainMaterial } from './terrain/TerrainMaterial';
import { buildTerrainGeometry, createTerrainCollider } from './terrain/TerrainMesh';
import { DesertSky } from './world/Sky';
import { Vehicle } from './vehicle/Vehicle';
import { buildObstacles } from './world/Obstacles';
import { I18n, formatTime } from './ui/i18n';
import { Hud } from './ui/Hud';
import { Menu } from './ui/Menu';
import { TouchControls } from './ui/TouchControls';
import { isMobile } from './core/Settings';
import { TrailRunner, RESET_PENALTY_S } from './trails/TrailRunner';
import { TrailMarkers } from './trails/Markers';
import { TRAILS, trailById, type TrailDef } from './trails/trails';

declare global {
  interface Window { __game?: Game; __debug?: Record<string, unknown>; __vehicle?: Vehicle; __map?: BuiltMap; __free?: FreeCamera; __app?: App; }
}

type Mode = 'menu' | 'free' | 'trail';

class App {
  readonly game: Game;
  map!: BuiltMap;
  vehicle!: Vehicle;
  sky!: DesertSky;
  chase!: ChaseCamera;
  free!: FreeCamera;
  hud!: Hud;
  menu!: Menu;
  touch!: TouchControls;
  touchMode = false;
  i18n!: I18n;
  mode: Mode = 'menu';
  camMode: 'chase' | 'cockpit' | 'free' = 'chase';
  runner: TrailRunner | null = null;
  markers: TrailMarkers | null = null;
  private params = new URLSearchParams(location.search);
  private flipToast = 0;
  private menuOrbit = 0;
  private ap: { path: import('./terrain/Heightmap').Polyline; throttle: number; cap: number; t: number; stuckFor: number } | null = null;
  private autoDrive: { throttle: number; steer: number; until: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.game = new Game(canvas);
  }

  async init(): Promise<void> {
    const { game } = this;
    await game.init();
    const { scene, camera, physics, settings, input } = game;
    this.i18n = new I18n(settings.data.lang);
    const ui = document.getElementById('ui')!;

    this.map = buildMap();
    window.__map = this.map;
    const textures = new ProceduralTextures(256, settings.preset.anisotropy);
    const terrain = new THREE.Mesh(buildTerrainGeometry(this.map.hm, settings.preset.terrainSegments), createTerrainMaterial(textures));
    terrain.receiveShadow = true;
    scene.add(terrain);
    createTerrainCollider(physics, this.map.hm);
    const rockMat = new THREE.MeshStandardMaterial({ map: textures.rock.albedo, normalMap: textures.rock.normal, roughness: 0.85, color: 0xb9a58a });
    scene.add(buildObstacles(physics, this.map.hm, this.map.paths, rockMat));

    this.sky = new DesertSky(scene, game.renderer);
    this.sky.setShadowQuality(settings.preset.shadowMapSize, settings.preset.shadows);
    this.sky.setFogFar(settings.preset.fogFar);
    settings.onChange(() => { this.sky.setShadowQuality(settings.preset.shadowMapSize, settings.preset.shadows); this.sky.setFogFar(settings.preset.fogFar); });

    this.vehicle = new Vehicle(physics, this.map.hm, scene, new THREE.Vector3(0, this.map.hm.sample(0, 0) + 1.1, 0), Math.PI * 0.75);
    window.__vehicle = this.vehicle;
    this.vehicle.onMessage((k) => this.hud.toast(this.i18n.t(k)));

    this.chase = new ChaseCamera(camera, this.map.hm);
    this.free = new FreeCamera(camera, game.canvas);
    window.__free = this.free;
    if (this.params.has('orbit')) this.chase.orbitLock = Number(this.params.get('orbit'));

    this.hud = new Hud(ui, this.i18n);
    this.touch = new TouchControls(ui, input, this.i18n);
    this.touchMode = isMobile() || this.params.has('touch');
    this.touch.setInvert(settings.data.invertSteerTouch);
    settings.onChange((d) => this.touch.setInvert(d.invertSteerTouch));
    if (this.touchMode) { this.hud.el.classList.add('touch-mode'); const hint = document.createElement('div'); hint.className = 'rotate-hint enabled'; hint.textContent = this.i18n.lang === 'he' ? 'סובב את הטלפון לרוחב' : 'Rotate your phone to landscape'; ui.appendChild(hint); ui.classList.add('touch-mode'); }
    this.menu = new Menu(ui, this.i18n, settings, game.save, {
      startTrail: (def) => this.startTrail(def),
      freeRoam: () => this.startFree(),
      resume: () => this.resume(),
      restart: () => { if (this.runner) this.startTrail(this.runner.def); else this.startFree(); },
      toMenu: () => this.toMenu(),
    });
    for (const t of TRAILS) this.menu.setTrailLength(t.id, this.map.paths.get(t.id)!.length);

    input.onAction((a) => this.onAction(a));

    game.add({ fixedUpdate: (dt) => this.fixedUpdate(dt), update: (dt) => this.update(dt) });
    this.applyTestParams();
    if (this.mode === 'menu') this.toMenu();
    game.start();
  }

  /* ---------- flow ---------- */

  toMenu(): void {
    this.mode = 'menu';
    this.game.paused = false;
    this.clearRun();
    this.vehicle.reset(new THREE.Vector3(0, 0, 0), Math.PI * 0.75);
    this.vehicle.setMode('4H');
    this.hud.show(false);
    this.touch.show(false);
    this.menu.show('main');
    this.chase.snap();
  }

  startFree(): void {
    this.mode = 'free';
    this.game.paused = false;
    this.clearRun();
    this.menu.show('none');
    this.hud.show(true);
    this.touch.show(this.touchMode);
    this.vehicle.reset(new THREE.Vector3(0, 0, 0), Math.PI * 0.75);
    this.chase.snap();
    this.hud.toast(this.i18n.t('free.desc'), 3);
  }

  startTrail(def: TrailDef): void {
    this.mode = 'trail';
    this.game.paused = false;
    this.clearRun();
    const path = this.map.paths.get(def.id)!;
    const runner = new TrailRunner(def, path, this.game.save);
    this.runner = runner;
    this.markers = new TrailMarkers(this.map.hm, path, runner.checkpoints, def.difficulty === 1 ? 0x7fd36b : def.difficulty === 2 ? 0xff9d2e : 0xff5c5c);
    this.game.scene.add(this.markers.group);
    const start = runner.startPose();
    this.vehicle.reset(new THREE.Vector3(start.x, 0, start.z), start.heading);
    this.vehicle.setMode(def.recommended);
    this.chase.snap();
    this.menu.show('none');
    this.hud.show(true);
    this.touch.show(this.touchMode);
    runner.onCountdown = (n) => this.hud.big(n > 0 ? String(n) : this.i18n.t('msg.go'), n > 0 ? 1 : 0.8);
    runner.onCheckpoint = (n, total) => { if (n < total) this.hud.toast(this.i18n.t('msg.checkpoint', { n, total })); };
    runner.onFinish = (r) => { this.hud.big(this.i18n.t('msg.finish'), 1.5); setTimeout(() => this.menu.showFinish(def, r), 1600); };
    runner.begin();
  }

  resume(): void {
    this.menu.show('none');
    this.game.paused = false;
  }

  pause(): void {
    if (this.mode === 'menu') return;
    if (this.menu.screen === 'pause') { this.resume(); return; }
    this.game.paused = true;
    this.menu.show('pause');
  }

  private clearRun(): void {
    this.markers?.dispose(); this.markers = null;
    this.runner = null;
  }

  private resetVehicle(): void {
    if (this.mode === 'trail' && this.runner) {
      if (this.runner.state === 'running') {
        this.runner.reset();
        this.hud.toast(this.i18n.t('msg.resetPenalty', { s: RESET_PENALTY_S }));
      }
      const p = this.runner.respawnPose();
      this.vehicle.reset(new THREE.Vector3(p.x, 0, p.z), p.heading);
    } else {
      const heading = Math.atan2(this.vehicle.forward.x, this.vehicle.forward.z);
      this.vehicle.reset(new THREE.Vector3(this.vehicle.position.x, 0, this.vehicle.position.z), heading);
    }
    this.chase.snap();
  }

  private onAction(a: string): void {
    if (a === 'pause') { this.pause(); return; }
    if (this.mode === 'menu' || this.game.paused) return;
    switch (a) {
      case 'driveModeUp': this.vehicle.cycleMode(1); break;
      case 'driveModeDown': this.vehicle.cycleMode(-1); break;
      case 'reset': this.resetVehicle(); break;
      case 'headlights': this.vehicle.setHeadlights(true); break;
      case 'camera': this.camMode = this.camMode === 'chase' ? 'cockpit' : 'chase'; this.chase.snap(); break;
      case 'debug':
        this.camMode = this.camMode === 'free' ? 'chase' : 'free';
        this.free.setActive(this.camMode === 'free');
        if (this.camMode === 'free') this.game.camera.position.copy(this.vehicle.position).add(new THREE.Vector3(6, 4, 6)); else this.chase.snap();
        break;
    }
  }

  /* ---------- loop ---------- */

  private fixedUpdate(dt: number): void {
    const { input } = this.game;
    if (this.mode === 'menu') { input.setOverride({ throttle: 0, brake: 0, steer: 0, reverse: false, handbrake: true }); }
    else if (this.ap) this.autopilot(dt);
    else if (this.autoDrive) {
      const on = this.game.time.simElapsed < this.autoDrive.until;
      input.setOverride({ throttle: on ? this.autoDrive.throttle : 0, steer: on ? this.autoDrive.steer : 0, brake: 0, reverse: false, handbrake: false });
    } else if (this.runner && this.runner.state === 'countdown') input.setOverride({ throttle: 0, brake: 1, steer: input.state.steer, reverse: false, handbrake: true });
    else if (this.touch.active) this.touch.update(dt);
    else input.clearOverride('throttle', 'brake', 'steer', 'reverse', 'handbrake');
    this.vehicle.fixedUpdate(dt, input.state);
    this.runner?.update(dt, this.vehicle.position);
  }

  private update(dt: number): void {
    const { camera } = this.game;
    const v = this.vehicle;
    v.syncVisual();
    if (this.mode === 'menu') {
      // Slow orbit around the parked truck behind the menu.
      this.menuOrbit += dt * 0.12;
      const r = 9, y = v.position.y + 2.2;
      camera.position.set(v.position.x + Math.cos(this.menuOrbit) * r, y, v.position.z + Math.sin(this.menuOrbit) * r);
      camera.lookAt(v.position.x, v.position.y + 0.6, v.position.z);
    } else if (this.camMode === 'chase') this.chase.update(dt, v.position, v.forward, v.velocity);
    else if (this.camMode === 'cockpit') {
      const eye = v.visual.eye.getWorldPosition(new THREE.Vector3());
      camera.position.copy(eye);
      const q = v.visual.root.quaternion;
      camera.quaternion.copy(q);
    } else this.free.update(dt);
    this.sky.follow(v.position);

    // Flip helper.
    if (this.mode !== 'menu' && v.flippedSeconds > 3) { this.flipToast -= dt; if (this.flipToast <= 0) { this.hud.toast(this.i18n.t('msg.flipped'), 3); this.flipToast = 4; } }

    // HUD.
    let run: Parameters<Hud['update']>[2] = null;
    if (this.runner) {
      const cp = this.runner.nextCheckpoint();
      let bearing: number | null = null, distance: number | null = null;
      if (cp) {
        const dx = cp.x - v.position.x, dz = cp.z - v.position.z;
        distance = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz), have = Math.atan2(v.forward.x, v.forward.z);
        bearing = THREE.MathUtils.radToDeg(want - have) - 90; // arrow glyph points right; 0 = straight ahead
      }
      run = { timeMs: this.runner.timeMs, next: this.runner.next, total: this.runner.checkpoints.length, bearing, distance };
      this.markers?.update(dt, this.runner.next);
    }
    this.hud.update(dt, v.telemetry, run);

    const t = v.telemetry;
    window.__debug = {
      mode: this.mode, screen: this.menu.screen, run: this.runner ? { state: this.runner.state, next: this.runner.next, total: this.runner.checkpoints.length, time: formatTime(this.runner.timeMs), resets: this.runner.resets, result: this.runner.result } : null,
      ap: this.ap ? { t: +this.ap.t.toFixed(1), len: +this.ap.path.length.toFixed(0), stuck: +this.ap.stuckFor.toFixed(1) } : undefined,
      fps: this.game.stats.fps, sim: +this.game.time.simElapsed.toFixed(1),
      pos: v.position.toArray().map((n) => +n.toFixed(2)), speedKmh: +t.speedKmh.toFixed(1), rpm: Math.round(t.rpm), gear: t.gear, driveMode: t.mode,
      pitch: +t.pitchDeg.toFixed(1), roll: +t.rollDeg.toFixed(1), upright: t.upright, contacts: t.wheels.map((w) => w.contact), slip: t.wheels.map((w) => +w.slip.toFixed(2)), dig: t.wheels.map((w) => +w.dig.toFixed(2)),
    };
  }

  /* ---------- test hooks (URL params) ---------- */

  private applyTestParams(): void {
    const p = this.params;
    const run = p.get('run');
    if (run) { this.startTrail(trailById(run)); }
    else if (p.get('trail') || p.get('spawn') || p.get('free')) {
      this.startFree();
      const trailParam = p.get('trail');
      if (trailParam && this.map.paths.has(trailParam)) {
        const path = this.map.paths.get(trailParam)!; const tt = Number(p.get('t') ?? 0);
        const pt = path.at(tt), tg = path.tangent(tt);
        this.vehicle.reset(new THREE.Vector3(pt.x, 0, pt.z), Math.atan2(tg.x, tg.z));
      }
      const spawn = p.get('spawn');
      if (spawn) { const [x, z, h] = spawn.split(',').map(Number); this.vehicle.reset(new THREE.Vector3(x, 0, z), h); }
      this.chase.snap();
    }
    const modeParam = p.get('mode');
    if (modeParam === '2H' || modeParam === '4H' || modeParam === '4L') this.vehicle.setMode(modeParam);
    const apTrail = p.get('autopilot');
    if (apTrail && this.map.paths.has(apTrail)) this.ap = { path: this.map.paths.get(apTrail)!, throttle: Number(p.get('throttle') ?? 0.7), cap: Number(p.get('cap') ?? 30) / 3.6, t: 0, stuckFor: 0 };
    const drive = p.get('drive');
    if (drive) { const [th, st, sec] = drive.split(',').map(Number); this.autoDrive = { throttle: th, steer: st, until: sec }; }
    const cam = p.get('cam');
    if (cam) { const [x, y, z, yaw, pitch] = cam.split(',').map(Number); this.game.camera.position.set(x, y, z); this.free.yaw = yaw; this.free.pitch = pitch; this.camMode = 'free'; this.free.setActive(true); if (this.mode === 'menu') this.startFree(); }
  }

  private autopilot(dt: number): void {
    const ap = this.ap!, v = this.vehicle, input = this.game.input;
    if (this.runner && this.runner.state === 'countdown') { input.setOverride({ throttle: 0, brake: 1, steer: 0, reverse: false, handbrake: true }); return; }
    const near = ap.path.nearest(v.position.x, v.position.z);
    ap.t = near.t;
    const look = ap.path.at(Math.min(ap.path.length, near.t + 7 + v.telemetry.speedKmh * 0.25));
    const dx = look.x - v.position.x, dz = look.z - v.position.z;
    const want = Math.atan2(dx, dz), have = Math.atan2(v.forward.x, v.forward.z);
    let err = want - have; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const over = v.telemetry.forwardSpeed > ap.cap;
    const done = near.t >= ap.path.length - 3 || (this.runner?.state === 'finished');
    input.setOverride({ steer: Math.max(-1, Math.min(1, err * 1.6)), throttle: over || done ? 0 : ap.throttle, brake: over && !done ? 0.4 : done ? 1 : 0, reverse: false, handbrake: false });
    ap.stuckFor = Math.abs(v.telemetry.forwardSpeed) < 0.3 && !done ? ap.stuckFor + dt : 0;
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = /^he|^iw/.test(navigator.language) ? 'טוען את המדבר…' : 'Loading the desert…';
  document.getElementById('ui')!.appendChild(loading);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const app = new App(canvas);
  window.__game = app.game; window.__app = app;
  await app.init();
  loading.remove();
}

boot().catch((err) => {
  console.error('boot failed', err);
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;inset:0;margin:0;padding:16px;background:#200;color:#fbb;white-space:pre-wrap;direction:ltr';
  el.textContent = String(err?.stack ?? err);
  document.body.appendChild(el);
});
