import * as THREE from 'three';

/** CPU-simulated dust puffs rendered as soft point sprites. */
export class Dust {
  readonly points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private life: Float32Array;
  private vel: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private head = 0;
  private geo: THREE.BufferGeometry;

  constructor(max = 500) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: makeSoftTexture() }, uColor: { value: new THREE.Color(0xcbb48a) }, uFog: { value: new THREE.Color(0xd8c3a3) } },
      vertexShader: `attribute float aSize; attribute float aAlpha; varying float vAlpha;
        void main() { vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * 300.0 / max(1.0, -mv.z); }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uColor; varying float vAlpha;
        void main() { float a = texture2D(uTex, gl_PointCoord).a * vAlpha; if (a < 0.01) discard; gl_FragColor = vec4(uColor, a); }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, intensity: number): void {
    const i = this.head; this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x + (Math.random() - 0.5) * 0.5; this.pos[i * 3 + 1] = y + 0.1; this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
    this.vel[i * 3] = vx + (Math.random() - 0.5) * 1.5; this.vel[i * 3 + 1] = vy + 0.8 + Math.random() * 1.2; this.vel[i * 3 + 2] = vz + (Math.random() - 0.5) * 1.5;
    this.life[i] = 1; this.size[i] = 0.6 + Math.random() * 0.6; this.alpha[i] = 0.25 * intensity;
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt * 0.55;
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 1 - dt * 1.5; this.vel[i * 3 + 2] *= 1 - dt * 1.5; this.vel[i * 3 + 1] = Math.max(0.2, this.vel[i * 3 + 1] - dt * 0.6);
      this.size[i] += dt * 2.2;
      this.alpha[i] *= 1 - dt * 0.9;
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }
}

function makeSoftTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
