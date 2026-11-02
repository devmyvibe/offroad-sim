import * as THREE from 'three';
import { Game } from './core/Game';
import { FreeCamera } from './camera/FreeCamera';

declare global {
  interface Window { __game?: Game; __debug?: Record<string, unknown>; }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  window.__game = game;
  await game.init();

  const { scene, camera, physics, R } = game;
  scene.background = new THREE.Color(0xd9c2a0);
  scene.fog = new THREE.Fog(0xd9c2a0, 200, 900);

  const sun = new THREE.DirectionalLight(0xfff2dc, 3.0);
  sun.position.set(80, 120, 40);
  sun.castShadow = true;
  scene.add(sun, new THREE.HemisphereLight(0xcfe3ff, 0x8a6a3a, 0.8));

  // M0 placeholder world: flat ground + a falling crate to prove physics/render sync.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xc8a062, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  physics.world.createCollider(R.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0));

  const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8b4a2b }));
  crateMesh.castShadow = true; scene.add(crateMesh);
  const crate = physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 6, 0).setRotation({ x: 0.2, y: 0.1, z: 0.3, w: 0.92 }));
  physics.world.createCollider(R.ColliderDesc.cuboid(0.5, 0.5, 0.5).setRestitution(0.2), crate);

  camera.position.set(8, 5, 10);
  const free = new FreeCamera(camera, canvas);
  free.yaw = Math.atan2(8, 10); free.pitch = -0.35; free.setActive(true);

  game.add({
    update(dt) {
      free.update(dt);
      const p = crate.translation(), q = crate.rotation();
      crateMesh.position.set(p.x, p.y, p.z);
      crateMesh.quaternion.set(q.x, q.y, q.z, q.w);
      window.__debug = { crateY: p.y, fps: game.stats.fps, steps: game.stats.physicsSteps };
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
