import { MAX_SPEED, TRAFFIC_COLORS } from '../core/constants';
import { makeRng } from '../core/rng';
import { world } from '../core/state';
import { S } from '../core/settings';
import { wrapZ } from '../engine/track';
import type { Traffic } from '../core/types';

// Two-way traffic, seeded so every peer spawns the identical pattern.
export function resetTraffic(seed: number): void {
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
  const out: Traffic[] = [];
  const count = [0, 10, 18][S.traffic];
  for (let i = 0; i < count; i++) {
    const oncoming = i % 2 === 0;
    out.push({
      z: wrapZ((i + 1) * world.trackLength / (count + 1)),
      offset: oncoming ? -(0.25 + (i % 3) * 0.22) : (0.25 + (i % 3) * 0.22),
      speed: oncoming ? -MAX_SPEED * (0.22 + rng() * 0.08)
                      : MAX_SPEED * (0.34 + rng() * 0.14),
      oncoming,
      color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
      van: i % 4 === 0,
    });
  }
  world.traffic = out;
}
