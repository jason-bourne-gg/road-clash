import { ctx } from '../core/view';

// Low-level canvas primitives used by sprites + road rendering.
export function poly(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number, color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
  ctx.closePath(); ctx.fill();
}

export function rrect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

export function line(x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
