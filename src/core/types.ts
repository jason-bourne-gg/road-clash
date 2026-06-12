// ============================================================================
// Shared domain contracts. Engine, net, and session layers all speak these
// types, so a human rider, an AI rider, and a remote (networked) rider are
// genuinely interchangeable to the renderer and the simulation.
// ============================================================================

export type WeaponKey = 'fist' | 'club' | 'chain';
export type ControllerKind = 'ai' | 'remote';
export type GameState = 'menu' | 'race' | 'finished';

// --- pseudo-3D track ---
export interface Point {
  world: { x: number; y: number; z: number };
  camera: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number; scale: number };
}
export interface RoadSprite { kind: string; offset: number; }
export interface Segment {
  index: number;
  p1: Point;
  p2: Point;
  curve: number;
  sprites: RoadSprite[];
  ents: Array<{ kind: 'rival' | 'traffic' | 'cop'; e: Rider | Traffic | Cop }>;
  clip: number;
  fog: number;
  alt: boolean;
}

// --- combatants ---
// Common shape shared by the player, AI/remote riders, and the cop. Optional
// fields exist only on the entities that need them (riders carry identity +
// race progress; the cop does not).
export interface Combatant {
  name: string;
  color?: string;
  z: number;
  offset: number;
  speed: number;
  maxSpeed: number;
  health: number;
  knocked: number;
  punchT: number;
  wobble: number;
  weapon: WeaponKey;
  controller?: ControllerKind;
}

export interface Rider extends Combatant {
  id: string;
  color: string;
  home: number;
  total: number;
  controller: ControllerKind;
  net?: InterpBuffer; // present only for controller === 'remote'
}

export type Cop = Combatant;

export interface Traffic {
  z: number;
  offset: number;
  speed: number;
  oncoming: boolean;
  color: string;
  van: boolean;
}

export interface Player {
  x: number; position: number; speed: number; steerV: number; vx: number;
  wobbleT: number; draft: boolean; health: number;
  lap: number; lapTime: number; bestLap: number | null; total: number; weapon: WeaponKey;
  punchT: number; punchDir: number; punchCool: number; hurtT: number; crashT: number; bustedT: number;
  finished: boolean; place: number; finalPlace: number | null;
}

export interface GameMeta {
  state: GameState;
  time: number;
  msg: string;
  msgT: number;
  shake: number;
  flash: number;
  countdown: number;
  paused: boolean;     // solo only: sim frozen
  resumeT: number;     // >0 while the 3-2-1 resume countdown runs
}

// Combat events the simulation produces that the network layer must relay
// (e.g. "I punched remote rider X"). Engine pushes; session drains. Decoupled.
export type OutboxEvent = { t: 'hit'; id: string; dmg: number; knock: number };

export interface World {
  game: GameMeta;
  worldT: number;
  player: Player;
  riders: Rider[];
  traffic: Traffic[];
  cop: Cop | null;
  heat: number;
  segments: Segment[];
  trackLength: number;
  seed: number;
  outbox: OutboxEvent[];
}

export interface InputState {
  KEYS: Record<string, boolean>;
  TOUCH: { steer: number; brake: boolean; punch: boolean };
  touchCapable: boolean;
  touchActive: boolean;
  activePtrs: Record<number, string>;
}

// --- networking ---
// A compact, allocation-friendly snapshot of one rider's state, sent ~20Hz.
export interface RiderSnapshot {
  z: number; offset: number; speed: number; health: number;
  weapon: WeaponKey; knocked: number; punchT: number; lap: number; total: number;
}
// Timestamped sample held in a remote rider's interpolation buffer.
export interface InterpBuffer {
  samples: Array<{ t: number; s: RiderSnapshot }>;
}

export interface PlayerInfo { id: string; name: string; color: string; }

// Lobby/handshake + per-frame messages exchanged between peers.
export type NetMessage =
  | { t: 'hello'; info: PlayerInfo }
  | { t: 'start'; seed: number; season: number; laps: number; diff: number; at: number }
  | { t: 'state'; s: RiderSnapshot }
  | { t: 'hit'; from: string; to: string; dmg: number; knock: number }
  | { t: 'finished'; place: number; total: number };

// --- season ---
export interface Season {
  id: string;
  name: string;
  sky: string[];
  skyFog: string;
  sun: string | null;
  sunGlow: string;
  roadLight: string; roadDark: string;
  grassLight: string; grassDark: string;
  rumbleLight: string; rumbleDark: string;
  foliage: string; trunk: string;
  gripMult: number;
  weather: 'rain' | 'snow' | null;
}
