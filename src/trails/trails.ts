import type { Vec2 } from '../terrain/Heightmap';

export type TrailKind = 'wadi' | 'crossings' | 'technical' | 'twister';

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
    id: 'technical',
    kind: 'technical',
    difficulty: 3,
    recommended: '4L',
    checkpointEvery: 150,
    starTimes: [360_000, 540_000],
    ctrl: [
      { x: 150, z: -110 }, { x: 205, z: -150 }, { x: 265, z: -170 }, { x: 325, z: -205 }, { x: 385, z: -250 },
      { x: 430, z: -300 }, { x: 465, z: -350 }, { x: 495, z: -400 }, { x: 530, z: -450 }, { x: 560, z: -500 },
      { x: 590, z: -545 }, { x: 615, z: -590 }, { x: 640, z: -625 },
    ],
  },
  {
    id: 'twister',
    kind: 'twister',
    difficulty: 3,
    recommended: '4L',
    checkpointEvery: 140,
    starTimes: [330_000, 500_000],
    ctrl: [
      { x: -345, z: 300 }, { x: -395, z: 322 }, { x: -450, z: 345 }, { x: -505, z: 375 }, { x: -550, z: 415 },
      { x: -585, z: 460 }, { x: -615, z: 510 }, { x: -655, z: 550 }, { x: -700, z: 585 }, { x: -735, z: 630 },
      { x: -748, z: 680 }, { x: -720, z: 720 }, { x: -670, z: 738 },
    ],
  },
];

export const trailById = (id: string): TrailDef => {
  const t = TRAILS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown trail ${id}`);
  return t;
};
