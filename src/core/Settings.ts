export type Quality = 'low' | 'medium' | 'high';
export type Lang = 'he' | 'en';

export interface QualityPreset {
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  terrainSegments: number; // render mesh resolution per side
  props: number;           // 0..1 density multiplier
  dust: boolean;
  anisotropy: number;
  fogFar: number;
}

export const PRESETS: Record<Quality, QualityPreset> = {
  low:    { pixelRatio: 1,   shadows: false, shadowMapSize: 1024, terrainSegments: 256, props: 0.35, dust: false, anisotropy: 2, fogFar: 1100 },
  medium: { pixelRatio: 1.5, shadows: true,  shadowMapSize: 2048, terrainSegments: 384, props: 0.7,  dust: true,  anisotropy: 4, fogFar: 1500 },
  high:   { pixelRatio: 2,   shadows: true,  shadowMapSize: 4096, terrainSegments: 512, props: 1,    dust: true,  anisotropy: 8, fogFar: 2000 },
};

export interface SettingsData {
  quality: Quality;
  lang: Lang;
  sound: boolean;
  volume: number;
  invertSteerTouch: boolean;
}

const KEY = 'offroad-sim.settings.v1';

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
}

function autoQuality(): Quality {
  if (isMobile()) return 'low';
  const dpr = window.devicePixelRatio || 1;
  return dpr > 1.5 ? 'medium' : 'high';
}

function autoLang(): Lang {
  const l = (navigator.language || 'en').toLowerCase();
  return l.startsWith('he') || l.startsWith('iw') ? 'he' : 'en';
}

export class Settings {
  data: SettingsData;
  private listeners = new Set<(s: SettingsData) => void>();

  constructor() {
    this.data = { quality: autoQuality(), lang: autoLang(), sound: true, volume: 0.7, invertSteerTouch: false };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch { /* storage unavailable */ }
    const q = new URLSearchParams(location.search).get('quality');
    if (q === 'low' || q === 'medium' || q === 'high') this.data.quality = q;
    const l = new URLSearchParams(location.search).get('lang');
    if (l === 'he' || l === 'en') this.data.lang = l;
  }

  get preset(): QualityPreset { return PRESETS[this.data.quality]; }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
    for (const l of this.listeners) l(this.data);
  }

  onChange(l: (s: SettingsData) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
