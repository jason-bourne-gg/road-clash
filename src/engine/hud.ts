import { ctx } from '../core/view';
import { W, H, WEAPONS, BTN } from '../core/constants';
import { clamp, fmtTime } from '../core/math';
import { world, input } from '../core/state';
import { S } from '../core/settings';

// In-race heads-up display: speed, lap/time, position, health, weapon, heat,
// transient messages, countdown, busted/flash overlays.
export function renderHud(): void {
  const player = world.player;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, 52);
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 30px monospace';
  ctx.fillText(Math.round(player.speed / 55) + ' km/h', 24, 36);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace';
  ctx.fillText('LAP ' + Math.min(player.lap, S.laps) + '/' + S.laps + '   ' + fmtTime(player.lapTime) +
    (player.bestLap ? '   BEST ' + fmtTime(player.bestLap) : ''), W / 2, 34);
  ctx.textAlign = 'right';
  ctx.fillText('POS ' + player.place + '/' + (world.riders.length + 1), W - 24, 34);

  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(22, 60, 212, 16);
  ctx.fillStyle = player.health > 40 ? '#52c43b' : '#e23b3b';
  ctx.fillRect(24, 62, 208 * clamp(player.health, 0, 100) / 100, 12);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(22.5, 60.5, 212, 16);
  ctx.textAlign = 'left'; ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#ffd23b';
  ctx.fillText(WEAPONS[player.weapon].name, 244, 73);

  if (world.heat > 0 || world.cop) {
    ctx.textAlign = 'right'; ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ff5b4a';
    ctx.fillText('HEAT ' + '★'.repeat(Math.min(world.heat, 5)) + (world.cop ? '  🚨' : ''), W - 24, 73);
  }
  if (world.game.msgT > 0 && world.game.msg) {
    ctx.textAlign = 'center'; ctx.font = 'bold 44px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(world.game.msg, W / 2 + 3, H * 0.3 + 3);
    ctx.fillStyle = world.game.msg === 'BUSTED!' ? '#ff4a4a' : '#ffd23b';
    ctx.fillText(world.game.msg, W / 2, H * 0.3);
  }
  if (world.game.countdown > 0.7) {
    const d = Math.ceil(world.game.countdown - 0.7);
    ctx.textAlign = 'center'; ctx.font = 'bold 120px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(String(d), W / 2 + 4, H * 0.45 + 4);
    ctx.fillStyle = '#ffd23b'; ctx.fillText(String(d), W / 2, H * 0.45);
  }
  if (player.bustedT > 0) {
    ctx.fillStyle = 'rgba(120,10,10,' + (0.25 + 0.1 * Math.sin(world.worldT * 10)) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (world.game.flash > 0) {
    ctx.fillStyle = 'rgba(255,40,40,' + (0.25 * clamp(world.game.flash, 0, 1)) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

// Big 3 · 2 · 1 number shown when resuming from pause.
export function renderResumeCountdown(resumeT: number): void {
  ctx.fillStyle = 'rgba(8,4,16,0.4)'; ctx.fillRect(0, 0, W, H);
  const d = Math.min(3, Math.max(1, Math.ceil(resumeT)));   // always 3 · 2 · 1
  ctx.textAlign = 'center'; ctx.font = 'bold 130px monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(String(d), W / 2 + 4, H * 0.5 + 4);
  ctx.fillStyle = '#ffd23b'; ctx.fillText(String(d), W / 2, H * 0.5);
}

export function renderTouchUI(): void {
  if (!(input.touchCapable || input.touchActive)) return;
  const a = input.touchActive ? 0.45 : 0.2;
  const buttons: Array<[{ x: number; y: number; r: number }, string, boolean]> = [
    [BTN.brake, 'BRAKE', input.TOUCH.brake],
    [BTN.punch, WEAPONS[world.player.weapon].name, input.TOUCH.punch],
  ];
  for (const [b, label, active] of buttons) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7);
    ctx.fillStyle = active ? 'rgba(255,210,59,0.5)' : 'rgba(0,0,0,' + a * 0.7 + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,' + (a + 0.25) + ')';
    ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, b.x, b.y + 6);
  }
  ctx.font = 'bold 42px monospace'; ctx.fillStyle = 'rgba(255,255,255,' + a * 0.6 + ')';
  ctx.fillText('‹', 30, H * 0.5); ctx.fillText('›', W - 30, H * 0.5);
}
