import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

/** Desert sky, sun light with a shadow frustum that follows a target. */
export class DesertSky {
  readonly sky = new Sky();
  readonly sun = new THREE.DirectionalLight(0xfff1dc, 2.9);
  readonly hemi = new THREE.HemisphereLight(0xbfd6f5, 0x9a7a4a, 0.28);
  readonly sunDir = new THREE.Vector3();
  private shadowRadius = 90;

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer, elevationDeg = 38, azimuthDeg = 155) {
    this.sky.scale.setScalar(20000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.012; u.mieDirectionalG.value = 0.82;
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg), theta = THREE.MathUtils.degToRad(azimuthDeg);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);
    scene.add(this.sky);

    this.sun.position.copy(this.sunDir).multiplyScalar(400);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    const cam = this.sun.shadow.camera;
    cam.near = 50; cam.far = 900;
    cam.left = cam.bottom = -this.shadowRadius; cam.right = cam.top = this.shadowRadius;
    scene.add(this.sun, this.sun.target, this.hemi);

    // Environment map from the sky for PBR reflections (car paint, glass).
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const skyCopy = new Sky(); skyCopy.scale.setScalar(20000);
    Object.keys(u).forEach((k) => { const src = u[k].value; const dst = skyCopy.material.uniforms[k]; if (dst) dst.value = src?.clone ? src.clone() : src; });
    envScene.add(skyCopy);
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = 0.22;
    pmrem.dispose();

    scene.fog = new THREE.Fog(0xd8c3a3, 500, 1400);
  }

  setShadowQuality(mapSize: number, enabled: boolean): void {
    this.sun.castShadow = enabled;
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
  }

  setFogFar(far: number): void {
    if (new URLSearchParams(location.search).has('nofog')) { this.scene.fog = null; return; }
    const f = this.scene.fog as THREE.Fog; f.far = far; f.near = far * 0.35;
  }

  /** Keep the shadow frustum centred on the player each frame. */
  follow(target: THREE.Vector3): void {
    // Snap to texel grid to avoid shadow shimmer.
    const texel = (this.shadowRadius * 2) / this.sun.shadow.mapSize.x;
    const tx = Math.round(target.x / texel) * texel, tz = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(tx, target.y, tz);
    this.sun.position.set(tx, target.y, tz).addScaledVector(this.sunDir, 400);
    this.sun.target.updateMatrixWorld();
  }
}
