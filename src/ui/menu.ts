import { S, saveSettings } from '../core/settings';
import { BIKE_COLORS, DIFFS } from '../core/constants';
import { SEASONS } from '../engine/seasons';
import type { PlayerInfo } from '../core/types';

export interface MenuHandlers {
  solo(): void;
  createRoom(name: string): void;
  joinRoom(name: string, code: string): void;
  hostStart(): void;
  leaveLobby(): void;
  rematch(): void;
  resume(): void;   // continue a paused race
  toMenu(): void;
}

type Screen = 'title' | 'multi' | 'lobby' | 'settings' | 'howto' | 'pause' | 'finished';
interface LobbyData { players: PlayerInfo[]; code: string; isHost: boolean; }
interface FinishedData { place: number; board: Array<{ name: string; me: boolean }>; isMulti: boolean; }

const ORD = (n: number) => n + (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n] || 'th');
// Text destined for HTML text/attribute contexts. Remote players control their
// name + colour, so everything user-derived passes through one of these.
const esc = (s: string) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));
// Colours go into a CSS `style` attribute — allow only hex literals, else fall
// back. Blocks CSS-injection via a malicious peer's colour field.
const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8d8d96');

export class Menu {
  private root: HTMLElement;
  private h: MenuHandlers;
  private screen: Screen = 'title';
  private lobby?: LobbyData;
  private finished?: FinishedData;

  constructor(root: HTMLElement, h: MenuHandlers) {
    this.root = root;
    this.h = h;
    injectStyles();
    this.root.addEventListener('click', (e) => this.onClick(e));
    // Full keyboard navigation across every screen.
    addEventListener('keydown', (e) => this.onKey(e));
  }

  // Focusable controls on the current screen, in tab order (stepper arrows are
  // tabindex=-1 so they're excluded; setting rows are the nav unit).
  private focusables(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>(
      'button:not([tabindex="-1"]), input, [data-setrow]')];
  }
  private focusStep(d: number): void {
    const items = this.focusables();
    if (!items.length) return;
    let i = items.indexOf(document.activeElement as HTMLElement);
    i = i < 0 ? (d > 0 ? 0 : items.length - 1) : (i + d + items.length) % items.length;
    items[i].focus();
  }
  private onKey(e: KeyboardEvent): void {
    if (!this.root.classList.contains('show')) return;   // overlay hidden → game owns keys
    const ae = document.activeElement as HTMLElement | null;
    const row = ae?.dataset?.setrow;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this.focusStep(1); break;
      case 'ArrowUp': e.preventDefault(); this.focusStep(-1); break;
      case 'ArrowRight': if (row) { e.preventDefault(); this.applySetting(row, 1); } break;
      case 'ArrowLeft': if (row) { e.preventDefault(); this.applySetting(row, -1); } break;
      case 'Enter':
        if (ae?.id === 'rc-code') {
          e.preventDefault();
          const c = (ae as HTMLInputElement).value.trim();
          if (c) this.h.joinRoom(this.name(), c.toUpperCase());
        } else if (row) { e.preventDefault(); this.applySetting(row, 1); }
        // plain buttons activate natively on Enter/Space
        break;
      case 'Escape': this.onEscape(); break;
    }
  }
  private onEscape(): void {
    if (this.screen === 'multi' || this.screen === 'settings' || this.screen === 'howto') this.showTitle();
    else if (this.screen === 'lobby') this.h.leaveLobby();
    // 'pause' is handled by the game loop (resume); 'finished' ignores Esc
  }

  private name(): string {
    const v = (this.root.querySelector('#rc-name') as HTMLInputElement)?.value.trim();
    const n = v || localStorage.getItem('rc-name') || 'Rider';
    try { localStorage.setItem('rc-name', n); } catch { /* */ }
    return n.slice(0, 12);
  }

  showTitle(): void { this.screen = 'title'; this.render(); }
  showMulti(prefill = ''): void { this.screen = 'multi'; this.render(prefill); }
  showSettings(): void { this.screen = 'settings'; this.render(); }
  showHowTo(): void { this.screen = 'howto'; this.render(); }
  showPause(): void { this.screen = 'pause'; this.render(); }

  showLobby(players: PlayerInfo[], code: string, isHost: boolean): void {
    this.lobby = { players, code, isHost };
    this.screen = 'lobby';
    this.render();
  }
  renderLobby(players: PlayerInfo[], code: string, isHost: boolean): void {
    this.lobby = { players, code, isHost };
    if (this.screen === 'lobby') this.render();
  }
  showFinished(data: FinishedData): void { this.finished = data; this.screen = 'finished'; this.render(); }

  hide(): void { this.root.className = ''; this.root.innerHTML = ''; }

  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest('[data-act],[data-set]') as HTMLElement | null;
    if (!el) return;
    const set = el.dataset.set;
    if (set) { this.applySetting(set, Number(el.dataset.dir || 1)); return; }
    switch (el.dataset.act) {
      case 'solo': this.h.solo(); break;
      case 'multi': this.showMulti(); break;
      case 'settings': this.showSettings(); break;
      case 'howto': this.showHowTo(); break;
      case 'back': this.showTitle(); break;
      case 'create': this.h.createRoom(this.name()); break;
      case 'join': {
        const code = (this.root.querySelector('#rc-code') as HTMLInputElement)?.value.trim();
        if (code) this.h.joinRoom(this.name(), code.toUpperCase());
        break;
      }
      case 'start': this.h.hostStart(); break;
      case 'leave': this.h.leaveLobby(); break;
      case 'copy': this.copyLink(); break;
      case 'rematch': this.h.rematch(); break;
      case 'resume': this.h.resume(); break;
      case 'home': this.h.toMenu(); break;
      case 'menu': this.h.toMenu(); break;
    }
  }

  private copyLink(): void {
    if (!this.lobby) return;
    const url = location.origin + location.pathname + '?room=' + this.lobby.code;
    const b = this.root.querySelector('[data-act="copy"]') as HTMLElement | null;
    navigator.clipboard?.writeText(url).then(() => {
      if (b) { b.textContent = 'copied!'; setTimeout(() => (b.textContent = 'copy link'), 1200); }
    }).catch(() => {            // Clipboard API blocked (insecure context / perms)
      if (b) b.textContent = 'copy failed';
    });
  }

  private applySetting(key: string, dir: number): void {
    const wrap = (v: number, n: number) => (v + dir + n) % n;
    switch (key) {
      case 'diff': S.diff = wrap(S.diff, 3); break;
      case 'laps': { const o = [2, 3, 5]; S.laps = o[wrap(o.indexOf(S.laps), 3)]; break; }
      case 'traffic': S.traffic = wrap(S.traffic, 3); break;
      case 'police': S.police = !S.police; break;
      case 'bike': S.colorIdx = wrap(S.colorIdx, BIKE_COLORS.length); break;
      case 'season': S.season = wrap(S.season, SEASONS.length); break;
      case 'throttle': { const o = ['auto', 'on', 'off'] as const; S.throttle = o[wrap(o.indexOf(S.throttle), 3)]; break; }
      case 'sound': S.sound = !S.sound; break;
    }
    saveSettings();
    this.render();
    (this.root.querySelector(`[data-setrow="${key}"]`) as HTMLElement | null)?.focus(); // keep focus on the row
  }

  private render(prefill = ''): void {
    this.root.className = 'show';
    this.root.innerHTML = `<div class="rc-card">${this.body(prefill)}</div>`;
    // Auto-focus the first control so the keyboard drives the menu immediately.
    this.focusables()[0]?.focus();
  }

  private body(prefill: string): string {
    switch (this.screen) {
      case 'title': return `
        <h1>ROAD CLASH</h1>
        <p class="sub">a Road Rash tribute · rivals · traffic · cops · seasons</p>
        <button data-act="solo">SOLO &nbsp;<span class="dim">race the AI</span></button>
        <button data-act="multi">MULTIPLAYER &nbsp;<span class="dim">race friends online</span></button>
        <button class="ghost" data-act="howto">HOW TO PLAY</button>
        <button class="ghost" data-act="settings">SETTINGS</button>
        <p class="hint">↑ ↓ ← → ride &nbsp;·&nbsp; A / SPACE fight &nbsp;·&nbsp; M mute</p>`;
      case 'multi': return `
        <h2>MULTIPLAYER</h2>
        <label class="lbl">YOUR NAME</label>
        <input id="rc-name" maxlength="12" placeholder="Rider" value="${esc(localStorage.getItem('rc-name') || '')}">
        <button data-act="create">CREATE ROOM</button>
        <div class="or">— or join one —</div>
        <div class="row">
          <input id="rc-code" maxlength="8" placeholder="ROOM CODE" value="${esc(prefill)}" style="text-transform:uppercase">
          <button data-act="join">JOIN</button>
        </div>
        <button class="ghost" data-act="back">BACK</button>`;
      case 'lobby': return this.lobbyBody();
      case 'settings': return this.settingsBody();
      case 'howto': return this.howtoBody();
      case 'pause': return this.pauseBody();
      case 'finished': return this.finishedBody();
    }
  }

  private pauseBody(): string {
    return `
      <h2>PAUSED</h2>
      <p class="sub">take a breather</p>
      <button data-act="resume">CONTINUE &nbsp;<span class="dim">3 · 2 · 1</span></button>
      <button class="ghost" data-act="home">ABANDON — HOME</button>
      <p class="hint">ESC also resumes</p>`;
  }

  private howtoBody(): string {
    return `
      <h2>HOW TO PLAY</h2>
      <div class="howto">
        <h3>CONTROLS</h3>
        <table>
          <tr><td><kbd>↑</kbd></td><td>accelerate</td></tr>
          <tr><td><kbd>↓</kbd></td><td>brake / reverse pressure</td></tr>
          <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>steer &amp; lean</td></tr>
          <tr><td><kbd>A</kbd> / <kbd>Space</kbd></td><td>punch — attack the rider beside you</td></tr>
          <tr><td><kbd>M</kbd></td><td>mute / unmute</td></tr>
          <tr><td><b>Touch</b></td><td>hold a screen half to steer · on-screen BRAKE + PUNCH · auto-throttle</td></tr>
        </table>
        <h3>THE RULES OF THE ROAD</h3>
        <ul>
          <li><b>Win the race</b> — finish the laps ahead of the pack.</li>
          <li><b>Fight dirty</b> — punch rivals to knock them down, and <b>snatch</b> their CLUB or CHAIN for more reach &amp; damage.</li>
          <li><b>Heat &amp; cops</b> — knockdowns raise your HEAT. Too much and the <b>POLICE</b> give chase. Crash while they're close and you're <b>BUSTED</b> (you lose time).</li>
          <li><b>Mind the traffic</b> — it's a two-way road. Oncoming cars are lethal; rear-ending anything fast wipes you out.</li>
          <li><b>Draft</b> — tuck in behind a rider or car for a slipstream speed boost.</li>
          <li><b>Seasons change grip</b> — <b>RAINY</b> roads are slippery, <b>WINTER</b> snow a little; <b>SUMMER</b> has full grip. Pick in Settings.</li>
        </ul>
        <h3>MULTIPLAYER</h3>
        <ul>
          <li><b>Create a room</b> → share the code or link. Friends pick <b>JOIN</b> and enter it.</li>
          <li>The <b>host</b> starts the race; empty slots are filled by AI riders.</li>
        </ul>
      </div>
      <button class="ghost" data-act="back">BACK</button>`;
  }

  private lobbyBody(): string {
    const d = this.lobby!;
    const items = d.players.map((p, i) =>
      `<li><span class="dot" style="background:${safeColor(p.color)}"></span>${esc(p.name)}${i === 0 ? ' <span class="dim">(you)</span>' : ''}</li>`).join('');
    return `
      <h2>ROOM <span class="code">${esc(d.code)}</span></h2>
      <button class="mini" data-act="copy">copy link</button>
      <p class="sub">share the code or link · friends pick JOIN and enter it</p>
      <ul class="players">${items}</ul>
      ${d.isHost
        ? `<button data-act="start">START RACE</button>`
        : `<p class="hint waiting">waiting for host to start…</p>`}
      <button class="ghost" data-act="leave">LEAVE</button>`;
  }

  private settingsBody(): string {
    const rows: Array<[string, string, string]> = [
      ['DIFFICULTY', DIFFS[S.diff].name, 'diff'],
      ['LAPS', String(S.laps), 'laps'],
      ['SEASON', SEASONS[S.season].name, 'season'],
      ['TRAFFIC', ['NONE', 'LIGHT', 'HEAVY'][S.traffic], 'traffic'],
      ['POLICE', S.police ? 'ON' : 'OFF', 'police'],
      ['BIKE', BIKE_COLORS[S.colorIdx][0], 'bike'],
      ['THROTTLE', { auto: 'AUTO', on: 'ALWAYS ON', off: 'MANUAL' }[S.throttle], 'throttle'],
      ['SOUND', S.sound ? 'ON' : 'OFF', 'sound'],
    ];
    const html = rows.map(([label, val, key]) => `
      <div class="set-row" tabindex="0" data-setrow="${key}">
        <span class="set-label">${label}</span>
        <span class="stepper">
          <button class="mini" tabindex="-1" data-set="${key}" data-dir="-1">‹</button>
          <span class="set-val">${esc(val)}</span>
          <button class="mini" tabindex="-1" data-set="${key}" data-dir="1">›</button>
        </span>
      </div>`).join('');
    return `<h2>SETTINGS</h2>${html}<button class="ghost" data-act="back">BACK</button>`;
  }

  private finishedBody(): string {
    const f = this.finished!;
    const board = f.board.map((r, i) =>
      `<li class="${r.me ? 'me' : ''}">${i + 1}. ${esc(r.name)}</li>`).join('');
    return `
      <h2>RACE OVER</h2>
      <p class="sub">you finished <b>${ORD(f.place)}</b></p>
      <ol class="board">${board}</ol>
      <button data-act="rematch">${f.isMulti ? 'BACK TO LOBBY' : 'RIDE AGAIN'}</button>
      <button class="ghost" data-act="menu">MENU</button>`;
  }
}

let stylesInjected = false;
function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  #ui-root .rc-card{background:rgba(12,8,24,0.82);border:2px solid #ffd23b;border-radius:18px;
    padding:28px 34px;min-width:340px;max-width:90vw;max-height:90vh;overflow-y:auto;text-align:center;
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
    box-shadow:0 12px 60px rgba(0,0,0,.6),0 0 40px rgba(255,210,59,.08)}
  #ui-root .howto{text-align:left;max-width:480px;margin:0 auto}
  #ui-root .howto h3{color:#f2b4ff;font-size:14px;letter-spacing:2px;margin:16px 0 6px}
  #ui-root .howto table{width:100%;border-collapse:collapse;font-size:13px;color:#e6e6ee}
  #ui-root .howto td{padding:4px 8px;vertical-align:top}
  #ui-root .howto td:first-child{white-space:nowrap;width:1%;color:#ffd23b}
  #ui-root .howto ul{margin:4px 0;padding-left:18px;font-size:13px;color:#e6e6ee;line-height:1.55}
  #ui-root .howto li{margin:5px 0}
  #ui-root .howto b{color:#ffd23b;font-weight:700}
  #ui-root kbd{display:inline-block;background:rgba(255,210,59,.14);border:1px solid #ffd23b;
    border-radius:5px;padding:1px 7px;color:#ffd23b;font-size:12px;font-weight:700}
  #ui-root h1{font-size:54px;margin:0 0 4px;color:#ffd23b;letter-spacing:4px;text-shadow:0 0 24px rgba(255,210,59,.4)}
  #ui-root h2{font-size:30px;margin:0 0 10px;color:#ffd23b;letter-spacing:2px}
  #ui-root .sub{color:#f2b4ff;margin:0 0 18px;font-size:14px}
  #ui-root .hint{color:#9a93b0;font-size:12px;margin-top:16px}
  #ui-root .hint.waiting{color:#ffd23b;animation:rcpulse 1.2s infinite}
  @keyframes rcpulse{50%{opacity:.4}}
  #ui-root .dim{color:#9a93b0;font-weight:400;font-size:.85em}
  #ui-root button{display:block;width:100%;margin:9px 0;padding:13px 18px;cursor:pointer;
    font-family:inherit;font-weight:700;font-size:16px;color:#1b1140;background:#ffd23b;
    border:none;border-radius:11px;transition:transform .06s,filter .15s;letter-spacing:1px}
  #ui-root button:hover{filter:brightness(1.08)}
  #ui-root button:active{transform:translateY(1px)}
  #ui-root button.ghost{background:transparent;color:#ffd23b;border:1.5px solid #ffd23b}
  #ui-root button:focus,#ui-root [data-setrow]:focus{outline:none;
    box-shadow:0 0 0 3px #ffd23b,0 0 16px rgba(255,210,59,.45)}
  #ui-root [data-setrow]{cursor:pointer;border-radius:8px}
  #ui-root [data-setrow]:focus{background:rgba(255,210,59,.16)}
  #ui-root button.mini{display:inline-block;width:auto;margin:0;padding:4px 12px;font-size:14px;
    background:transparent;color:#ffd23b;border:1.5px solid #ffd23b;border-radius:8px}
  #ui-root input{width:100%;box-sizing:border-box;margin:6px 0;padding:12px 14px;font-family:inherit;
    font-size:16px;text-align:center;color:#fff;background:rgba(0,0,0,.4);
    border:1.5px solid #6a5a8a;border-radius:11px;letter-spacing:2px}
  #ui-root input:focus{outline:none;border-color:#ffd23b}
  #ui-root .lbl{display:block;color:#9a93b0;font-size:11px;letter-spacing:2px;margin-top:6px}
  #ui-root .row{display:flex;gap:8px}
  #ui-root .row input{flex:1}
  #ui-root .row button{width:auto;margin:6px 0;padding:12px 20px}
  #ui-root .or{color:#9a93b0;font-size:12px;margin:14px 0}
  #ui-root .code{color:#fff;background:rgba(255,210,59,.15);padding:2px 12px;border-radius:8px;letter-spacing:4px}
  #ui-root .players{list-style:none;padding:0;margin:14px 0;text-align:left}
  #ui-root .players li{padding:8px 10px;margin:4px 0;background:rgba(0,0,0,.3);border-radius:8px;
    color:#fff;font-size:15px;display:flex;align-items:center;gap:10px}
  #ui-root .dot{width:12px;height:12px;border-radius:50%;display:inline-block;box-shadow:0 0 8px currentColor}
  #ui-root .set-row{display:flex;justify-content:space-between;align-items:center;
    padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.06)}
  #ui-root .set-label{color:#ccc;font-size:14px;letter-spacing:1px}
  #ui-root .stepper{display:flex;align-items:center;gap:10px}
  #ui-root .set-val{color:#fff;min-width:96px;font-size:14px}
  #ui-root .board{text-align:left;color:#ddd;margin:10px auto;max-width:240px;font-size:15px;line-height:1.7}
  #ui-root .board li.me{color:#ffd23b;font-weight:700}
  `;
  const tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
}
