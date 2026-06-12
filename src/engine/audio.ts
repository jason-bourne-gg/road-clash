import { clamp } from '../core/math';
import { world } from '../core/state';
import { S } from '../core/settings';
import { relZ } from './track';

// WebAudio synth: a two-oscillator engine through a lowpass, looped wind noise,
// and a triangle siren. All procedural — no audio assets.
let AC: AudioContext | null = null;
let oscA: OscillatorNode, oscB: OscillatorNode, engGain: GainNode;
let windGain: GainNode, sirOsc: OscillatorNode, sirGain: GainNode;
let padGain: GainNode;            // soft ambient chord for the pause screen
let padTarget = -1;
let muted = !S.sound;

export const setMuted = (m: boolean): void => { muted = m; };
export const isMuted = (): boolean => muted;

export function ensureAudio(): void {
  if (AC) return;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    AC = new Ctor();
    const filt = AC.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 520;
    engGain = AC.createGain(); engGain.gain.value = 0;
    oscA = AC.createOscillator(); oscA.type = 'sawtooth';
    oscB = AC.createOscillator(); oscB.type = 'square';
    oscA.connect(filt); oscB.connect(filt); filt.connect(engGain); engGain.connect(AC.destination);
    oscA.start(); oscB.start();
    const nb = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const wind = AC.createBufferSource(); wind.buffer = nb; wind.loop = true;
    const wf = AC.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900;
    windGain = AC.createGain(); windGain.gain.value = 0;
    wind.connect(wf); wf.connect(windGain); windGain.connect(AC.destination);
    wind.start();
    sirOsc = AC.createOscillator(); sirOsc.type = 'triangle';
    sirGain = AC.createGain(); sirGain.gain.value = 0;
    sirOsc.connect(sirGain); sirGain.connect(AC.destination);
    sirOsc.start();
    // ambient pad — a calm open-fifth chord through a lowpass, silent until paused
    padGain = AC.createGain(); padGain.gain.value = 0;
    const padFilt = AC.createBiquadFilter(); padFilt.type = 'lowpass'; padFilt.frequency.value = 680;
    for (const f of [110, 164.81, 220]) {        // A2 · E3 · A3
      const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8; o.connect(padFilt); o.start();
    }
    padFilt.connect(padGain); padGain.connect(AC.destination);
    musicGain = AC.createGain(); musicGain.gain.value = 0; musicGain.connect(AC.destination);
  } catch { AC = null; }
}

// ---- procedural synthwave loop (background music) ----
let musicGain: GainNode | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStep = 0;

function blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
  if (!AC || !musicGain) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(musicGain);
  o.start(); o.stop(AC.currentTime + dur + 0.02);
}
function tick(): void {
  const bar = Math.floor(musicStep / 4) % 4;
  const beat = musicStep % 4;
  const roots = [110, 87.31, 130.81, 98.0];                 // Am · F · C · G bass
  const triad = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
  const root = roots[bar];
  blip(root, 0.24, 'sawtooth', 0.05);                        // bass
  if (beat === 0 || beat === 2) blip(55, 0.12, 'sine', 0.09);// kick
  const arp = root * 4 * Math.pow(2, triad[bar][beat % 3] / 12);
  blip(arp, 0.18, 'triangle', 0.028);                        // soft arp
  musicStep = (musicStep + 1) % 16;
}

// Idempotent — call freely; self-regulates on the music setting + mute.
export function startMusic(): void {
  if (!AC || !musicGain) return;
  if (!S.sound || !S.music || muted) { stopMusic(); return; }
  if (musicTimer != null) return;
  musicStep = 0;
  musicGain.gain.setTargetAtTime(0.5, AC.currentTime, 0.5);
  musicTimer = setInterval(tick, 150);                       // ~100 BPM sixteenths
}
export function stopMusic(): void {
  if (musicTimer != null) { clearInterval(musicTimer); musicTimer = null; }
  if (musicGain && AC) musicGain.gain.setTargetAtTime(0, AC.currentTime, 0.3);
}

// Fade the pause pad in/out. Engine + wind are silenced separately while paused.
export function setAmbient(on: boolean): void {
  if (!AC) return;
  const target = on && !muted ? 0.05 : 0;
  if (target === padTarget) return;
  padTarget = target;
  padGain.gain.setTargetAtTime(target, AC.currentTime, 0.25);
}

export function sfx(freq: number, dur: number, type?: OscillatorType, vol?: number): void {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.15, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(); o.stop(AC.currentTime + dur);
}

export const punchSfx = (): void => { sfx(90, 0.12, 'square', 0.3); sfx(55, 0.18, 'sawtooth', 0.25); };
export const crashSfx = (): void => { sfx(60, 0.5, 'sawtooth', 0.35); sfx(45, 0.7, 'square', 0.3); };
export const knockSfx = (): void => { sfx(200, 0.08, 'square', 0.3); sfx(70, 0.4, 'sawtooth', 0.3); };
export const boostSfx = (): void => { sfx(180, 0.35, 'sawtooth', 0.28); sfx(360, 0.3, 'square', 0.16); };
export const pickupSfx = (): void => { sfx(660, 0.1, 'square', 0.22); sfx(990, 0.16, 'square', 0.2); };
export const shieldSfx = (): void => { sfx(440, 0.18, 'triangle', 0.25); sfx(880, 0.22, 'triangle', 0.18); };
export const screechSfx = (): void => { sfx(1200, 0.14, 'sawtooth', 0.07); };
export const gearSfx = (): void => { sfx(520, 0.05, 'square', 0.08); };

export function setAudioLevels(spct: number): void {
  if (!AC) return;
  const on = !muted && world.game.state === 'race';
  engGain.gain.value = on ? 0.04 + 0.05 * spct : 0;
  oscA.frequency.value = 46 + 330 * spct;
  oscB.frequency.value = 23 + 165 * spct;
  windGain.gain.value = on ? 0.05 * spct * spct : 0;
  if (world.cop && on) {
    const prox = clamp(1 - Math.abs(relZ(world.cop.z)) / 5000, 0, 1);
    sirGain.gain.value = 0.05 * prox;
    sirOsc.frequency.value = (Math.floor(world.worldT * 2.4) % 2) ? 620 : 840;
  } else sirGain.gain.value = 0;
}
