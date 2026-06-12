import type { World, Player, InputState } from './types';

// Single source of truth for live, mutable game state. Engine systems read and
// write `world`; input wiring writes `input`. Named singletons preserve the
// original game's fast shared-state model with one clear place to look.

// The local rider — the one the camera follows and the human controls.
export function makePlayer(): Player {
  return {
    x: 0, position: 0, speed: 0, steerV: 0, vx: 0, wobbleT: 0, draft: false, health: 100,
    lap: 1, lapTime: 0, bestLap: null, total: 0, weapon: 'fist',
    punchT: 0, punchDir: 1, punchCool: 0, hurtT: 0, crashT: 0, bustedT: 0,
    finished: false, place: 8, finalPlace: null,
  };
}

export const world: World = {
  game: { state: 'menu', time: 0, msg: '', msgT: 0, shake: 0, flash: 0, countdown: 0, paused: false, resumeT: 0 },
  worldT: 0,
  player: makePlayer(),
  riders: [],
  traffic: [],
  cop: null,
  heat: 0,
  segments: [],
  trackLength: 0,
  seed: 0,
  outbox: [],
};

export function setMsg(text: string, sec?: number): void {
  world.game.msg = text;
  world.game.msgT = sec || 2;
}

export const input: InputState = {
  KEYS: {},
  TOUCH: { steer: 0, brake: false, punch: false },
  touchCapable: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
  touchActive: false,
  activePtrs: {},
};
