import { W, H } from './constants';

// roundRect polyfill — Safari < 16 and other older engines lack it; the game
// and menus lean on it heavily. Patch the prototype before any drawing runs.
const proto = CanvasRenderingContext2D.prototype as unknown as {
  roundRect?: (x: number, y: number, w: number, h: number, r?: number) => void;
};
if (typeof proto.roundRect !== 'function') {
  proto.roundRect = function (this: CanvasRenderingContext2D, x, y, w, h, r = 0) {
    const rr = Math.min(r as number, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
}

// The one canvas + 2D context, shared by every renderer module so nothing has
// to thread `ctx` through call signatures.
export const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
export const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
