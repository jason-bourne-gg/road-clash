import { ctx } from '../core/view';
import {
  W, H, ROAD_WIDTH, CAM_DEPTH, CAM_HEIGHT, DRAW_DIST, SEG_LEN, PLAYER_Z, RUMBLE,
  MAX_SPEED, BIKE_COLORS,
} from '../core/constants';
import { lerp, clamp, fogAmt } from '../core/math';
import { world, input } from '../core/state';
import { S } from '../core/settings';
import { findSegment, wrapZ } from './track';
import { drawBike, drawCarBody } from './sprites';
import { poly, rrect, line } from './draw2d';
import { emit } from './particles';
import { activeSeason } from './seasons';
import { gfx } from './quality';
import type { Segment, Point, Rider, Cop, Traffic, RoadSprite, Season } from '../core/types';

// Background parallax offset, advanced by physics, read here.
export const bg = { pan: 0 };

const STARS: Array<[number, number, number]> =
  Array.from({ length: 60 }, () => [Math.random() * W, Math.random() * H * 0.22, 0.2 + Math.random() * 0.6]);
const CLOUDS = Array.from({ length: 5 }, (_, i) => ({ x: i * 280 + Math.random() * 120, y: 60 + Math.random() * 90, s: 0.7 + Math.random() * 0.8 }));
// Weather particles, positions fixed at load; animation derives from worldT (no per-frame alloc).
const RAIN = Array.from({ length: 130 }, () => ({ x: Math.random() * W, y: Math.random() * H, len: 9 + Math.random() * 12, sp: 900 + Math.random() * 600 }));
const SNOW = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.4, sp: 40 + Math.random() * 60, drift: 8 + Math.random() * 22, ph: Math.random() * 6.283 }));

/* ---------------- background ---------------- */
export function renderBackground(): void {
  const sea = activeSeason();
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  const stops = sea.sky;
  g.addColorStop(0, stops[0]); g.addColorStop(0.35, stops[1]);
  g.addColorStop(0.62, stops[2]); g.addColorStop(0.85, stops[3]); g.addColorStop(1, stops[4]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (sea.id === 'summer') {
    for (const s of STARS) {
      ctx.globalAlpha = s[2] * (0.6 + 0.4 * Math.sin(world.worldT * 2 + s[0]));
      ctx.fillStyle = '#fff'; ctx.fillRect(s[0], s[1], 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  if (sea.sun) {
    const sx = W * 0.72 + bg.pan * 0.2, sy = H * 0.34;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 180);
    sg.addColorStop(0, sea.sunGlow + '0.95)'); sg.addColorStop(0.25, sea.sunGlow + '0.5)'); sg.addColorStop(1, sea.sunGlow + '0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 180, 0, 7); ctx.fill();
    ctx.fillStyle = sea.sun; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, 7); ctx.fill();
    // Bloom: a wide additive warm glow that bleeds across the sky (high tier).
    if (gfx().bloom) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const bgGlow = ctx.createRadialGradient(sx, sy, 30, sx, sy, 340);
      bgGlow.addColorStop(0, sea.sunGlow + '0.30)'); bgGlow.addColorStop(1, sea.sunGlow + '0)');
      ctx.fillStyle = bgGlow; ctx.fillRect(0, 0, W, H * 0.62);
      ctx.restore();
    }
  }
  const cloudCol = sea.id === 'rainy' ? 'rgba(120,130,140,0.45)' : sea.id === 'winter' ? 'rgba(220,228,240,0.4)' : 'rgba(245,190,200,0.30)';
  for (const c of CLOUDS) {
    const span = W + 600;
    const xx = ((c.x + bg.pan * 0.12 - world.worldT * 5) % span + span) % span - 300;
    ctx.fillStyle = cloudCol;
    ctx.beginPath();
    ctx.ellipse(xx, c.y, 70 * c.s, 16 * c.s, 0, 0, 7);
    ctx.ellipse(xx + 45 * c.s, c.y + 6, 50 * c.s, 12 * c.s, 0, 0, 7);
    ctx.ellipse(xx - 45 * c.s, c.y + 8, 45 * c.s, 11 * c.s, 0, 0, 7);
    ctx.fill();
  }
  const r1 = sea.id === 'winter' ? '#7d8aa6' : sea.id === 'rainy' ? '#28303e' : '#3a2353';
  const r2 = sea.id === 'winter' ? '#5d6a86' : sea.id === 'rainy' ? '#1c2430' : '#2a1a40';
  ridge(H * 0.42, 55, 0.011, bg.pan * 0.35, r1);
  ridge(H * 0.45, 30, 0.02, bg.pan * 0.7, r2);
}
function ridge(base: number, amp: number, freq: number, pan: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) {
    const y = base - Math.abs(Math.sin((x + pan) * freq)) * amp - Math.sin((x + pan) * freq * 2.7) * amp * 0.3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}

/* ---------------- road ---------------- */
interface Palette { road: string; grass: string; rumble: string; }
function project(p: Point, camX: number, camY: number, camZ: number): void {
  p.camera.x = (p.world.x || 0) - camX;
  p.camera.y = (p.world.y || 0) - camY;
  p.camera.z = (p.world.z || 0) - camZ;
  p.screen.scale = CAM_DEPTH / p.camera.z;
  p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
  p.screen.y = Math.round(H / 2 - p.screen.scale * p.camera.y * H / 2);
  p.screen.w = Math.round(p.screen.scale * ROAD_WIDTH * W / 2);
}

export function renderRoad(): void {
  if (!world.segments.length) return;   // defensive: nothing to project yet
  const sea = activeSeason();
  const light: Palette = { road: sea.roadLight, grass: sea.grassLight, rumble: sea.rumbleLight };
  const dark: Palette = { road: sea.roadDark, grass: sea.grassDark, rumble: sea.rumbleDark };
  const start: Palette = { road: '#bbbbbb', grass: sea.grassLight, rumble: '#bbbbbb' };

  const camPos = wrapZ(world.player.position);
  const baseSeg = findSegment(camPos);
  const basePct = (camPos % SEG_LEN) / SEG_LEN;
  const pSeg = findSegment(camPos + PLAYER_Z);
  const pPct = ((camPos + PLAYER_Z) % SEG_LEN) / SEG_LEN;
  const camY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct) + CAM_HEIGHT;
  let maxY = H, x = 0, dx = -(baseSeg.curve * basePct);

  for (const s of world.segments) s.ents.length = 0;
  for (const c of world.riders) findSegment(c.z).ents.push({ kind: 'rival', e: c });
  for (const t of world.traffic) findSegment(t.z).ents.push({ kind: 'traffic', e: t });
  if (world.cop) findSegment(world.cop.z).ents.push({ kind: 'cop', e: world.cop });

  for (let n = 0; n < DRAW_DIST; n++) {
    const seg = world.segments[(baseSeg.index + n) % world.segments.length];
    const looped = seg.index < baseSeg.index;
    seg.fog = fogAmt(n / DRAW_DIST, 4);
    project(seg.p1, world.player.x * ROAD_WIDTH - x, camY, camPos - (looped ? world.trackLength : 0));
    project(seg.p2, world.player.x * ROAD_WIDTH - x - dx, camY, camPos - (looped ? world.trackLength : 0));
    x += dx; dx += seg.curve;
    seg.clip = maxY;
    if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxY) continue;
    drawSegment(seg, seg.index < RUMBLE * 2 ? start : (seg.alt ? light : dark), sea.skyFog);
    maxY = seg.p2.screen.y;
  }
  for (let n = DRAW_DIST - 1; n > 0; n--) {
    const seg = world.segments[(baseSeg.index + n) % world.segments.length];
    for (const en of seg.ents) {
      if (en.kind === 'traffic') drawTraffic(seg, en.e as Traffic);
      else drawRider(seg, en.e as Rider | Cop, en.kind === 'cop');
    }
    for (const s of seg.sprites) drawSprite(seg, s, sea);
  }
}

function drawSegment(seg: Segment, c: Palette, skyFog: string): void {
  const p1 = seg.p1.screen, p2 = seg.p2.screen;
  ctx.fillStyle = c.grass; ctx.fillRect(0, p2.y, W, p1.y - p2.y);
  const r1 = p1.w / 8, r2 = p2.w / 8;
  poly(p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, c.rumble);
  poly(p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, c.rumble);
  poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, c.road);
  for (const k of [-0.035, 0.015]) {
    poly(p1.x + p1.w * k, p1.y, p1.x + p1.w * (k + 0.02), p1.y,
         p2.x + p2.w * (k + 0.02), p2.y, p2.x + p2.w * k, p2.y, '#d8b23b');
  }
  for (const k of [-0.95, 0.93]) {
    poly(p1.x + p1.w * k, p1.y, p1.x + p1.w * (k + 0.02), p1.y,
         p2.x + p2.w * (k + 0.02), p2.y, p2.x + p2.w * k, p2.y, '#cfcfcf');
  }
  if (seg.alt) {
    for (const k of [-0.5, 0.5]) {
      poly(p1.x + p1.w * k - p1.w / 48, p1.y, p1.x + p1.w * k + p1.w / 48, p1.y,
           p2.x + p2.w * k + p2.w / 48, p2.y, p2.x + p2.w * k - p2.w / 48, p2.y, '#cfcfcf');
    }
  }
  if (seg.fog < 1) {
    ctx.globalAlpha = 1 - seg.fog; ctx.fillStyle = skyFog;
    ctx.fillRect(0, p2.y, W, p1.y - p2.y); ctx.globalAlpha = 1;
  }
}

/* ---------------- roadside sprites (season-tinted) ---------------- */
function drawSprite(seg: Segment, s: RoadSprite, sea: Season): void {
  if (seg.p1.camera.z <= CAM_DEPTH) return;
  const sc = seg.p1.screen.scale;
  const x = seg.p1.screen.x + sc * s.offset * ROAD_WIDTH * W / 2;
  const y = seg.p1.screen.y;
  if (y >= seg.clip + 5) return;
  const u = seg.p1.screen.w / 100;
  ctx.save(); ctx.translate(x, y); ctx.scale(u, u);
  if (s.kind === 'palm') {
    ctx.fillStyle = sea.trunk; ctx.fillRect(-3, -46, 6, 46);
    ctx.strokeStyle = sea.foliage; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let a = 0; a < 6; a++) {
      const ang = Math.PI * (0.15 + a * 0.14);
      ctx.beginPath(); ctx.moveTo(0, -46);
      ctx.quadraticCurveTo(Math.cos(ang) * 14, -58, Math.cos(ang) * 30, -38);
      ctx.stroke();
    }
  } else if (s.kind === 'sign') {
    ctx.fillStyle = '#888'; ctx.fillRect(-2, -30, 4, 30);
    ctx.fillStyle = '#f0a020'; ctx.fillRect(-14, -44, 28, 16);
    ctx.fillStyle = '#222'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('66', 0, -32);
  } else if (s.kind === 'bush') {
    ctx.fillStyle = sea.foliage; ctx.beginPath(); ctx.ellipse(0, -8, 16, 9, 0, 0, 7); ctx.fill();
  } else if (s.kind === 'rock') {
    ctx.fillStyle = sea.id === 'winter' ? '#cfd8e2' : '#8d8d96'; ctx.beginPath(); ctx.ellipse(0, -7, 13, 8, 0, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = sea.foliage;
    ctx.fillRect(-3, -30, 6, 30); ctx.fillRect(-11, -26, 5, 12); ctx.fillRect(6, -24, 5, 10);
  }
  ctx.restore();
}

/* ---------------- entities on the road ---------------- */
function entScreen(seg: Segment, z: number, offset: number): { x: number; y: number; w: number } {
  const pct = (z % SEG_LEN) / SEG_LEN;
  const sc = lerp(seg.p1.screen.scale, seg.p2.screen.scale, pct);
  return {
    x: lerp(seg.p1.screen.x, seg.p2.screen.x, pct) + sc * offset * ROAD_WIDTH * W / 2,
    y: lerp(seg.p1.screen.y, seg.p2.screen.y, pct),
    w: lerp(seg.p1.screen.w, seg.p2.screen.w, pct),
  };
}
function drawRider(seg: Segment, c: Rider | Cop, isCop: boolean): void {
  if (seg.p1.camera.z <= CAM_DEPTH) return;
  const p = entScreen(seg, c.z, c.offset);
  if (p.y >= seg.clip + 5) return;
  const size = p.w * 0.15;
  const lean = (c.wobble > 0 ? Math.sin(world.worldT * 40) * 0.3 : 0) + (c.knocked > 0 ? 1.25 : 0);
  drawBike(p.x, p.y, size, {
    color: c.color || '#f2f2f2', lean,
    punch: c.punchT > 0 ? 1 - c.punchT / 0.3 : 0, dir: Math.sign(world.player.x - c.offset) || 1,
    weapon: c.weapon, cop: isCop,
  });
  if (c.knocked > 0 && Math.random() < 0.4)
    emit(p.x, p.y, 1, { color: '#b58a5a', vy0: -40, life: 0.5, size: Math.max(3, size * 0.06), vx: 100 });
  if (size > 26 && c.knocked <= 0) {
    ctx.fillStyle = isCop ? '#9db4ff' : 'rgba(255,255,255,0.85)';
    ctx.font = 'bold ' + Math.max(10, size * 0.14) + 'px monospace'; ctx.textAlign = 'center';
    ctx.fillText(isCop ? 'POLICE' : c.name, p.x, p.y - size * (isCop ? 1.35 : 1.05));
  }
}
function drawTraffic(seg: Segment, t: Traffic): void {
  if (seg.p1.camera.z <= CAM_DEPTH) return;
  const p = entScreen(seg, t.z, t.offset);
  if (p.y >= seg.clip + 5) return;
  const size = p.w * 0.26;
  const s = size / 100;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s);
  drawCarBody(t);
  ctx.restore();
}

/* ---------------- player ---------------- */
export function renderPlayer(): void {
  const player = world.player;
  const spct = player.speed / MAX_SPEED;
  const bounce = Math.sin(world.game.time * 30) * spct * 2.5;
  const seg = findSegment(wrapZ(player.position + PLAYER_Z));
  const color = BIKE_COLORS[S.colorIdx][1];
  const y = H - 26 + bounce;
  if (player.crashT > 0) {
    const prog = 1 - clamp(player.crashT / 2.2, 0, 1);
    drawBike(W / 2 + Math.sin(player.crashT * 9) * 14, y, 165, { color, lean: 1.35 });
    const tx = W / 2 + 60 + prog * 90, ty = H - 60 - Math.sin(Math.min(prog * 1.6, 1) * Math.PI) * 70;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(prog * 9);
    ctx.fillStyle = '#23232b'; rrect(-10, -14, 20, 28, 6);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -22, 9, 0, 7); ctx.fill();
    ctx.restore();
  } else {
    const lean = player.steerV * 0.7 - seg.curve * spct * 0.12;
    drawBike(W / 2, y, 165, {
      color, lean,
      punch: player.punchT > 0 ? 1 - player.punchT / 0.28 : 0,
      dir: player.punchDir, brake: input.KEYS.ArrowDown || input.TOUCH.brake,
      weapon: player.weapon,
    });
  }
}

/* ---------------- full-screen effects ---------------- */
export function renderSpeedLines(spct: number): void {
  if (spct < 0.55) return;
  const a = clamp((spct - 0.55) * 2.6, 0, 1);   // ramps in earlier and fuller
  // Speed vignette — edges darken as you approach top speed (tunnel-vision rush).
  const sv = ctx.createRadialGradient(W / 2, H / 2, H * (0.5 - 0.12 * a), W / 2, H / 2, H * 0.95);
  sv.addColorStop(0, 'rgba(0,0,0,0)'); sv.addColorStop(1, 'rgba(0,0,0,' + (0.28 * a) + ')');
  ctx.fillStyle = sv; ctx.fillRect(0, 0, W, H);
  // Streaks raking past from the screen edges.
  ctx.strokeStyle = 'rgba(255,255,255,' + (0.26 * a) + ')';
  ctx.lineWidth = 2;
  const count = 10 + Math.floor(8 * a);
  for (let i = 0; i < count; i++) {
    const sy = Math.random() * H * 0.6;
    const side = i % 2, x0 = side ? W : 0;
    const len = (60 + Math.random() * 180) * a;
    line(x0, sy, x0 + (side ? -len : len), sy + (sy - H * 0.4) * 0.06);
  }
}

export function renderWeather(): void {
  const w = activeSeason().weather;
  if (!w) return;
  const t = world.worldT;
  const q = gfx();
  if (w === 'rain') {
    // Wet-road sheen + lightning (reflections tier only).
    if (q.reflections) {
      const sheen = ctx.createLinearGradient(0, H * 0.62, 0, H);
      sheen.addColorStop(0, 'rgba(150,170,200,0.10)'); sheen.addColorStop(1, 'rgba(150,170,200,0)');
      ctx.fillStyle = sheen; ctx.fillRect(0, H * 0.62, W, H * 0.38);
      // Double-flash roughly every 9s.
      const ph = t % 9;
      const flash = ph < 0.10 ? 1 - ph / 0.10 : (ph > 0.22 && ph < 0.34 ? 1 - (ph - 0.22) / 0.12 : 0);
      if (flash > 0) { ctx.fillStyle = 'rgba(210,225,255,' + (0.5 * flash) + ')'; ctx.fillRect(0, 0, W, H); }
    }
    ctx.strokeStyle = 'rgba(170,200,230,0.35)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath();
    const n = Math.floor(RAIN.length * q.weatherDensity);
    for (let i = 0; i < n; i++) {
      const d = RAIN[i];
      const y = (d.y + t * d.sp) % H;
      const x = (d.x - t * d.sp * 0.15) % W;
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y + d.len);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const n = Math.floor(SNOW.length * q.weatherDensity);
    for (let i = 0; i < n; i++) {
      const f = SNOW[i];
      const y = (f.y + t * f.sp) % H;
      const x = (f.x + Math.sin(t * 0.6 + f.ph) * f.drift + W) % W;
      ctx.beginPath(); ctx.arc(x, y, f.r, 0, 7); ctx.fill();
    }
  }
}

export function renderVignette(): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,4,16,0.42)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
