import { ctx } from '../core/view';
import { clamp } from '../core/math';
import { world } from '../core/state';
import { rrect, line } from './draw2d';
import type { WeaponKey, Traffic } from '../core/types';

export interface BikeArt {
  color: string;
  lean?: number;
  punch?: number;   // 0..1 jab progress
  dir?: number;     // punch direction
  brake?: boolean;
  weapon?: WeaponKey;
  cop?: boolean;
}

// Rear-view motorcycle + rider in 100-unit local coords.
export function drawBike(cx: number, baseY: number, w: number, o: BikeArt): void {
  const s = w / 100;
  ctx.save(); ctx.translate(cx, baseY); ctx.rotate((o.lean || 0) * 0.18); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, -2, 26, 6, 0, 0, 7); ctx.fill();              // contact shadow
  ctx.fillStyle = '#15151a'; ctx.beginPath(); ctx.ellipse(0, -13, 15, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#34343c'; ctx.beginPath(); ctx.ellipse(0, -13, 8, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = o.color; rrect(-17, -34, 34, 16, 6); rrect(-12, -40, 24, 8, 4);
  ctx.fillStyle = o.brake ? '#ff3b30' : '#7a1f1f'; rrect(-8, -31, 16, 5, 2);
  if (o.brake) {
    const g = ctx.createRadialGradient(0, -28, 2, 0, -28, 26);
    g.addColorStop(0, 'rgba(255,60,40,0.5)'); g.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = g; ctx.fillRect(-30, -54, 60, 50);
  }
  ctx.fillStyle = '#9aa0a8'; rrect(-22, -26, 6, 14, 2); rrect(16, -26, 6, 14, 2);  // exhausts
  const lx = (o.lean || 0) * 7;
  const suit = o.cop ? '#1d2b4e' : '#23232b';
  ctx.fillStyle = suit; rrect(-13 + lx, -62, 26, 30, 9);
  ctx.strokeStyle = suit; ctx.lineWidth = 7; ctx.lineCap = 'round';
  line(-9 + lx, -54, -20, -39);
  if (o.punch && o.punch > 0) {
    const ext = Math.sin(clamp(o.punch, 0, 1) * Math.PI);
    const fx = (o.dir || 1) * (18 + 34 * ext);
    line(9 + lx, -54, fx, -56);
    if (o.weapon === 'club') {
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 6; line(fx, -56, fx + (o.dir || 1) * 22, -62);
    } else if (o.weapon === 'chain') {
      ctx.strokeStyle = '#c0c4cc'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(fx, -56);
      ctx.quadraticCurveTo(fx + (o.dir || 1) * 16, -42, fx + (o.dir || 1) * 32, -52); ctx.stroke();
    }
    ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.arc(fx, -56, 6, 0, 7); ctx.fill();
  } else line(9 + lx, -54, 20, -39);
  ctx.fillStyle = o.cop ? '#f2f2f2' : o.color;
  ctx.beginPath(); ctx.arc(lx * 0.8, -71, 11, 0, 7); ctx.fill();                 // helmet
  ctx.fillStyle = 'rgba(20,24,40,0.8)';
  ctx.beginPath(); ctx.arc(lx * 0.8 - 3, -70, 5, 0, 7); ctx.fill();              // visor
  if (o.cop) {
    const ph = Math.floor(world.worldT * 6) % 2;
    ctx.fillStyle = '#222'; rrect(-16, -88, 32, 8, 3);
    ctx.fillStyle = ph ? '#ff2d2d' : '#2d4bff'; rrect(-14, -87, 13, 6, 2);
    ctx.fillStyle = ph ? '#2d4bff' : '#ff2d2d'; rrect(1, -87, 13, 6, 2);
    const g = ctx.createRadialGradient(0, -84, 4, 0, -84, 40);
    g.addColorStop(0, ph ? 'rgba(255,45,45,0.5)' : 'rgba(45,75,255,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-44, -128, 88, 88);
  }
  ctx.restore();
}

// Civilian car / van, rear or front (oncoming) view, in 100-unit local coords.
export function drawCarBody(t: Traffic): void {
  const roofH = t.van ? 30 : 20, roofW = t.van ? 62 : 52;
  if (t.oncoming) {
    for (const hx of [-26, 26]) {
      const g = ctx.createRadialGradient(hx, -22, 3, hx, -22, 30);
      g.addColorStop(0, 'rgba(255,240,190,0.9)'); g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g; ctx.fillRect(hx - 32, -54, 64, 64);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, -2, 44, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = t.color; rrect(-40, -36, 80, 28, 8);
  ctx.fillStyle = t.color; rrect(-roofW / 2, -36 - roofH, roofW, roofH + 6, 8);
  ctx.fillStyle = '#1a2030';
  rrect(-roofW / 2 + 5, -34 - roofH, roofW - 10, roofH - 6, 5);                  // glass
  if (t.oncoming) {
    ctx.fillStyle = '#fff7d8'; rrect(-32, -26, 13, 8, 3); rrect(19, -26, 13, 8, 3);
  } else {
    ctx.fillStyle = '#ff3b30'; rrect(-36, -28, 12, 7, 3); rrect(24, -28, 12, 7, 3);
    const g = ctx.createRadialGradient(0, -24, 4, 0, -24, 36);
    g.addColorStop(0, 'rgba(255,60,40,0.25)'); g.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = g; ctx.fillRect(-44, -52, 88, 56);
  }
  ctx.fillStyle = '#15151a'; rrect(-38, -12, 14, 10, 3); rrect(24, -12, 14, 10, 3);
}
