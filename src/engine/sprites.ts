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

// Rear-view sportbike + tucked rider in 100-unit local coords.
export function drawBike(cx: number, baseY: number, w: number, o: BikeArt): void {
  const s = w / 100;
  const lean = o.lean || 0;
  const lx = lean * 7;
  const dir = o.dir || 1;
  const accent = o.cop ? '#3a5bd0' : o.color;
  const suit = o.cop ? '#222d52' : '#26262e';

  ctx.save(); ctx.translate(cx, baseY); ctx.rotate(lean * 0.18); ctx.scale(s, s);

  // contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, -2, 27, 6, 0, 0, 7); ctx.fill();

  // rear tyre + alloy rim + hub
  ctx.fillStyle = '#0e0e12'; ctx.beginPath(); ctx.ellipse(0, -15, 16, 15, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2c2c36'; ctx.beginPath(); ctx.ellipse(0, -15, 9, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#52525f'; ctx.beginPath(); ctx.ellipse(0, -15, 4, 4, 0, 0, 7); ctx.fill();

  // twin under-tail exhaust cans
  ctx.fillStyle = '#9aa0a8'; rrect(-22, -25, 7, 13, 3); rrect(15, -25, 7, 13, 3);

  // tapered tail bodywork (team colour) + side fairings
  ctx.fillStyle = o.color;
  ctx.beginPath(); ctx.moveTo(-16, -28); ctx.lineTo(16, -28); ctx.lineTo(9, -48); ctx.lineTo(-9, -48); ctx.closePath(); ctx.fill();
  rrect(-19, -36, 8, 13, 3); rrect(11, -36, 8, 13, 3);
  // seat hump
  ctx.fillStyle = '#16161c'; rrect(-10, -52, 20, 8, 4);
  // tail / brake light
  ctx.fillStyle = o.brake ? '#ff3b30' : '#8a2222'; rrect(-7, -31, 14, 4, 2);
  if (o.brake) {
    const g = ctx.createRadialGradient(0, -29, 2, 0, -29, 28);
    g.addColorStop(0, 'rgba(255,60,40,0.55)'); g.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = g; ctx.fillRect(-32, -58, 64, 54);
  }

  // --- rider, tucked into the tank ---
  // hips on the seat
  ctx.fillStyle = suit; rrect(-12 + lx * 0.5, -56, 24, 14, 6);
  // back / torso leaning forward
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.moveTo(-11 + lx, -54); ctx.lineTo(11 + lx, -54);
  ctx.lineTo(9 + lx * 1.5, -72); ctx.lineTo(-9 + lx * 1.5, -72); ctx.closePath(); ctx.fill();
  // spine accent + shoulders (team colour)
  ctx.fillStyle = accent; rrect(-2.5 + lx * 1.3, -72, 5, 18, 2);
  ctx.beginPath(); ctx.ellipse(-9 + lx * 1.5, -71, 6, 5, 0, 0, 7); ctx.ellipse(9 + lx * 1.5, -71, 6, 5, 0, 0, 7); ctx.fill();

  // arms reaching down to the clip-on bars
  ctx.strokeStyle = suit; ctx.lineWidth = 7; ctx.lineCap = 'round';
  line(-9 + lx * 1.5, -68, -22, -45);
  if (o.punch && o.punch > 0) {
    const ext = Math.sin(clamp(o.punch, 0, 1) * Math.PI);
    const fx = dir * (20 + 34 * ext), fy = -68;
    line(9 + lx * 1.5, -68, fx, fy);
    if (o.weapon === 'club') {
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 6; line(fx, fy, fx + dir * 22, fy - 8);
    } else if (o.weapon === 'chain') {
      ctx.strokeStyle = '#c0c4cc'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + dir * 16, fy + 14, fx + dir * 32, fy + 4); ctx.stroke();
    }
    ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.arc(fx, fy, 6, 0, 7); ctx.fill();
  } else line(9 + lx * 1.5, -68, 22, -45);

  // helmet: shell + team centre stripe + dark visor
  const hx = lx * 1.6, hy = -80;
  ctx.fillStyle = o.cop ? '#f4f4f8' : '#ececf2';
  ctx.beginPath(); ctx.arc(hx, hy, 11, 0, 7); ctx.fill();
  ctx.fillStyle = accent; rrect(hx - 2.5, hy - 11, 5, 17, 2);
  ctx.fillStyle = 'rgba(16,20,36,0.88)';
  ctx.beginPath(); ctx.ellipse(hx - 1, hy + 1, 7, 4.5, 0, 0, 7); ctx.fill();

  // cop light bar
  if (o.cop) {
    const ph = Math.floor(world.worldT * 6) % 2;
    ctx.fillStyle = '#222'; rrect(-16, -100, 32, 8, 3);
    ctx.fillStyle = ph ? '#ff2d2d' : '#2d4bff'; rrect(-14, -99, 13, 6, 2);
    ctx.fillStyle = ph ? '#2d4bff' : '#ff2d2d'; rrect(1, -99, 13, 6, 2);
    const g = ctx.createRadialGradient(0, -96, 4, 0, -96, 44);
    g.addColorStop(0, ph ? 'rgba(255,45,45,0.5)' : 'rgba(45,75,255,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-46, -140, 92, 92);
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
