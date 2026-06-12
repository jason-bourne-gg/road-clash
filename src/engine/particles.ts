import { clamp } from '../core/math';

interface Particle {
  x: number; y: number; vx: number; vy: number; g: number;
  life: number; max: number; size: number; color: string;
}
interface EmitOpts {
  vx?: number; vy?: number; vy0?: number; g?: number; life: number; size: number; color: string;
}

// Screen-space particle pool. Shared by physics (emits) and render (draws).
export const parts: Particle[] = [];

export function emit(x: number, y: number, n: number, o: EmitOpts): void {
  for (let i = 0; i < n; i++) {
    parts.push({
      x, y,
      vx: (Math.random() - 0.5) * (o.vx || 120),
      vy: (o.vy0 || 0) + (Math.random() - 0.5) * (o.vy || 80),
      g: o.g === undefined ? 300 : o.g,
      life: o.life * (0.5 + Math.random() * 0.5), max: o.life,
      size: o.size * (0.5 + Math.random()), color: o.color,
    });
  }
  if (parts.length > 320) parts.splice(0, parts.length - 320);
}

export function updateParts(dt: number): void {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}

export function renderParts(ctx: CanvasRenderingContext2D): void {
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.8;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export const clearParts = (): void => { parts.length = 0; };
