import { buildTrack } from '../engine/track';
import { resetTraffic } from '../entities/traffic';
import { resetPickups } from '../entities/pickups';
import { clearParts } from '../engine/particles';
import { world, input, makePlayer } from '../core/state';
import { S } from '../core/settings';
import { setMuted } from '../engine/audio';
import { bg } from '../engine/render';

// A Session owns "what kind of race this is". The main loop calls the same
// hooks on whichever Session is active — solo and multiplayer are
// interchangeable from the loop's point of view (Liskov).
export abstract class Session {
  abstract readonly kind: 'solo' | 'multiplayer';
  abstract begin(): void;                 // build roster + track, enter countdown
  beforeSim(_now: number): void {}        // e.g. interpolate remote riders
  afterSim(_dt: number, _now: number): void {} // e.g. publish snapshot, relay events
  end(): void {}
}

// Shared race setup. Roster (world.riders) is filled by the concrete session
// AFTER this runs, because rider start positions depend on the freshly-built
// track length.
export function prepareRace(seed: number): void {
  buildTrack(seed);
  resetTraffic(seed);
  resetPickups(seed);
  world.cop = null; world.heat = 0; clearParts(); world.outbox.length = 0;
  bg.pan = 0;
  Object.assign(world.player, makePlayer(), { x: 0.4 });
  for (const k in input.KEYS) input.KEYS[k] = false;
  for (const k in input.activePtrs) delete input.activePtrs[Number(k)];
  input.TOUCH.steer = 0; input.TOUCH.brake = false; input.TOUCH.punch = false; input.TOUCH.boost = false;
  world.game.state = 'race';
  world.game.time = 0; world.game.shake = 0; world.game.flash = 0;
  world.game.msg = ''; world.game.msgT = 0;
  world.game.countdown = 3.7;
  world.game.paused = false; world.game.resumeT = 0;
  setMuted(!S.sound);
}
