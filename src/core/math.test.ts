import { describe, it, expect } from 'vitest';
import { clamp, lerp, easeIn, easeInOut, fogAmt, pad, ord, fmtTime, overlap } from './math';

describe('clamp', () => {
  it('passes values inside the range through', () => expect(clamp(5, 0, 10)).toBe(5));
  it('clamps below the floor', () => expect(clamp(-3, 0, 10)).toBe(0));
  it('clamps above the ceiling', () => expect(clamp(42, 0, 10)).toBe(10));
  it('handles the degenerate range lo === hi', () => expect(clamp(7, 3, 3)).toBe(3));
});

describe('interpolation', () => {
  it('lerp hits both endpoints exactly', () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 1)).toBe(100);
  });
  it('lerp is linear at the midpoint', () => expect(lerp(0, 100, 0.5)).toBe(50));
  it('easeIn starts slower than linear', () => expect(easeIn(0, 100, 0.5)).toBeLessThan(50));
  it('easeInOut is symmetric about the midpoint', () => {
    expect(easeInOut(0, 100, 0.5)).toBeCloseTo(50, 6);
  });
  it('easeInOut hits both endpoints', () => {
    expect(easeInOut(0, 100, 0)).toBeCloseTo(0, 6);
    expect(easeInOut(0, 100, 1)).toBeCloseTo(100, 6);
  });
});

describe('fogAmt', () => {
  it('is fully clear at distance 0', () => expect(fogAmt(0, 5)).toBe(1));
  it('decreases as distance grows', () => expect(fogAmt(1, 5)).toBeLessThan(fogAmt(0.5, 5)));
  it('stays in (0, 1]', () => {
    const v = fogAmt(0.8, 5);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});

describe('formatting', () => {
  it('pad left-pads to the requested length', () => {
    expect(pad(7, 2)).toBe('07');
    expect(pad(123, 2)).toBe('123'); // never truncates
  });

  it('ord gives the right suffix for finishing positions', () => {
    expect(ord(1)).toBe('1st');
    expect(ord(2)).toBe('2nd');
    expect(ord(3)).toBe('3rd');
    expect(ord(4)).toBe('4th');
    expect(ord(8)).toBe('8th');
  });

  it('ord handles the 11/12/13 exception', () => {
    expect(ord(11)).toBe('11th');
    expect(ord(12)).toBe('12th');
    expect(ord(13)).toBe('13th');
    expect(ord(14)).toBe('14th');
  });

  it('ord handles the twenties and beyond', () => {
    expect(ord(21)).toBe('21st');
    expect(ord(22)).toBe('22nd');
    expect(ord(23)).toBe('23rd');
    expect(ord(24)).toBe('24th');
    expect(ord(101)).toBe('101st');
    expect(ord(111)).toBe('111th');
    expect(ord(112)).toBe('112th');
  });

  it('fmtTime renders m:ss.d', () => {
    expect(fmtTime(0)).toBe('0:00.0');
    expect(fmtTime(65.4)).toBe('1:05.4');
    expect(fmtTime(125)).toBe('2:05.0');
  });
});

describe('overlap', () => {
  it('detects overlapping boxes', () => expect(overlap(0, 10, 5, 10)).toBe(true));
  it('rejects separated boxes', () => expect(overlap(0, 10, 100, 10)).toBe(false));
  it('treats exact edge contact as touching', () => expect(overlap(0, 10, 10, 10)).toBe(true));
  it('is symmetric', () => {
    expect(overlap(0, 10, 7, 6)).toBe(overlap(7, 6, 0, 10));
  });
});
