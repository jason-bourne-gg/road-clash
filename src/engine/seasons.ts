import { S } from '../core/settings';
import { clamp } from '../core/math';
import type { Season } from '../core/types';

// A Season is one data object that re-skins the world and tweaks handling. It
// plugs into three systems that don't know about each other:
//   render  -> sky / road / grass / rumble palette + weather overlay
//   physics -> gripMult (rainy is slippery)
//   track   -> foliage tint
// Adding a season = appending one object. Nothing else changes.
export const SEASONS: Season[] = [
  {
    id: 'summer', name: 'SUMMER',
    sky: ['#120b2e', '#41245e', '#9c4368', '#e8694a', '#f7b267'],
    skyFog: '#c9785f', sun: '#ffd98a', sunGlow: 'rgba(255,170,90,',
    roadLight: '#6e6e73', roadDark: '#67676c',
    grassLight: '#4f9d3f', grassDark: '#479339',
    rumbleLight: '#d9d9d9', rumbleDark: '#c43b3b',
    foliage: '#2f7a2f', trunk: '#6b4a2a',
    gripMult: 1.0, weather: null,
  },
  {
    id: 'winter', name: 'WINTER',
    sky: ['#0a1430', '#1f3357', '#4a5e84', '#9fb6d6', '#e8eef7'],
    skyFog: '#d2dcec', sun: '#eaf2ff', sunGlow: 'rgba(200,220,255,',
    roadLight: '#8a8a92', roadDark: '#80808a',
    grassLight: '#eef3f8', grassDark: '#dde6ee',           // snow
    rumbleLight: '#ced6e0', rumbleDark: '#b04545',
    foliage: '#cfe0ea', trunk: '#7a6650',                  // snow-laden
    gripMult: 0.8, weather: 'snow',
  },
  {
    id: 'rainy', name: 'RAINY',
    sky: ['#070b16', '#161d2c', '#2a3446', '#3e4c5e', '#5d6c7a'],
    skyFog: '#7c8a96', sun: null, sunGlow: 'rgba(150,170,190,',
    roadLight: '#3f444b', roadDark: '#383d44',             // wet dark asphalt
    grassLight: '#356633', grassDark: '#2e5a2c',
    rumbleLight: '#c9c9c9', rumbleDark: '#a23b3b',
    foliage: '#2a5e2a', trunk: '#4a3520',
    gripMult: 0.6, weather: 'rain',                        // slippery!
  },
];

export const activeSeason = (): Season => SEASONS[clamp(S.season | 0, 0, SEASONS.length - 1)];
