import { W, H } from './constants';
import { S } from './settings';

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
export const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

// ----------------------------------------------------------------------------
// Auto-resolution. The game draws in fixed 1024x576 LOGICAL units; here we size
// the canvas BACKING STORE to the device's real pixels (× a quality factor) and
// scale the context so logical coords still fill it — crisp on Retina/4K, light
// on weak devices. Recomputed on resize / fullscreen / quality change.
// ----------------------------------------------------------------------------
const MAX_BACKING_W = 2560; // perf ceiling so 4K/Retina doesn't melt the GPU

function qualityScale(): number {
  const dpr = window.devicePixelRatio || 1;
  switch (S.graphics) {
    case 'high': return Math.min(dpr, 3);
    case 'medium': return 1;
    case 'low': return 0.6;
    default: return Math.min(dpr, 2); // 'auto'
  }
}

export function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width || W, cssH = rect.height || H;
  let q = qualityScale();
  let bw = Math.round(cssW * q);
  if (bw > MAX_BACKING_W) q *= MAX_BACKING_W / bw;
  bw = Math.max(1, Math.round(cssW * q));
  const bh = Math.max(1, Math.round(cssH * q));
  // Setting width/height resets the context (incl. transform), so re-apply after.
  canvas.width = bw;
  canvas.height = bh;
  ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0); // map logical 1024x576 → backing store
  ctx.imageSmoothingEnabled = true;
}

addEventListener('resize', resizeCanvas);
addEventListener('orientationchange', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);
resizeCanvas();
