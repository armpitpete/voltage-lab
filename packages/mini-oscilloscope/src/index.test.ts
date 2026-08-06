import { describe, expect, it } from 'vitest';
import { createMiniScopePreview, formatMiniScopeRange, type MiniScopeWaveform } from './index';

describe('Universal Mini-Oscilloscope v1.0', () => {
  it('creates a deterministic bounded trace inside a declared bipolar voltage range', () => {
    const preview = createMiniScopePreview({
      label: 'Oscillator', endpointId: 'oscillator:waveform', waveform: 'sine',
      range: { minimum: -10, maximum: 10, unit: 'V' }, teachingNote: 'A repeating audio-rate voltage.',
    });
    expect(preview.points).toHaveLength(72);
    expect(preview.points[0]?.x).toBe(0);
    expect(preview.points.at(-1)?.x).toBe(1);
    expect(preview.points.every((point) => point.y >= 0 && point.y <= 1 && point.value >= -10 && point.value <= 10)).toBe(true);
  });

  it('keeps unipolar envelope previews inside the declared 0–5 V range', () => {
    const preview = createMiniScopePreview({
      label: 'Envelope CV', endpointId: 'envelope:envelope', waveform: 'envelope',
      range: { minimum: 0, maximum: 5, unit: 'V' }, teachingNote: 'An ADSR-shaped control voltage.',
    });
    expect(Math.min(...preview.points.map((point) => point.value))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...preview.points.map((point) => point.value))).toBeLessThanOrEqual(5);
    expect(preview.limitation).toContain('does not sample a live cable');
  });

  it('supports every teaching waveform without invalid numbers', () => {
    const waveforms: readonly MiniScopeWaveform[] = ['sine', 'stepped', 'pulse', 'envelope', 'filtered'];
    for (const waveform of waveforms) {
      const preview = createMiniScopePreview({
        label: waveform, endpointId: `test:${waveform}`, waveform,
        range: { minimum: -1, maximum: 1, unit: 'normalised' }, teachingNote: 'Test signal.',
      });
      expect(preview.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.value))).toBe(true);
    }
  });

  it('rejects missing identity, invalid ranges and undersampled traces', () => {
    expect(() => createMiniScopePreview({ label: '', endpointId: 'x:y', waveform: 'sine', range: { minimum: -1, maximum: 1, unit: 'V' }, teachingNote: 'x' })).toThrow('label');
    expect(() => createMiniScopePreview({ label: 'x', endpointId: 'x:y', waveform: 'sine', range: { minimum: 1, maximum: 1, unit: 'V' }, teachingNote: 'x' })).toThrow('increasing');
    expect(() => createMiniScopePreview({ label: 'x', endpointId: 'x:y', waveform: 'sine', range: { minimum: -1, maximum: 1, unit: 'V' }, sampleCount: 7, teachingNote: 'x' })).toThrow('eight');
  });

  it('formats range and representation explicitly', () => {
    expect(formatMiniScopeRange({ minimum: -5, maximum: 5, unit: 'V' })).toBe('-5 to +5 V');
    expect(formatMiniScopeRange({ minimum: -1, maximum: 1, unit: 'normalised' })).toBe('-1 to +1 normalised');
  });
});
