/**
 * Isuzu Trooper 3.1 TD (UBS69, LWB, 5MT). All values are approximate and
 * tunable; they only need to *feel* like the real truck.
 */
export const TROOPER = {
  massKg: 2050,
  /** half extents of the main body collider (x, y, z); z is forward */
  bodyHalf: { x: 0.86, y: 0.42, z: 2.25 },
  /** heavy low block (engine, axles, fuel) that pulls the centre of mass down */
  lowMassHalf: { x: 0.55, y: 0.12, z: 1.4 },
  lowMassY: -0.3,
  lowMassFraction: 0.42,
  wheelbase: 2.76,
  track: 1.5,
  wheelRadius: 0.39,
  wheelWidth: 0.26,
  /** wheel connection height relative to the chassis origin */
  wheelY: -0.22,
  suspension: {
    restLength: 0.34,
    maxTravel: 0.26,
    stiffness: 24,      // Bullet-style: force = stiffness * compression * chassisMass
    compression: 3.4,
    relaxation: 4.6,
    maxForce: 150000,
  },
  /** chassis origin height above ground when resting (for spawn) */
  restHeight: 0.92,
  maxSteerRad: 0.55,
  engine: {
    idleRpm: 750,
    redlineRpm: 4200,
    /** rpm → Nm (4JG2-TC: ~85 kW @ 3600, ~260 Nm @ 2000) */
    torqueCurve: [[600, 105], [1000, 165], [1500, 228], [2000, 262], [2500, 256], [3000, 236], [3600, 206], [4200, 150]] as [number, number][],
    engineBrakeNm: 55,
  },
  gearbox: {
    ratios: [3.93, 2.33, 1.44, 1.0, 0.84],
    reverse: 4.4,
    finalDrive: 4.556,
    lowRange: 2.05,
    efficiency: 0.86,
    shiftTimeS: 0.35,
  },
  brakes: {
    /** per-wheel brake "impulse cap" in Rapier units */
    maxFront: 180,
    maxRear: 120,
    handbrake: 260,
  },
  /** tyre friction coefficient by surface */
  grip: { rock: 1.15, gravel: 0.95, sand: 0.52 },
  /** extra rolling resistance in loose sand (brake units per wheel) */
  sandDrag: 24,
  /** how fast spinning wheels dig into sand (per second of full slip) and recover */
  digRate: 0.9,
  digRecover: 0.35,
} as const;

export type DriveMode = '2H' | '4H' | '4L';
