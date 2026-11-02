export interface TrailResult {
  bestTimeMs: number | null;
  stars: number; // 0..3
  attempts: number;
}

export interface SaveData {
  trails: Record<string, TrailResult>;
}

const KEY = 'offroad-sim.save.v1';

export class Save {
  data: SaveData = { trails: {} };

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { trails: {}, ...JSON.parse(raw) };
    } catch { /* ignore */ }
  }

  trail(id: string): TrailResult {
    return this.data.trails[id] ?? (this.data.trails[id] = { bestTimeMs: null, stars: 0, attempts: 0 });
  }

  /** Record a finished run; returns true if it improved the best. */
  recordRun(id: string, timeMs: number, stars: number): boolean {
    const t = this.trail(id);
    t.attempts++;
    let improved = false;
    if (t.bestTimeMs === null || timeMs < t.bestTimeMs) { t.bestTimeMs = timeMs; improved = true; }
    if (stars > t.stars) { t.stars = stars; improved = true; }
    this.flush();
    return improved;
  }

  recordAttempt(id: string): void {
    this.trail(id).attempts++;
    this.flush();
  }

  totalStars(): number {
    return Object.values(this.data.trails).reduce((a, t) => a + t.stars, 0);
  }

  flush(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
}
