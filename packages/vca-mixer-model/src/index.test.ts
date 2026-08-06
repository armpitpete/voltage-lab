import { describe, expect, it } from 'vitest';
import {
  channelContribution,
  clipStereo,
  effectiveControlVoltage,
  equalPowerPan,
  hardClip,
  headroomDb,
  mixerStatus,
  mixStereo,
  oscillatorSample,
  vcaGain,
} from './index';

describe('VCA control voltage', () => {
  it('maps 0 V to closed and 5 V to unity gain', () => {
    expect(vcaGain(0, 'linear')).toBe(0);
    expect(vcaGain(5, 'linear')).toBe(1);
    expect(vcaGain(5, 'exponential')).toBeCloseTo(1, 10);
  });

  it('makes exponential response quieter than linear response at intermediate CV', () => {
    expect(vcaGain(2.5, 'linear')).toBeCloseTo(0.5, 10);
    expect(vcaGain(2.5, 'exponential')).toBeLessThan(0.2);
  });

  it('uses a bipolar attenuverter and clamps the effective CV to 0–5 V', () => {
    expect(effectiveControlVoltage({ biasVoltage: 3, modulationVoltage: 2, attenuverter: -1 })).toBe(1);
    expect(effectiveControlVoltage({ biasVoltage: 1, modulationVoltage: 4, attenuverter: -1 })).toBe(0);
    expect(effectiveControlVoltage({ biasVoltage: 4, modulationVoltage: 4, attenuverter: 1 })).toBe(5);
  });
});

describe('mixer channels', () => {
  it('removes muted channels from the sum', () => {
    expect(channelContribution({ sample: 0.75, level: 1, pan: 0, polarity: 'normal', muted: true })).toBe(0);
  });

  it('cancels matched opposite-polarity channels', () => {
    const mixed = mixStereo([
      { sample: 0.8, level: 1, pan: 0, polarity: 'normal' },
      { sample: 0.8, level: 1, pan: 0, polarity: 'inverted' },
    ]);
    expect(mixed.left).toBeCloseTo(0, 10);
    expect(mixed.right).toBeCloseTo(0, 10);
  });

  it('uses deterministic equal-power panning', () => {
    expect(equalPowerPan(-1)).toEqual({ left: 1, right: 0 });
    expect(equalPowerPan(0).left).toBeCloseTo(Math.SQRT1_2, 10);
    expect(equalPowerPan(0).right).toBeCloseTo(Math.SQRT1_2, 10);
    expect(equalPowerPan(1).left).toBeCloseTo(0, 10);
    expect(equalPowerPan(1).right).toBeCloseTo(1, 10);
  });
});

describe('headroom and clipping', () => {
  it('calculates predictable headroom around the 1.0 limit', () => {
    expect(headroomDb(0.5)).toBeCloseTo(6.0206, 3);
    expect(headroomDb(2)).toBeCloseTo(-6.0206, 3);
  });

  it('hard clips without exceeding the configured limit', () => {
    expect(hardClip(2)).toBe(1);
    expect(hardClip(-2)).toBe(-1);
    expect(clipStereo({ left: 1.5, right: -1.4 })).toEqual({ left: 1, right: -1 });
  });

  it('reports clipping when the clean stereo sum exceeds the limit', () => {
    const status = mixerStatus([
      { sample: 1, level: 1, pan: 0, polarity: 'normal' },
      { sample: 1, level: 1, pan: 0, polarity: 'normal' },
    ], 1);
    expect(status.isClipping).toBe(true);
    expect(status.peak).toBeCloseTo(Math.SQRT2, 10);
    expect(Math.abs(status.clipped.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(status.clipped.right)).toBeLessThanOrEqual(1);
  });
});

describe('stationary source waveforms', () => {
  it('returns deterministic phase-aligned source samples', () => {
    expect(oscillatorSample('sine', 0)).toBeCloseTo(0, 10);
    expect(oscillatorSample('square', 0.25)).toBe(1);
    expect(oscillatorSample('square', 0.75)).toBe(-1);
    expect(oscillatorSample('triangle', 0.5)).toBe(1);
  });
});
