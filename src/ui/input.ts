import { canvas } from '../core/view';
import { W, H, BTN } from '../core/constants';
import { world, input } from '../core/state';
import { S, saveSettings } from '../core/settings';
import { ensureAudio, setMuted } from '../engine/audio';

// Maps a pointer to a control role based on screen zones / on-screen buttons.
function cPos(e: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
function roleFor(p: { x: number; y: number }): string {
  if (Math.hypot(p.x - BTN.boost.x, p.y - BTN.boost.y) < BTN.boost.r + 18) return 'boost';
  if (Math.hypot(p.x - BTN.punch.x, p.y - BTN.punch.y) < BTN.punch.r + 22) return 'punch';
  if (Math.hypot(p.x - BTN.brake.x, p.y - BTN.brake.y) < BTN.brake.r + 22) return 'brake';
  return p.x < W / 2 ? 'left' : 'right';
}
function refreshTouch(): void {
  const T = input.TOUCH;
  T.steer = 0; T.brake = false; T.punch = false; T.boost = false;
  for (const role of Object.values(input.activePtrs)) {
    if (role === 'left') T.steer = -1;
    else if (role === 'right') T.steer = 1;
    else if (role === 'brake') T.brake = true;
    else if (role === 'punch') T.punch = true;
    else if (role === 'boost') T.boost = true;
  }
}

const RACE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyA'];

const isTyping = (): boolean => {
  const t = document.activeElement?.tagName;
  return t === 'INPUT' || t === 'TEXTAREA';
};

export function toggleFullscreen(): void {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => { /* */ });
  else document.exitFullscreen?.();
}

export function initInput(): void {
  addEventListener('keydown', (e) => {
    if (RACE_KEYS.includes(e.code)) e.preventDefault();
    input.KEYS[e.code] = true;
    ensureAudio();
    if (isTyping()) return;   // don't hijack M/F while typing a name/room code
    if (e.code === 'KeyM') { S.sound = !S.sound; setMuted(!S.sound); saveSettings(); }
    if (e.code === 'KeyF') toggleFullscreen();
  });
  addEventListener('keyup', (e) => { input.KEYS[e.code] = false; });
  addEventListener('blur', () => { for (const k in input.KEYS) input.KEYS[k] = false; });

  // Touch / pointer steering is only meaningful during a race; the menus are
  // their own DOM layer and handle their own clicks.
  canvas.addEventListener('pointerdown', (e) => {
    if (world.game.state !== 'race' || world.game.paused || world.game.resumeT > 0) return;
    e.preventDefault();
    if (e.pointerType === 'touch') input.touchActive = true;
    ensureAudio();
    input.activePtrs[e.pointerId] = roleFor(cPos(e));
    refreshTouch();
  });
  canvas.addEventListener('pointermove', (e) => {
    const role = input.activePtrs[e.pointerId];
    if (role === 'left' || role === 'right') {
      input.activePtrs[e.pointerId] = cPos(e).x < W / 2 ? 'left' : 'right';
      refreshTouch();
    }
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    canvas.addEventListener(ev, (e) => { delete input.activePtrs[e.pointerId]; refreshTouch(); });
  }
}
