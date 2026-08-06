import { describe, expect, it } from 'vitest';
import {
  cutoffFromSources,
  cutoffFromVoltage,
  filterMagnitude,
  filteredHarmonicAmplitude,
  harmonicAmplitude,
  lfoValue,
  logarithmicFrequency,
  logarithmicPosition,
} from './index';
import {
  advanceEnvelope,
  gateEnvelopeOff,
  gateEnvelopeOn,
  idleEnvelope,
} from '../../envelope-model/src/index';

describe('Filter Lab model', () => {
  it('uses exact 1 V/octave cutoff control', () => {
    expect(cutoffFromVoltage(440, 0)).toBeCloseTo(440, 10);
    expect(cutoffFromVoltage(440, 1)).toBeCloseTo(880, 10);
    expect(cutoffFromVoltage(440, -1)).toBeCloseTo(220, 10);
  });

  it('applies bipolar modulation predictably and clamps the audible range', () => {
    const positive = cutoffFromSources({
      baseCutoffHz: 1000,
      cutoffCv: 0,
      modulationCv: 1,
      modulationAmount: 1,
      lfoCv: 0,
      envelopeCv: 0,
    });
    const negative = cutoffFromSources({
      baseCutoffHz: 1000,
      cutoffCv: 0,
      modulationCv: 1,
      modulationAmount: -1,
      lfoCv: 0,
      envelopeCv: 0,
    });
    expect(positive).toBeCloseTo(2000, 10);
    expect(negative).toBeCloseTo(500, 10);
    expect(cutoffFromVoltage(1000, 20)).toBe(20000);
    expect(cutoffFromVoltage(1000, -20)).toBe(20);
  });

  it('low-pass favours frequencies below cutoff', () => {
    const below = filterMagnitude('lowpass', 100, 1000, 0.707);
    const above = filterMagnitude('lowpass', 10000, 1000, 0.707);
    expect(below).toBeGreaterThan(above * 50);
  });

  it('high-pass favours frequencies above cutoff', () => {
    const below = filterMagnitude('highpass', 100, 1000, 0.707);
    const above = filterMagnitude('highpass', 10000, 1000, 0.707);
    expect(above).toBeGreaterThan(below * 50);
  });

  it('band-pass peaks and notch rejects at cutoff', () => {
    const bandAtCutoff = filterMagnitude('bandpass', 1000, 1000, 4);
    const bandFarAway = filterMagnitude('bandpass', 100, 1000, 4);
    const notchAtCutoff = filterMagnitude('notch', 1000, 1000, 4);
    const notchFarAway = filterMagnitude('notch', 100, 1000, 4);
    expect(bandAtCutoff).toBeCloseTo(1, 10);
    expect(bandAtCutoff).toBeGreaterThan(bandFarAway * 10);
    expect(notchAtCutoff).toBeCloseTo(0, 10);
    expect(notchFarAway).toBeGreaterThan(0.9);
  });

  it('resonance increases emphasis at cutoff', () => {
    expect(filterMagnitude('lowpass', 1000, 1000, 8))
      .toBeGreaterThan(filterMagnitude('lowpass', 1000, 1000, 0.707) * 5);
  });

  it('produces deterministic LFO shapes', () => {
    expect(lfoValue('sine', 0)).toBeCloseTo(0, 10);
    expect(lfoValue('sine', 0.25)).toBeCloseTo(1, 10);
    expect(lfoValue('triangle', 0)).toBe(-1);
    expect(lfoValue('triangle', 0.5)).toBe(1);
    expect(lfoValue('square', 0.49)).toBe(1);
    expect(lfoValue('square', 0.5)).toBe(-1);
  });

  it('maps the logarithmic cutoff control reversibly', () => {
    for (const position of [0, 0.25, 0.5, 0.75, 1]) {
      expect(logarithmicPosition(logarithmicFrequency(position))).toBeCloseTo(position, 10);
    }
  });

  it('shows harmonic removal in the deterministic spectrum', () => {
    expect(harmonicAmplitude('sine', 2)).toBe(0);
    expect(harmonicAmplitude('square', 2)).toBe(0);
    expect(filteredHarmonicAmplitude('sawtooth', 12, 100, 'lowpass', 400, 0.707))
      .toBeLessThan(harmonicAmplitude('sawtooth', 12) / 5);
  });

  it('uses the ADSR envelope as cutoff voltage and releases smoothly', () => {
    const settings = { attackMs: 100, decayMs: 100, sustainLevel: 0.5, releaseMs: 200, peakVoltage: 5 };
    const on = gateEnvelopeOn(idleEnvelope(0), settings, 0);
    const attack = advanceEnvelope(on, settings, 50);
    const swept = cutoffFromVoltage(100, attack.voltage / 5 * 2);
    expect(attack.voltage).toBeCloseTo(2.5, 10);
    expect(swept).toBeCloseTo(200, 10);

    const off = gateEnvelopeOff(on, settings, 50);
    const releasing = advanceEnvelope(off, settings, 150);
    const ended = advanceEnvelope(off, settings, 250);
    expect(releasing.voltage).toBeGreaterThan(0);
    expect(ended.voltage).toBe(0);
  });
});
