import RAPIER from '@dimforge/rapier3d-compat';

export type Rapier = typeof RAPIER;

let initialized: Promise<Rapier> | null = null;

/** Loads the Rapier WASM once. */
export function loadRapier(): Promise<Rapier> {
  if (!initialized) initialized = RAPIER.init().then(() => RAPIER);
  return initialized;
}

export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly R: Rapier;

  constructor(R: Rapier, fixedDt: number) {
    this.R = R;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = fixedDt;
    // More solver iterations keep a 2-ton truck from jittering on rock edges.
    this.world.numSolverIterations = 8;
  }

  step(): void {
    this.world.step();
  }

  /** Ground height under (x,z) via a downward ray; null if nothing hit. */
  groundHeight(x: number, z: number, fromY = 200, maxDist = 400): number | null {
    const ray = new this.R.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, maxDist, true);
    return hit ? fromY - hit.timeOfImpact : null;
  }
}
