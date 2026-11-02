import type { I18n } from './i18n';
import { formatTime } from './i18n';
import type { Settings, Quality } from '../core/Settings';
import type { Save } from '../core/Save';
import { TRAILS, type TrailDef } from '../trails/trails';
import type { RunResult } from '../trails/TrailRunner';

export type MenuScreen = 'main' | 'trails' | 'settings' | 'controls' | 'pause' | 'finish' | 'none';

export interface MenuActions {
  startTrail(def: TrailDef): void;
  freeRoam(): void;
  resume(): void;
  restart(): void;
  toMenu(): void;
}

/** DOM menus: main, trail picker, settings, controls, pause, finish. */
export class Menu {
  readonly el: HTMLElement;
  screen: MenuScreen = 'none';
  private trailLengths = new Map<string, number>();
  private lastResult: { def: TrailDef; r: RunResult } | null = null;

  constructor(parent: HTMLElement, private i18n: I18n, private settings: Settings, private save: Save, private actions: MenuActions) {
    this.el = document.createElement('div');
    this.el.className = 'menu hidden';
    parent.appendChild(this.el);
    i18n.onChange(() => this.render());
  }

  setTrailLength(id: string, metres: number): void { this.trailLengths.set(id, metres); }

  show(screen: MenuScreen): void {
    this.screen = screen;
    this.el.classList.toggle('hidden', screen === 'none');
    this.render();
  }

  showFinish(def: TrailDef, r: RunResult): void { this.lastResult = { def, r }; this.show('finish'); }

  private render(): void {
    const t = (k: string, v?: Record<string, string | number>) => this.i18n.t(k, v);
    const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
    let html = '';
    switch (this.screen) {
      case 'main':
        html = `<div class="panel main">
          <h1>${t('app.title')}</h1><p class="sub">${t('app.subtitle')}</p>
          <div class="stars-total">${t('menu.totalStars')}: <b>${this.save.totalStars()}</b> / ${TRAILS.length * 3}</div>
          <button class="btn primary" data-a="trails">${t('menu.trails')}</button>
          <button class="btn" data-a="free">${t('menu.freeRoam')}</button>
          <button class="btn" data-a="settings">${t('menu.settings')}</button>
          <button class="btn" data-a="controls">${t('menu.controls')}</button>
          <div class="lang-row"><button class="chip ${this.i18n.lang === 'he' ? 'on' : ''}" data-lang="he">עברית</button><button class="chip ${this.i18n.lang === 'en' ? 'on' : ''}" data-lang="en">English</button></div>
        </div>`;
        break;
      case 'trails':
        html = `<div class="panel wide"><h2>${t('menu.trails')}</h2><div class="trail-list">` + TRAILS.map((d) => {
          const s = this.save.trail(d.id);
          const len = this.trailLengths.get(d.id);
          return `<div class="trail-card diff-${d.difficulty}">
            <div class="trail-head"><h3>${t('trail.' + d.id)}</h3><span class="stars">${stars(s.stars)}</span></div>
            <p>${t('trail.' + d.id + '.desc')}</p>
            <div class="meta"><span>${t('menu.difficulty')}: ${t('diff.' + d.difficulty)}</span><span>${t('menu.recommended')}: ${d.recommended}</span>${len ? `<span>${t('menu.length')}: ${(len / 1000).toFixed(1)} km</span>` : ''}<span>${t('menu.best')}: ${s.bestTimeMs ? formatTime(s.bestTimeMs) : t('menu.noTime')}</span></div>
            <button class="btn primary" data-trail="${d.id}">${t('menu.start')}</button>
          </div>`;
        }).join('') + `</div><button class="btn" data-a="main">${t('menu.back')}</button></div>`;
        break;
      case 'settings': {
        const s = this.settings.data;
        const qopt = (q: Quality) => `<button class="chip ${s.quality === q ? 'on' : ''}" data-q="${q}">${t('quality.' + q)}</button>`;
        html = `<div class="panel"><h2>${t('menu.settings')}</h2>
          <div class="row"><span>${t('settings.lang')}</span><span><button class="chip ${s.lang === 'he' ? 'on' : ''}" data-lang="he">עברית</button><button class="chip ${s.lang === 'en' ? 'on' : ''}" data-lang="en">English</button></span></div>
          <div class="row"><span>${t('settings.quality')}</span><span>${qopt('low')}${qopt('medium')}${qopt('high')}</span></div>
          <div class="row"><span>${t('settings.sound')}</span><span><button class="chip ${s.sound ? 'on' : ''}" data-sound="1">${t('on')}</button><button class="chip ${!s.sound ? 'on' : ''}" data-sound="0">${t('off')}</button></span></div>
          <div class="row"><span>${t('settings.volume')}</span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-vol></div>
          <div class="row"><span>${t('settings.invertSteer')}</span><span><button class="chip ${s.invertSteerTouch ? 'on' : ''}" data-inv="1">${t('on')}</button><button class="chip ${!s.invertSteerTouch ? 'on' : ''}" data-inv="0">${t('off')}</button></span></div>
          <button class="btn" data-a="main">${t('menu.back')}</button></div>`;
        break;
      }
      case 'controls':
        html = `<div class="panel"><h2>${t('controls.title')}</h2><p>${t('controls.keys')}</p><p>${t('controls.touch')}</p><button class="btn" data-a="main">${t('menu.back')}</button></div>`;
        break;
      case 'pause':
        html = `<div class="panel"><h2>${t('app.title')}</h2>
          <button class="btn primary" data-a="resume">${t('menu.resume')}</button>
          <button class="btn" data-a="restart">${t('menu.restart')}</button>
          <button class="btn" data-a="settings-pause">${t('menu.settings')}</button>
          <button class="btn" data-a="tomenu">${t('menu.toMenu')}</button></div>`;
        break;
      case 'finish': {
        const lr = this.lastResult; if (!lr) break;
        const [t3, t2] = lr.def.starTimes;
        html = `<div class="panel"><h2>${t('finish.title')}</h2><h3>${t('trail.' + lr.def.id)}</h3>
          <div class="result-stars">${stars(lr.r.stars)}</div>
          ${lr.r.improved ? `<div class="newbest">${t('msg.newBest')}</div>` : ''}
          <div class="row"><span>${t('finish.time')}</span><b>${formatTime(lr.r.timeMs)}</b></div>
          <div class="row"><span>${t('finish.resets')}</span><b>${lr.r.resets}</b></div>
          <div class="row small"><span>${formatTime(t3)} ${t('finish.goal3')}</span><span>${formatTime(t2)} ${t('finish.goal2')}</span></div>
          <button class="btn primary" data-a="restart">${t('menu.retry')}</button>
          <button class="btn" data-a="tomenu">${t('menu.toMenu')}</button></div>`;
        break;
      }
      case 'none': html = ''; break;
    }
    this.el.innerHTML = html;
    this.bind();
  }

  private bind(): void {
    const on = (sel: string, fn: (el: HTMLElement) => void) => this.el.querySelectorAll<HTMLElement>(sel).forEach((e) => e.addEventListener('click', () => fn(e)));
    on('[data-a]', (e) => {
      switch (e.dataset.a) {
        case 'trails': this.show('trails'); break;
        case 'main': this.show('main'); break;
        case 'settings': this.show('settings'); break;
        case 'settings-pause': this.show('settings'); this.el.querySelector<HTMLElement>('[data-a="main"]')!.dataset.a = 'pause'; this.bind(); break;
        case 'pause': this.show('pause'); break;
        case 'controls': this.show('controls'); break;
        case 'free': this.actions.freeRoam(); break;
        case 'resume': this.actions.resume(); break;
        case 'restart': this.actions.restart(); break;
        case 'tomenu': this.actions.toMenu(); break;
      }
    });
    on('[data-trail]', (e) => this.actions.startTrail(TRAILS.find((d) => d.id === e.dataset.trail)!));
    on('[data-lang]', (e) => { this.settings.set('lang', e.dataset.lang as 'he' | 'en'); this.i18n.setLang(e.dataset.lang as 'he' | 'en'); });
    on('[data-q]', (e) => { this.settings.set('quality', e.dataset.q as Quality); this.render(); });
    on('[data-sound]', (e) => { this.settings.set('sound', e.dataset.sound === '1'); this.render(); });
    on('[data-inv]', (e) => { this.settings.set('invertSteerTouch', e.dataset.inv === '1'); this.render(); });
    this.el.querySelector<HTMLInputElement>('[data-vol]')?.addEventListener('input', (ev) => this.settings.set('volume', Number((ev.target as HTMLInputElement).value)));
  }
}
