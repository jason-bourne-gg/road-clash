import { S } from '../core/settings';

// Maps the GRAPHICS setting to actual visual-effect toggles (separate from
// resolution, which view.ts handles). This is what makes the setting change how
// the game *looks*, not just how sharp it is.
export interface Gfx {
  bloom: boolean;          // additive sun / light glow
  reflections: boolean;    // wet-road sheen + lightning in rain
  weatherDensity: number;  // 0..1 fraction of rain/snow drawn
  particleCap: number;     // max live screen particles
}

export function gfx(): Gfx {
  switch (S.graphics) {
    case 'high':   return { bloom: true,  reflections: true,  weatherDensity: 1.0,  particleCap: 420 };
    case 'medium': return { bloom: false, reflections: true,  weatherDensity: 0.85, particleCap: 320 };
    case 'low':    return { bloom: false, reflections: false, weatherDensity: 0.45, particleCap: 110 };
    default: {     // 'auto' — richer effects on high-DPR (Retina/4K) screens
      const hi = (window.devicePixelRatio || 1) >= 2;
      return { bloom: hi, reflections: true, weatherDensity: 1.0, particleCap: hi ? 400 : 320 };
    }
  }
}
