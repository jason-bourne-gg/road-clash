import { DIFFS, BIKE_COLORS, type DiffDef } from './constants';

export interface Settings {
  diff: number;
  laps: number;
  traffic: number;
  police: boolean;
  throttle: 'auto' | 'on' | 'off';
  colorIdx: number;
  season: number;     // 0 summer, 1 winter, 2 rainy
  graphics: 'auto' | 'high' | 'medium' | 'low';
  sound: boolean;
}

// Code defaults. The settings UI overrides these and persists to localStorage,
// which wins on next load.
const CONFIG: Settings = {
  diff: 1,
  laps: 3,
  traffic: 1,
  police: true,
  throttle: 'auto',
  colorIdx: 0,
  season: 0,
  graphics: 'auto',
  sound: true,
};
const KEY = 'roadclash2';

function load(): Settings {
  try { return { ...CONFIG, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...CONFIG }; }
}

// Guard against corrupted or legacy localStorage values (out-of-range indices
// would crash lookups or game the renderer).
function sanitize(s: Settings): Settings {
  const clamp02 = (v: number) => Math.min(2, Math.max(0, v | 0));
  s.diff = clamp02(s.diff);
  s.season = clamp02(s.season);
  s.traffic = clamp02(s.traffic);
  if (![2, 3, 5].includes(s.laps)) s.laps = 3;
  if (!['auto', 'on', 'off'].includes(s.throttle)) s.throttle = 'auto';
  if (!['auto', 'high', 'medium', 'low'].includes(s.graphics)) s.graphics = 'auto';
  s.colorIdx = (((s.colorIdx | 0) % BIKE_COLORS.length) + BIKE_COLORS.length) % BIKE_COLORS.length;
  s.police = !!s.police;
  s.sound = !!s.sound;
  return s;
}

// Live settings, mutated in place so every module sees one source of truth.
export const S: Settings = sanitize(load());

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ }
}

export const DIFF = (): DiffDef => DIFFS[S.diff];
