import { PLAYER_Z } from '../core/constants';
import { lerp, clamp } from '../core/math';
import { wrapZ, zdist } from '../engine/track';
import type { Player, Rider, RiderSnapshot } from '../core/types';

// How far in the past we render remote riders. Buys a buffer to interpolate
// across, hiding jitter and packet loss. ~120ms is the racing-game sweet spot.
export const INTERP_DELAY = 0.12;
const BUFFER_KEEP = 1.0; // seconds of history retained

// Pack the local player's bike into a wire snapshot. Note z is the BIKE's
// track position (position + PLAYER_Z) so remote peers place us correctly.
export function captureSnapshot(player: Player): RiderSnapshot {
  return {
    z: wrapZ(player.position + PLAYER_Z),
    offset: player.x,
    speed: player.speed,
    health: player.health,
    weapon: player.weapon,
    knocked: player.crashT > 0 ? 1 : 0,
    punchT: player.punchT,
    lap: player.lap,
    total: player.total,
  };
}

export function pushSample(rider: Rider, s: RiderSnapshot, now: number): void {
  if (!rider.net) rider.net = { samples: [] };
  const buf = rider.net.samples;
  buf.push({ t: now, s });
  while (buf.length > 2 && buf[0].t < now - BUFFER_KEEP) buf.shift();
}

// Reconstruct a remote rider's current visible state at (now - INTERP_DELAY)
// by interpolating between the two buffered samples that bracket that time.
export function applyInterpolated(rider: Rider, now: number): void {
  const buf = rider.net?.samples;
  if (!buf || buf.length === 0) return;
  const rt = now - INTERP_DELAY;

  if (buf.length === 1 || rt <= buf[0].t) { writeSample(rider, buf[0].s); return; }
  const last = buf[buf.length - 1];
  if (rt >= last.t) { writeSample(rider, last.s); return; }

  let a = buf[0], b = buf[buf.length - 1];
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i].t <= rt && buf[i + 1].t >= rt) { a = buf[i]; b = buf[i + 1]; break; }
  }
  const span = b.t - a.t;
  const f = span > 0 ? clamp((rt - a.t) / span, 0, 1) : 0;

  // z wraps around the loop — interpolate along the shortest arc.
  rider.z = wrapZ(a.s.z + zdist(b.s.z, a.s.z) * f);
  rider.offset = lerp(a.s.offset, b.s.offset, f);
  rider.speed = lerp(a.s.speed, b.s.speed, f);
  rider.health = lerp(a.s.health, b.s.health, f);
  rider.total = lerp(a.s.total, b.s.total, f);
  // discrete fields snap to the most recent sample
  rider.weapon = b.s.weapon;
  rider.knocked = b.s.knocked;
  rider.punchT = b.s.punchT;
}

function writeSample(rider: Rider, s: RiderSnapshot): void {
  rider.z = s.z; rider.offset = s.offset; rider.speed = s.speed;
  rider.health = s.health; rider.total = s.total;
  rider.weapon = s.weapon; rider.knocked = s.knocked; rider.punchT = s.punchT;
}
