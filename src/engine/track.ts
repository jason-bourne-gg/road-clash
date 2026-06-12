import { SEG_LEN, RUMBLE, SPRITE_KINDS, PLAYER_Z } from '../core/constants';
import { easeIn, easeInOut } from '../core/math';
import { makeRng } from '../core/rng';
import { world } from '../core/state';
import type { Segment } from '../core/types';

const lastY = (): number =>
  world.segments.length ? world.segments[world.segments.length - 1].p2.world.y : 0;

function addSegment(curve: number, y: number): void {
  const n = world.segments.length;
  const seg: Segment = {
    index: n,
    p1: { world: { x: 0, y: lastY(), z: n * SEG_LEN }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } },
    p2: { world: { x: 0, y, z: (n + 1) * SEG_LEN }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } },
    curve, sprites: [], ents: [], clip: 0, fog: 1,
    alt: Math.floor(n / RUMBLE) % 2 === 0,
  };
  world.segments.push(seg);
}

function addRoad(enter: number, hold: number, leave: number, curve: number, dy: number): void {
  const startY = lastY(), endY = startY + dy * SEG_LEN, total = enter + hold + leave;
  for (let i = 0; i < enter; i++) addSegment(easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total));
  for (let i = 0; i < hold; i++) addSegment(curve, easeInOut(startY, endY, (enter + i) / total));
  for (let i = 0; i < leave; i++) addSegment(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (enter + hold + i) / total));
}

// Deterministic given `seed`: identical track shape AND decoration on every peer.
export function buildTrack(seed: number): void {
  world.segments = [];
  world.seed = seed;
  const rng = makeRng(seed);
  addRoad(50, 60, 50, 0, 0);
  addRoad(50, 80, 50, 2, 40);
  addRoad(40, 40, 40, -3, -25);
  addRoad(30, 60, 30, 0, -15);
  addRoad(60, 70, 60, 4, 0);
  addRoad(30, 30, 30, -2, 50);
  addRoad(50, 110, 50, 0, -50);
  addRoad(40, 40, 40, -4, 15);
  addRoad(40, 80, 40, 3, -15);
  addRoad(40, 40, 40, 0, 0);
  for (let i = 20; i < world.segments.length - 20; i += 10) {
    if (rng() < 0.75) {
      const side = rng() < 0.5 ? -1 : 1;
      world.segments[i].sprites.push({
        kind: SPRITE_KINDS[Math.floor(rng() * SPRITE_KINDS.length)],
        offset: side * (1.4 + rng() * 1.6),
      });
    }
  }
  world.trackLength = world.segments.length * SEG_LEN;
}

export const wrapZ = (z: number): number => {
  z = z % world.trackLength;
  return z < 0 ? z + world.trackLength : z;
};

export const findSegment = (z: number): Segment =>
  world.segments[Math.floor(wrapZ(z) / SEG_LEN) % world.segments.length];

export function zdist(a: number, b: number): number {
  let d = a - b;
  if (d > world.trackLength / 2) d -= world.trackLength;
  if (d < -world.trackLength / 2) d += world.trackLength;
  return d;
}

// Signed shortest distance from the player's BIKE (not camera) to z.
export const relZ = (z: number): number => zdist(z, wrapZ(world.player.position + PLAYER_Z));
