import { RIDERS, SEG_LEN, MAX_SPEED, PACK_SIZE } from '../core/constants';
import { DIFF } from '../core/settings';
import { wrapZ } from '../engine/track';
import type { Rider, WeaponKey, AiStyle } from '../core/types';

// Staggered grid offset so the pack lines up on the right (legal) side at start.
const startOffset = (i: number) => ((i % 2) ? 0.55 : 0.15) + ((i % 3) - 1) * 0.12;
const startZ = (i: number) => wrapZ((i + 1) * SEG_LEN * 5);
const startWeapon = (i: number): WeaponKey => (i === 2 ? 'club' : i === 4 ? 'chain' : 'fist');
// Rotate personalities so each pack has a spread of behaviours.
const STYLES: AiStyle[] = ['racer', 'aggressive', 'blocker'];
const startStyle = (i: number): AiStyle => STYLES[i % STYLES.length];

export function makeAiRider(i: number): Rider {
  const r = RIDERS[i % RIDERS.length];
  const off = startOffset(i);
  const style = startStyle(i);
  // racers run a touch faster; aggressors a touch slower but hit harder.
  const speedBias = style === 'racer' ? 1.03 : style === 'aggressive' ? 0.98 : 1.0;
  return {
    id: 'ai' + i, name: r[0], color: r[1],
    z: startZ(i), offset: off, home: off, speed: 0,
    maxSpeed: Math.min(MAX_SPEED * 1.0, MAX_SPEED * (0.80 + 0.035 * i) * DIFF().ai * speedBias),
    health: 100, knocked: 0, punchT: 0, wobble: 0,
    weapon: startWeapon(i), total: startZ(i),
    controller: 'ai', style,
  };
}

// A networked opponent. Its movement comes from interpolated snapshots, not AI.
export function makeRemoteRider(id: string, name: string, color: string, slot: number): Rider {
  const off = startOffset(slot);
  return {
    id, name, color,
    z: startZ(slot), offset: off, home: off, speed: 0, maxSpeed: MAX_SPEED,
    health: 100, knocked: 0, punchT: 0, wobble: 0,
    weapon: 'fist', total: startZ(slot),
    controller: 'remote', style: 'racer', net: { samples: [] },
  };
}

// Solo: a full grid of AI rivals.
export function createSoloPack(): Rider[] {
  return Array.from({ length: PACK_SIZE }, (_, i) => makeAiRider(i));
}
