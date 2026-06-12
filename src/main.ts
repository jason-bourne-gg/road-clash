import { installErrorHandlers, showErrorScreen } from './core/errors';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { ctx } from './core/view';
import { MAX_SPEED, BIKE_COLORS } from './core/constants';
import { world, input, setMsg } from './core/state';
import { S } from './core/settings';
import { randomSeed } from './core/rng';
import { buildTrack, wrapZ } from './engine/track';
import { update } from './engine/physics';
import { updateParts, renderParts } from './engine/particles';
import { setAudioLevels, setAmbient, startMusic, stopMusic } from './engine/audio';
import {
  renderBackground, renderRoad, renderPlayer, renderSpeedLines, renderWeather, renderVignette,
} from './engine/render';
import { renderHud, renderTouchUI, renderResumeCountdown } from './engine/hud';
import { initInput } from './ui/input';
import { Menu, type MenuHandlers } from './ui/menu';
import { Session } from './session/session';
import { SoloSession } from './session/soloSession';
import { MultiplayerSession } from './session/multiplayerSession';
import { TrysteroTransport } from './net/trysteroTransport';
import type { PlayerInfo } from './core/types';

installErrorHandlers();   // catch anything uncaught before it reaches the user
inject();                 // Vercel Web Analytics (no-op when not on Vercel)
injectSpeedInsights();    // Vercel Speed Insights (real-user performance)

const uiRoot = document.getElementById('ui-root') as HTMLElement;

let session: Session | null = null;
let mp: MultiplayerSession | null = null;

function clearSession(): void {
  try { session?.end(); } catch { /* */ }
  session = null; mp = null;
}
function myInfo(t: TrysteroTransport, name: string): PlayerInfo {
  return { id: t.id, name, color: BIKE_COLORS[S.colorIdx][1] };
}
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeRoomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  return s;
}

const handlers: MenuHandlers = {
  solo() {
    clearSession();
    session = new SoloSession();
    session.begin();
    menu.hide();
  },
  async createRoom(name) {
    clearSession();
    const code = makeRoomCode();
    const t = new TrysteroTransport();
    mp = new MultiplayerSession(t, myInfo(t, name), true);
    session = mp;
    mp.onLobbyChange = () => menu.renderLobby(mp!.lobbyPlayers(), code, true);
    mp.onStarted = () => menu.hide();
    history.replaceState(null, '', '?room=' + code);
    menu.showLobby(mp.lobbyPlayers(), code, true);
    try { await mp.connect(code); } catch (e) { console.error('connect failed', e); }
    menu.renderLobby(mp.lobbyPlayers(), code, true);
  },
  async joinRoom(name, code) {
    clearSession();
    const t = new TrysteroTransport();
    mp = new MultiplayerSession(t, myInfo(t, name), false);
    session = mp;
    mp.onLobbyChange = () => menu.renderLobby(mp!.lobbyPlayers(), code, false);
    mp.onStarted = () => menu.hide();
    menu.showLobby(mp.lobbyPlayers(), code, false);
    try { await mp.connect(code); } catch (e) { console.error('connect failed', e); }
    menu.renderLobby(mp.lobbyPlayers(), code, false);
  },
  hostStart() { mp?.hostStart(); },
  leaveLobby() { clearSession(); history.replaceState(null, '', location.pathname); menu.showTitle(); },
  rematch() {
    if (mp) { if (mp.isHost) mp.hostStart(); }   // host re-launches; guests auto-join the new start
    else handlers.solo();
  },
  resume() {
    const g = world.game;
    if (g.state === 'race' && g.paused) {
      g.paused = false; g.resumeT = 3.05;        // CONTINUE → 3-2-1 then race
      menu.hide(); setAmbient(false);
    }
  },
  toMenu() {
    clearSession();
    world.game.state = 'menu'; world.game.paused = false; world.game.resumeT = 0;
    setAmbient(false);
    history.replaceState(null, '', location.pathname);
    menu.showTitle();
  },
  toggleVoice() {
    if (!mp) return;
    if (mp.voice.enabled) { mp.voice.disable(); mp.onLobbyChange(); }
    else mp.voice.enable().then(() => mp && mp.onLobbyChange());
  },
  toggleMic() { mp?.voice.toggleMute(); mp?.onLobbyChange(); },
  voiceState() {
    return mp
      ? { supported: mp.voice.supported, enabled: mp.voice.enabled, muted: mp.voice.muted }
      : { supported: false, enabled: false, muted: false };
  },
};

const menu = new Menu(uiRoot, handlers);

function showStandings(): void {
  const board = [
    ...world.riders.map(c => ({ name: c.name, total: c.total, me: false })),
    { name: 'YOU', total: world.player.total, me: true },
  ].sort((a, b) => b.total - a.total).map(r => ({ name: r.name, me: r.me }));
  menu.showFinished({
    place: world.player.finalPlace || world.player.place,
    board,
    isMulti: !!mp,
  });
}

// Esc pauses a SOLO race; pressing it again starts a 3-2-1 resume countdown.
// Online races can't pause (it would freeze only your bike), so Esc is ignored.
function handleEsc(): void {
  const g = world.game;
  if (g.state !== 'race' || mp) return;
  if (g.countdown > 0.7) return;           // still in the start countdown
  if (g.paused) handlers.resume();         // ESC resumes (same as CONTINUE)
  else if (g.resumeT <= 0) {               // ESC pauses → show the pause menu
    g.paused = true;
    menu.showPause();
    setAmbient(true);
  }
}

// --- main loop: fixed-ish frame with sim sandwiched by net hooks ---
let lastT = performance.now();
let lastState = world.game.state;
let escPrev = false, vPrev = false;

function frame(now: number): void {
  try {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  world.worldT += dt;

  const escNow = !!input.KEYS.Escape;
  if (escNow && !escPrev) handleEsc();
  escPrev = escNow;

  const vNow = !!input.KEYS.KeyV;  // mute/unmute mic in-race
  if (vNow && !vPrev && mp?.voice.enabled) setMsg(mp.voice.toggleMute() ? 'MIC MUTED' : 'MIC LIVE', 1);
  vPrev = vNow;

  const g = world.game;
  if (g.state === 'race') {
    if (g.paused) {
      setAudioLevels(0);                   // engine idles, world frozen
    } else if (g.resumeT > 0) {
      g.resumeT -= dt;                     // count down 3-2-1, sim still frozen
      setAudioLevels(0);
      if (g.resumeT <= 0) { g.resumeT = 0; setMsg('GO!', 0.8); }
    } else {
      session?.beforeSim(world.worldT);    // interpolate remote riders into "now"
      update(dt);                          // simulate local player + AI
      session?.afterSim(dt, world.worldT); // publish snapshot + relay hits
    }
  } else {
    world.game.time += dt;
    setAudioLevels(0);
    updateParts(dt);
    if (world.game.state === 'menu') world.player.position = wrapZ(world.player.position + MAX_SPEED * 0.22 * dt);
  }
  if (g.state === 'race' && !g.paused) startMusic(); else stopMusic();

  ctx.save();
  if (world.game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 10 * world.game.shake, (Math.random() - 0.5) * 8 * world.game.shake);
  }
  renderBackground();
  renderRoad();
  if (world.game.state !== 'menu') renderPlayer();
  ctx.restore();
  renderParts(ctx);
  renderWeather();
  if (world.game.state === 'race') {
    renderSpeedLines(world.player.speed / MAX_SPEED);
    renderHud();
    renderTouchUI();
    if (g.resumeT > 0) renderResumeCountdown(g.resumeT);  // pause menu is DOM
  }
  renderVignette();

  if (world.game.state !== lastState) {
    if (world.game.state === 'finished') showStandings();
    lastState = world.game.state;
  }
  } catch (err) {
    showErrorScreen(err);
    return;                 // halt the loop; the error screen offers a reload
  }
  requestAnimationFrame(frame);
}

// Tabbing away from a solo race auto-pauses, so you return to a deliberate
// resume (with the 3-2-1) instead of dropping straight back into traffic.
document.addEventListener('visibilitychange', () => {
  const g = world.game;
  if (document.hidden && g.state === 'race' && !mp && !g.paused && g.countdown <= 0.7 && g.resumeT <= 0) {
    g.paused = true; menu.showPause(); setAmbient(true);
  }
});

// --- boot ---
buildTrack(randomSeed());          // scenic backdrop for the menu
initInput();
const room = new URLSearchParams(location.search).get('room');
if (room) menu.showMulti(room.toUpperCase());
else menu.showTitle();
requestAnimationFrame(frame);

// debug/test hooks (parity with the original single-file build)
(window as any).__rc = { world, S, session: () => session, mp: () => mp };
