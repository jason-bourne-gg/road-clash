// Pure math/format helpers. No game state — trivially unit-testable.
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeIn = (a: number, b: number, t: number) => a + (b - a) * t * t;
export const easeInOut = (a: number, b: number, t: number) => a + (b - a) * ((-Math.cos(t * Math.PI) / 2) + 0.5);
export const fogAmt = (t: number, d: number) => 1 / Math.pow(Math.E, t * t * d);
export const pad = (n: number, l: number) => String(n).padStart(l, '0');
export const ord = (n: number) => n + (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n] || 'th');

export function fmtTime(t: number): string {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10);
  return m + ':' + pad(s, 2) + '.' + d;
}

// 1-D AABB overlap test on centre + width.
export function overlap(x1: number, w1: number, x2: number, w2: number): boolean {
  return !(x1 + w1 / 2 < x2 - w2 / 2 || x1 - w1 / 2 > x2 + w2 / 2);
}
