import type { NetMessage, RiderSnapshot, WeaponKey } from '../core/types';

// Trust boundary. Everything arriving from a peer is untrusted: it could be
// malformed, malicious, or from a future/older client. parseMessage returns a
// fully validated, range-clamped NetMessage — or null, which the transport
// drops. Downstream code can then assume every field is sane (no NaN, no
// teleports, no prototype pollution), so the simulation can't be corrupted.

const WEAPONS = new Set<WeaponKey>(['fist', 'club', 'chain']);
const num = (v: unknown, def = 0): number => (typeof v === 'number' && isFinite(v) ? v : def);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const hexColor = (v: unknown): string => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : '#ececf2');

function validSnapshot(s: unknown): RiderSnapshot | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  return {
    z: num(o.z),
    offset: clamp(num(o.offset), -4, 4),
    speed: clamp(num(o.speed), -1e7, 1e7),
    health: clamp(num(o.health, 100), 0, 100),
    weapon: WEAPONS.has(o.weapon as WeaponKey) ? (o.weapon as WeaponKey) : 'fist',
    knocked: clamp(num(o.knocked), 0, 10),
    punchT: clamp(num(o.punchT), 0, 1),
    lap: clamp(num(o.lap, 1), 0, 99),
    total: num(o.total),
  };
}

export function parseMessage(raw: unknown): NetMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case 'hello': {
      const info = m.info as Record<string, unknown> | undefined;
      if (!info || typeof info !== 'object') return null;
      return { t: 'hello', info: { id: str(info.id, 64), name: str(info.name, 12) || 'Rider', color: hexColor(info.color) } };
    }
    case 'start':
      return {
        t: 'start',
        seed: num(m.seed) >>> 0,
        season: clamp(num(m.season), 0, 2) | 0,
        laps: [2, 3, 5].includes(m.laps as number) ? (m.laps as number) : 3,
        diff: clamp(num(m.diff), 0, 2) | 0,
        at: num(m.at),
      };
    case 'state': {
      const s = validSnapshot(m.s);
      return s ? { t: 'state', s } : null;
    }
    case 'hit':
      return { t: 'hit', from: str(m.from, 64), to: str(m.to, 64), dmg: clamp(num(m.dmg), 0, 200), knock: clamp(num(m.knock), -2, 2) };
    case 'finished':
      return { t: 'finished', place: clamp(num(m.place, 1), 1, 99) | 0, total: num(m.total) };
    default:
      return null; // unknown message type — ignore
  }
}
