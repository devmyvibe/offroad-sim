import * as THREE from 'three';
import { Game } from './core/Game';
import { FreeCamera } from './camera/FreeCamera';
import { buildMap } from './world/Map01';
import { ProceduralTextures } from './terrain/ProceduralTextures';
import { createTerrainMaterial } from './terrain/TerrainMaterial';
import { buildTerrainGeometry, createTerrainCollider } from './terrain/TerrainMesh';
import { DesertSky } from './world/Sky';

declare global {
  interface Window { __game?: Game; __debug?: Record<string, unknown>; }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  window.__game = game;
  await game.init();
  const { scene, camera, physics, R, settings } = game;

  const t0 = performance.now();
  const map = buildMap();
  const tMap = performance.now() - t0;
  const textures = new ProceduralTextures(256, settings.preset.anisotropy);
  const tTex = performance.now() - t0 - tMap;
  const terrain = new THREE.Mesh(buildTerrainGeometry(map.hm, settings.preset.terrainSegments), createTerrainMaterial(textures));
  terrain.receiveShadow = true; terrain.castShadow = false;
  scene.add(terrain);
  createTerrainCollider(physics, map.hm);
  const tMesh = performance.now() - t0 - tMap - tTex;

  const sky = new DesertSky(scene, game.renderer);
  sky.setShadowQuality(settings.preset.shadowMapSize, settings.preset.shadows);
  sky.setFogFar(settings.preset.fogFar);

  // Placeholder dynamic body so physics/render sync stays visible until the car lands in M2.
  const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8b4a2b }));
  crateMesh.castShadow = true; scene.add(crateMesh);
  const crate = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, map.hubHeight + 4, 0));
  physics.world.createCollider(R.ColliderDesc.cuboid(0.5, 0.5, 0.5), crate);

  camera.position.set(-14, map.hubHeight + 6, 18);
  const free = new FreeCamera(camera, canvas);
  free.yaw = Math.atan2(-14, 18) + Math.PI; free.pitch = -0.22; free.setActive(true);
  const camParam = new URLSearchParams(location.search).get('cam');
  if (camParam) { const [x, y, z, yaw, pitch] = camParam.split(',').map(Number); camera.position.set(x, y, z); free.yaw = yaw; free.pitch = pitch; }

  // Verify physics/visual agreement of the heightfield (after the first step, when queries are live).
  const checkPts = [[0, 0], [120, -90], [-300, 200], [600, -600], [-700, -400]];
  let check: unknown = null;

  game.add({
    update(dt) {
      free.update(dt);
      const p = crate.translation(), q = crate.rotation();
      crateMesh.position.set(p.x, p.y, p.z); crateMesh.quaternion.set(q.x, q.y, q.z, q.w);
      sky.follow(crateMesh.position);
      if (!check && game.stats.physicsSteps > 0) check = checkPts.map(([x, z]) => { const phys = physics.groundHeight(x, z); const vis = map.hm.sample(x, z); return { x, z, phys: phys === null ? null : +phys.toFixed(2), vis: +vis.toFixed(2) }; });
      window.__debug = { crateY: +p.y.toFixed(2), hub: +map.hubHeight.toFixed(2), fps: game.stats.fps, timings: { map: Math.round(tMap), tex: Math.round(tTex), mesh: Math.round(tMesh) }, check };
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
