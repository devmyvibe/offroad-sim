import type { Vec2 } from '../terrain/Heightmap';

export type TrailKind = 'wadi' | 'crossings' | 'rocksteps';

export interface TrailDef {
  id: string;
  kind: TrailKind;
  difficulty: 1 | 2 | 3;
  /** Control points (world x/z), start first. The hub is at the origin. */
  ctrl: Vec2[];
  /** Checkpoint spacing in metres along the path. */
  checkpointEvery: number;
  /** Target times (ms) for 3 / 2 stars. 1 star for finishing. */
  starTimes: [number, number];
  /** Recommended drive mode shown in the briefing. */
  recommended: '2H' | '4H' | '4L';
  /** Rock steps: arc length (m) and height (m). */
  steps?: { t: number; h: number }[];
}

export const TRAILS: TrailDef[] = [
  {
    id: 'wadi',
    kind: 'wadi',
    difficulty: 1,
    recommended: '4H',
    checkpointEvery: 220,
    starTimes: [150_000, 240_000],
    ctrl: [
      { x: 0, z: 40 }, { x: -40, z: 160 }, { x: -150, z: 300 }, { x: -230, z: 470 },
      { x: -160, z: 640 }, { x: -20, z: 720 }, { x: 140, z: 800 }, { x: 260, z: 920 }, { x: 330, z: 1000 },
    ],
  },
  {
    id: 'crossings',
    kind: 'crossings',
    difficulty: 2,
    recommended: '4L',
    checkpointEvery: 200,
    starTimes: [240_000, 360_000],
    ctrl: [
      { x: -40, z: 0 }, { x: -160, z: -60 }, { x: -300, z: -120 }, { x: -450, z: -110 },
      { x: -600, z: -190 }, { x: -720, z: -320 }, { x: -800, z: -470 }, { x: -860, z: -600 },
    ],
  },
  {
    id: 'rocksteps',
    kind: 'rocksteps',
    difficulty: 3,
    recommended: '4L',
    checkpointEvery: 160,
    starTimes: [300_000, 450_000],
    ctrl: [
      { x: 40, z: -20 }, { x: 160, z: -120 }, { x: 290, z: -230 }, { x: 400, z: -330 },
      { x: 470, z: -430 }, { x: 540, z: -520 }, { x: 600, z: -610 }, { x: 640, z: -700 },
    ],
    steps: [
      { t: 180, h: 0.35 }, { t: 240, h: 0.4 }, { t: 320, h: 0.45 }, { t: 380, h: 0.4 },
      { t: 470, h: 0.55 }, { t: 520, h: 0.5 }, { t: 600, h: 0.6 }, { t: 650, h: 0.45 },
      { t: 740, h: 0.65 }, { t: 800, h: 0.55 }, { t: 870, h: 0.7 },
    ],
  },
];

export const trailById = (id: string): TrailDef => {
  const t = TRAILS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown trail ${id}`);
  return t;
};
