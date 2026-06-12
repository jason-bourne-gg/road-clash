import { makeRng } from '../core/rng';
import { world } from '../core/state';
import type { Pickup, PickupKind } from '../core/types';

// Boost is the most common; repair and shield rarer. Seeded so every peer
// spawns the identical layout (each player collects their own copies locally).
const TABLE: PickupKind[] = ['boost', 'boost', 'boost', 'repair', 'repair', 'shield'];

export function resetPickups(seed: number): void {
  const rng = makeRng((seed ^ 0x51ed270b) >>> 0);
  const count = 9;
  const out: Pickup[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      z: world.trackLength * (i + 0.5) / count,
      offset: rng() * 1.5 - 0.75,           // somewhere across the road
      kind: TABLE[Math.floor(rng() * TABLE.length)],
      taken: false,
    });
  }
  world.pickups = out;
}
