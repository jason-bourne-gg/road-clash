import type { WeaponKey } from './types';

// Design resolution. Canvas is fixed at this size; CSS scales it to fit.
export const W = 1024, H = 576;

// --- pseudo-3D road geometry ---
export const SEG_LEN = 200;
export const ROAD_WIDTH = 2200;
export const RUMBLE = 3;
export const DRAW_DIST = 300;
export const FOV = 100;
export const CAM_HEIGHT = 1000;
export const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
export const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH;

// --- speeds & longitudinal dynamics ---
export const MAX_SPEED = SEG_LEN * 60;
export const ACCEL = MAX_SPEED / 4;
export const BRAKE = -MAX_SPEED;
export const DECEL = -MAX_SPEED / 5;
export const OFF_DECEL = -MAX_SPEED / 1.5;
export const OFF_LIMIT = MAX_SPEED / 4;
export const CENTRIFUGAL = 0.32;
export const PUNCH_RANGE_Z = 600;
export const PUNCH_RANGE_X = 0.5;

// --- lateral grip + slopes + slipstream ---
export const GRIP_ROAD = 9;
export const GRIP_OFF = 3.2;
export const CENT_K = 3.0;
export const SLOPE_PULL = MAX_SPEED * 0.22;
export const DRAFT_Z = 1300;
export const DRAFT_X = 0.26;

// --- collision bodies (capsule-ish AABBs in track space) ---
export const BIKE_LEN = 170, BIKE_W = 0.24;
export const CAR_LEN = 270, CAR_W = 0.46, VAN_W = 0.52;
export const REL_CRASH_BIKE = MAX_SPEED * 0.50;
export const REL_CRASH_CAR = MAX_SPEED * 0.32;

export interface DiffDef { name: string; ai: number; aggr: number; copSpeed: number; copDmg: number; }
export const DIFFS: DiffDef[] = [
  { name: 'EASY',   ai: 0.88, aggr: 0.5, copSpeed: 1.00, copDmg: 14 },
  { name: 'NORMAL', ai: 0.95, aggr: 0.9, copSpeed: 1.04, copDmg: 18 },
  { name: 'HARD',   ai: 1.00, aggr: 1.5, copSpeed: 1.08, copDmg: 22 },
];

export interface WeaponDef { dmg: number; range: number; knock: number; name: string; }
export const WEAPONS: Record<WeaponKey, WeaponDef> = {
  fist:  { dmg: 40, range: 1.0,  knock: 0.28, name: 'FISTS' },
  club:  { dmg: 70, range: 1.05, knock: 0.34, name: 'CLUB' },
  chain: { dmg: 55, range: 1.5,  knock: 0.45, name: 'CHAIN' },
};

export const BIKE_COLORS: Array<[string, string]> = [
  ['Pearl', '#ececf2'], ['Crimson', '#e23b3b'], ['Cobalt', '#3b8de2'],
  ['Sunburst', '#f0a020'], ['Venom', '#52c43b'], ['Night', '#34343c'],
];

export const RIDERS: Array<[string, string]> = [
  ['Viper', '#e23b3b'], ['Natasha', '#c93bd6'], ['Biff', '#3b8de2'],
  ['Slick', '#f0a020'], ['Axle', '#52c43b'], ['Rude Boy', '#20c8c8'],
  ['Mace', '#b9b9c9'],
];

export const TRAFFIC_COLORS = ['#c8c8d0', '#8090a0', '#b06868', '#6a82c8', '#d8c890'];
export const SPRITE_KINDS = ['palm', 'sign', 'bush', 'rock', 'cactus'];

// Racers besides you (humans fill these slots, AI backfills the rest).
export const PACK_SIZE = RIDERS.length;

// On-screen touch buttons (shared by HUD rendering and input hit-testing).
export const BTN = {
  brake: { x: 100, y: H - 92, r: 66 },
  punch: { x: W - 100, y: H - 92, r: 66 },
  boost: { x: W - 104, y: H - 226, r: 54 },
};

// --- nitro / boost ---
export const BOOST_FILL = 0.05;        // meter/sec just from racing
export const BOOST_DRAFT_FILL = 0.16;  // extra meter/sec while drafting
export const BOOST_KNOCK_FILL = 0.25;  // instant fill for knocking a rider down
export const BOOST_COST = 0.34;        // meter spent per activation
export const BOOST_DUR = 1.3;          // seconds of boost
export const BOOST_SPEED = 1.20;       // top-speed multiplier while boosting
export const BOOST_ACCEL = 0.8;        // extra accel fraction while boosting

// --- pickups ---
export const SHIELD_DUR = 6;           // seconds of crash immunity
export const PICKUP_W = 0.45;          // collision half-width (road-width units)
export const PICKUP_LEN = 320;         // collision length (world z-units)
