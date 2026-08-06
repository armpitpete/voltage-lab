import { describe, expect, it } from 'vitest';
import {
  cycleDurationMs,
  degreesToCycles,
  destinationState,
  filterCutoff,
  gainFromModulation,
  lfoVoltage,
  lfoWave,
  oscillatorFrequency,
  panFromModulation,
  phaseAtTime,
  routeVoltage,
  wrapPhase,
} from './index';

describe('LFO waveforms', () => {
  it('returns deterministic key values for periodic shapes', () => {
    expect(lfoWave('sine', 0)).toBeCloseTo(0, 10);
    expect(lfoWave('sine', 0.25)).toBeCloseTo(1, 10);
    expect(lfoWave('triangle', 0)).toBe(-1);
    expect(lfoWave('triangle', 0.5)).toBe(1);
    expect(lfoWave('square', 0.49)).toBe(1);
    expect(lfoWave('square', 0.5)).toBe(-1);
    expect(lfoWave('saw-up', 0)).toBe(-1);
    expect(lfoWave('saw-up', 0.5)).toBe(0);
    expect(lfoWave('saw-down', 0)).toBe(1);
    expect(lfoWave('saw-down', 0.5)).toBe(0);
  });

  it('wraps phase and shifts by 180 degrees', () => {
    expect(wrapPhase(-0.25)).toBeCloseTo(0.75, 10);
    expect(wrapPhase(1.25)).toBeCloseTo(0.25, 10);
    expect(degreesToCycles(180)).toBe(0.5);
    expect(lfoWave('sine', degreesToCycles(90))).toBeCloseTo(1, 10);
    expect(lfoWave('sine', degreesToCycles(270))).toBeCloseTo(-1, 10);
  });

  it('calculates phase and cycle duration from time and rate', () => {
    expect(cycleDurationMs(2)).toBe(500);
    expect(phaseAtTime(1250, 2, 180, 250)).toBeCloseTo(2.5, 10);
  });

  it('holds stepped random within a cycle and changes deterministically', () => {
    const firstA = lfoWave('stepped-random', 4.1, 17);
    const firstB = lfoWave('stepped-random', 4.9, 17);
    const next = lfoWave('stepped-random', 5.1, 17);
    expect(firstA).toBe(firstB);
    expect(next).not.toBe(firstA);
    expect(lfoWave('stepped-random', 4.3, 17)).toBe(firstA);
  });
});

describe('LFO voltage and routing', () => {
  it('applies amplitude and offset before clamping', () => {
    const result = lfoVoltage({
      shape: 'sine',
      phaseCycles: 0.25,
      amplitudeVoltage: 2,
      offsetVoltage: 1,
    });
    expect(result.rawVoltage).toBeCloseTo(3, 10);
    expect(result.voltage).toBeCloseTo(3, 10);
    expect(result.clipped).toBe(false);
  });

  it('clamps excessive voltage safely', () => {
    const result = lfoVoltage({
      shape: 'square',
      phaseCycles: 0,
      amplitudeVoltage: 5,
      offsetVoltage: 3,
    });
    expect(result.rawVoltage).toBe(8);
    expect(result.voltage).toBe(5);
    expect(result.clipped).toBe(true);
  });

  it('preserves, removes or inverts movement with an attenuverter', () => {
    expect(routeVoltage(4, 0.5).voltage).toBe(2);
    expect(routeVoltage(4, 0).voltage).toBe(0);
    expect(routeVoltage(4, -0.5).voltage).toBe(-2);
  });
});

describe('modulation destinations', () => {
  it('uses exact 1 V/octave pitch and cutoff tracking', () => {
    expect(oscillatorFrequency(220, 1)).toBe(440);
    expect(filterCutoff(1000, 1)).toBe(2000);
    expect(oscillatorFrequency(220, -1)).toBe(110);
    expect(filterCutoff(1000, -1)).toBe(500);
  });

  it('keeps gain and pan in safe ranges', () => {
    expect(gainFromModulation(0.5, 5)).toBe(1);
    expect(gainFromModulation(0.5, -5)).toBe(0);
    expect(panFromModulation(0, 8)).toBe(1);
    expect(panFromModulation(0, -8)).toBe(-1);
  });

  it('routes one source independently to four destinations', () => {
    const state = destinationState(
      2,
      { pitch: 0.5, cutoff: -0.5, gain: 0, pan: 1 },
      { oscillatorHz: 220, cutoffHz: 1000, gain: 0.4, pan: 0 },
    );
    expect(state.pitchCv).toBe(1);
    expect(state.pitchSemitones).toBe(12);
    expect(state.oscillatorHz).toBe(440);
    expect(state.cutoffCv).toBe(-1);
    expect(state.cutoffHz).toBe(500);
    expect(state.gain).toBe(0.4);
    expect(state.pan).toBeCloseTo(0.4, 10);
  });
});
