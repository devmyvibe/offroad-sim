import * as THREE from 'three';
import { Game } from './core/Game';
import { FreeCamera } from './camera/FreeCamera';
import { ChaseCamera } from './camera/ChaseCamera';
import { buildMap } from './world/Map01';
import { ProceduralTextures } from './terrain/ProceduralTextures';
import { createTerrainMaterial } from './terrain/TerrainMaterial';
import { buildTerrainGeometry, createTerrainCollider } from './terrain/TerrainMesh';
import { DesertSky } from './world/Sky';
import { Vehicle } from './vehicle/Vehicle';
import { buildObstacles } from './world/Obstacles';

declare global {
  interface Window { __game?: Game; __debug?: Record<string, unknown>; __vehicle?: Vehicle; }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  window.__game = game;
  await game.init();
  const { scene, camera, physics, settings, input } = game;
  const params = new URLSearchParams(location.search);

  const map = buildMap();
  const textures = new ProceduralTextures(256, settings.preset.anisotropy);
  const terrain = new THREE.Mesh(buildTerrainGeometry(map.hm, settings.preset.terrainSegments), createTerrainMaterial(textures));
  terrain.receiveShadow = true;
  scene.add(terrain);
  createTerrainCollider(physics, map.hm);
  const rockMat = new THREE.MeshStandardMaterial({ map: textures.rock.albedo, normalMap: textures.rock.normal, roughness: 0.85, color: 0xb9a58a });
  rockMat.map!.repeat.set(0.5, 0.5);
  scene.add(buildObstacles(physics, map.hm, map.paths, rockMat));

  const sky = new DesertSky(scene, game.renderer);
  sky.setShadowQuality(settings.preset.shadowMapSize, settings.preset.shadows);
  sky.setFogFar(settings.preset.fogFar);

  // Spawn the Trooper at the hub facing north-east (towards the massif).
  const spawnParam = params.get('spawn');
  let spawn = spawnParam ? spawnParam.split(',').map(Number) : [0, 0, Math.PI * 0.75];
  // ?trail=<id>&t=<metres>: spawn on a trail at arc length t, facing along it.
  const trailParam = params.get('trail');
  if (trailParam && map.paths.has(trailParam)) {
    const path = map.paths.get(trailParam)!; const tt = Number(params.get('t') ?? 0);
    const pt = path.at(tt), tg = path.tangent(tt);
    spawn = [pt.x, pt.z, Math.atan2(tg.x, tg.z)];
  }
  const vehicle = new Vehicle(physics, map.hm, scene, new THREE.Vector3(spawn[0], map.hm.sample(spawn[0], spawn[1]) + 1.1, spawn[1]), spawn[2]);
  window.__vehicle = vehicle;

  const chase = new ChaseCamera(camera, map.hm);
  if (params.has('orbit')) chase.orbitLock = Number(params.get('orbit'));
  const free = new FreeCamera(camera, canvas);
  let camMode: 'chase' | 'free' = 'chase';
  const camParam = params.get('cam');
  if (camParam) { const [x, y, z, yaw, pitch] = camParam.split(',').map(Number); camera.position.set(x, y, z); free.yaw = yaw; free.pitch = pitch; camMode = 'free'; free.setActive(true); }

  input.onAction((a) => {
    if (a === 'driveModeUp') vehicle.cycleMode(1);
    if (a === 'driveModeDown') vehicle.cycleMode(-1);
    if (a === 'reset') vehicle.reset(new THREE.Vector3(0, 0, 0), Math.PI * 0.75);
    if (a === 'headlights') vehicle.setHeadlights(true);
    if (a === 'debug') { camMode = camMode === 'chase' ? 'free' : 'chase'; free.setActive(camMode === 'free'); if (camMode === 'free') { camera.position.copy(vehicle.position).add(new THREE.Vector3(6, 4, 6)); } else chase.snap(); }
  });
  vehicle.onMessage((k) => console.log('[vehicle]', k));

  // Automated driving for tests: ?drive=throttle,steer,seconds
  const driveParam = params.get('drive');
  let autoDrive: { throttle: number; steer: number; until: number } | null = null;
  if (driveParam) { const [th, st, sec] = driveParam.split(',').map(Number); autoDrive = { throttle: th, steer: st, until: sec }; }
  // Autopilot for tests: ?autopilot=<trail>&throttle=0.6&cap=15 (km/h) follows the trail with pure pursuit.
  const apTrail = params.get('autopilot');
  const ap = apTrail && map.paths.has(apTrail) ? { path: map.paths.get(apTrail)!, throttle: Number(params.get('throttle') ?? 0.7), cap: Number(params.get('cap') ?? 30) / 3.6, t: 0, stuckFor: 0 } : null;
  const modeParam = params.get('mode');
  if (modeParam === '2H' || modeParam === '4H' || modeParam === '4L') vehicle.setMode(modeParam);

  game.add({
    fixedUpdate(dt) {
      if (autoDrive) {
        const on = game.time.simElapsed < autoDrive.until;
        input.setOverride({ throttle: on ? autoDrive.throttle : 0, steer: on ? autoDrive.steer : 0, brake: 0, reverse: false, handbrake: false });
      }
      if (ap) {
        const near = ap.path.nearest(vehicle.position.x, vehicle.position.z);
        ap.t = near.t;
        const look = ap.path.at(Math.min(ap.path.length, near.t + 7 + vehicle.telemetry.speedKmh * 0.25));
        const dx = look.x - vehicle.position.x, dz = look.z - vehicle.position.z;
        const want = Math.atan2(dx, dz), have = Math.atan2(vehicle.forward.x, vehicle.forward.z);
        let err = want - have; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
        const over = vehicle.telemetry.forwardSpeed > ap.cap;
        const done = near.t >= ap.path.length - 5;
        input.setOverride({ steer: Math.max(-1, Math.min(1, err * 1.6)), throttle: over || done ? 0 : ap.throttle, brake: over && !done ? 0.4 : done ? 1 : 0, reverse: false, handbrake: false });
        ap.stuckFor = Math.abs(vehicle.telemetry.forwardSpeed) < 0.3 && !done ? ap.stuckFor + dt : 0;
      }
      vehicle.fixedUpdate(dt, input.state);
    },
    update(dt) {
      vehicle.syncVisual();
      if (camMode === 'chase') chase.update(dt, vehicle.position, vehicle.forward, vehicle.velocity);
      else free.update(dt);
      sky.follow(vehicle.position);
      const t = vehicle.telemetry;
      window.__debug = {
        ap: ap ? { t: +ap.t.toFixed(1), len: +ap.path.length.toFixed(0), stuck: +ap.stuckFor.toFixed(1) } : undefined,
        fps: game.stats.fps, elapsed: +game.time.elapsed.toFixed(1), sim: +game.time.simElapsed.toFixed(1),
        pos: vehicle.position.toArray().map((n) => +n.toFixed(2)),
        speedKmh: +t.speedKmh.toFixed(1), fwd: +t.forwardSpeed.toFixed(2), rpm: Math.round(t.rpm), gear: t.gear, mode: t.mode,
        pitch: +t.pitchDeg.toFixed(1), roll: +t.rollDeg.toFixed(1), upright: t.upright, contacts: t.wheels.map((w) => w.contact), sand: t.wheels.map((w) => +w.sand.toFixed(2)), slip: t.wheels.map((w) => +w.slip.toFixed(2)), dig: t.wheels.map((w) => +w.dig.toFixed(2)), comp: t.wheels.map((w) => +w.compression.toFixed(2)),
      };
    },
  });
  game.start();
}

boot().catch((err) => {
  console.error('boot failed', err);
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;inset:0;margin:0;padding:16px;background:#200;color:#fbb;white-space:pre-wrap;direction:ltr';
  el.textContent = String(err?.stack ?? err);
  document.body.appendChild(el);
});
