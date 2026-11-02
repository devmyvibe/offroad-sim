import type { Lang } from '../core/Settings';

type Dict = Record<string, string>;

const he: Dict = {
  'app.title': 'Offroad Sim',
  'app.subtitle': 'סימולטור שטח מדברי · איסוזו טרופר 3.1',
  'menu.trails': 'מסלולים',
  'menu.freeRoam': 'נסיעה חופשית',
  'menu.settings': 'הגדרות',
  'menu.controls': 'שליטה',
  'menu.start': 'התחל',
  'menu.back': 'חזרה',
  'menu.resume': 'המשך',
  'menu.restart': 'התחל מחדש',
  'menu.toMenu': 'לתפריט הראשי',
  'menu.retry': 'נסה שוב',
  'menu.totalStars': 'סה"כ כוכבים',
  'menu.best': 'שיא',
  'menu.noTime': '--:--',
  'menu.recommended': 'מצב מומלץ',
  'menu.difficulty': 'קושי',
  'menu.length': 'אורך',
  'menu.loading': 'טוען את המדבר…',
  'menu.tapToStart': 'לחץ כדי להתחיל',
  'trail.wadi': 'ואדי החול',
  'trail.wadi.desc': 'ערוץ חולי רחב ודיונות רכות. שמור על מומנטום, אל תפסיק באמצע.',
  'trail.crossings': 'שביל ההצלבות',
  'trail.crossings.desc': 'סלעים חצי-קבורים שמרימים גלגל אחד בכל פעם. איטי ומדויק.',
  'trail.technical': 'המסלול הטכני',
  'trail.technical.desc': 'ואדי, גן סלעים, מדרגות, חציית ערוץ, שיפוע צד ועלייה בחצץ. 4L חובה, גז עדין, לבחור קו.',
  'diff.1': 'קל', 'diff.2': 'בינוני', 'diff.3': 'קשה',
  'hud.kmh': 'קמ"ש',
  'hud.rpm': 'סל"ד',
  'hud.gear': 'הילוך',
  'hud.checkpoint': 'נקודה',
  'hud.time': 'זמן',
  'hud.pitch': 'שיפוע',
  'hud.roll': 'גלגול',
  'hud.reset': 'איפוס',
  'hud.camera': 'מצלמה',
  'hud.gearR': 'R',
  'hud.gearN': 'N',
  'msg.stopFor4L': 'האט מתחת ל-12 קמ"ש כדי לשלב או לשחרר 4L',
  'msg.mode.2H': 'הנעה אחורית (2H)',
  'msg.mode.4H': 'הנעה כפולה (4H)',
  'msg.mode.4L': 'הנעה כפולה, הילוך נמוך (4L)',
  'msg.checkpoint': 'נקודת ביקורת {n}/{total}',
  'msg.resetPenalty': 'איפוס לנקודה האחרונה (+{s} שניות)',
  'msg.flipped': 'הרכב על הצד. לחץ R לאיפוס',
  'msg.go': 'סע!',
  'msg.finish': 'סיימת!',
  'msg.newBest': 'שיא חדש!',
  'finish.title': 'סיום המסלול',
  'finish.time': 'זמן',
  'finish.resets': 'איפוסים',
  'finish.stars': 'כוכבים',
  'finish.goal3': 'ל-3 כוכבים',
  'finish.goal2': 'ל-2 כוכבים',
  'settings.lang': 'שפה',
  'settings.quality': 'איכות גרפית',
  'settings.sound': 'סאונד',
  'settings.volume': 'עוצמה',
  'settings.invertSteer': 'היגוי הפוך במגע',
  'quality.low': 'נמוכה', 'quality.medium': 'בינונית', 'quality.high': 'גבוהה',
  'on': 'פעיל', 'off': 'כבוי',
  'controls.title': 'שליטה',
  'controls.keys': 'W/S או חיצים: גז/בלם-אחורי · A/D: היגוי · רווח: בלם יד · B: מעבר הנעה (2H ← 4H ← 4L) · C: מצלמה · R: איפוס · Esc: תפריט',
  'controls.touch': 'במגע: הגה בצד שמאל, גז ובלם בצד ימין, כפתורי מצב הנעה ומצלמה למעלה.',
  'free.title': 'נסיעה חופשית',
  'free.desc': 'כל המפה פתוחה. אין טיימר ואין כוכבים.',
};

const en: Dict = {
  'app.title': 'Offroad Sim',
  'app.subtitle': 'Desert off-road simulator · Isuzu Trooper 3.1',
  'menu.trails': 'Trails',
  'menu.freeRoam': 'Free roam',
  'menu.settings': 'Settings',
  'menu.controls': 'Controls',
  'menu.start': 'Start',
  'menu.back': 'Back',
  'menu.resume': 'Resume',
  'menu.restart': 'Restart',
  'menu.toMenu': 'Main menu',
  'menu.retry': 'Retry',
  'menu.totalStars': 'Total stars',
  'menu.best': 'Best',
  'menu.noTime': '--:--',
  'menu.recommended': 'Recommended',
  'menu.difficulty': 'Difficulty',
  'menu.length': 'Length',
  'menu.loading': 'Loading the desert…',
  'menu.tapToStart': 'Tap to start',
  'trail.wadi': 'Sand Wadi',
  'trail.wadi.desc': 'A wide sandy channel and soft dunes. Keep your momentum, never stop halfway.',
  'trail.crossings': 'The Crossings',
  'trail.crossings.desc': 'Half-buried rocks that lift one wheel at a time. Slow and precise.',
  'trail.technical': 'The Technical',
  'trail.technical.desc': 'Wadi, rock garden, ledges, a ditch crossing, off-camber and a loose climb. 4L, gentle throttle, pick your line.',
  'diff.1': 'Easy', 'diff.2': 'Medium', 'diff.3': 'Hard',
  'hud.kmh': 'km/h',
  'hud.rpm': 'rpm',
  'hud.gear': 'Gear',
  'hud.checkpoint': 'CP',
  'hud.time': 'Time',
  'hud.pitch': 'Pitch',
  'hud.roll': 'Roll',
  'hud.reset': 'Reset',
  'hud.camera': 'Camera',
  'hud.gearR': 'R',
  'hud.gearN': 'N',
  'msg.stopFor4L': 'Slow below 12 km/h to engage or release 4L',
  'msg.mode.2H': 'Rear-wheel drive (2H)',
  'msg.mode.4H': 'Four-wheel drive (4H)',
  'msg.mode.4L': 'Four-wheel drive, low range (4L)',
  'msg.checkpoint': 'Checkpoint {n}/{total}',
  'msg.resetPenalty': 'Reset to last checkpoint (+{s}s)',
  'msg.flipped': 'The truck is on its side. Press R to reset',
  'msg.go': 'Go!',
  'msg.finish': 'Finished!',
  'msg.newBest': 'New best!',
  'finish.title': 'Trail complete',
  'finish.time': 'Time',
  'finish.resets': 'Resets',
  'finish.stars': 'Stars',
  'finish.goal3': 'for 3 stars',
  'finish.goal2': 'for 2 stars',
  'settings.lang': 'Language',
  'settings.quality': 'Graphics quality',
  'settings.sound': 'Sound',
  'settings.volume': 'Volume',
  'settings.invertSteer': 'Invert touch steering',
  'quality.low': 'Low', 'quality.medium': 'Medium', 'quality.high': 'High',
  'on': 'On', 'off': 'Off',
  'controls.title': 'Controls',
  'controls.keys': 'W/S or arrows: throttle/brake-reverse · A/D: steer · Space: handbrake · B: drive mode (2H → 4H → 4L) · C: camera · R: reset · Esc: menu',
  'controls.touch': 'Touch: steering on the left, throttle and brake on the right, drive-mode and camera buttons at the top.',
  'free.title': 'Free roam',
  'free.desc': 'The whole map is open. No timer, no stars.',
};

const dicts: Record<Lang, Dict> = { he, en };

export class I18n {
  private listeners = new Set<() => void>();
  constructor(public lang: Lang) { this.applyDir(); }

  t(key: string, vars?: Record<string, string | number>): string {
    let s = dicts[this.lang][key] ?? dicts.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  }

  setLang(lang: Lang): void {
    this.lang = lang; this.applyDir();
    for (const l of this.listeners) l();
  }

  onChange(l: () => void): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }

  get rtl(): boolean { return this.lang === 'he'; }

  private applyDir(): void {
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.rtl ? 'rtl' : 'ltr';
  }
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60, d = Math.floor((ms % 1000) / 100);
  return `${m}:${s.toString().padStart(2, '0')}.${d}`;
}
