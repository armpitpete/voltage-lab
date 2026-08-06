import { describe, expect, it } from 'vitest';
import { inspectSignal, SIGNAL_INSPECTOR_VERSION } from './index';

describe('Voltage Lab Signal Inspector v1.0', () => {
  it('explains a declared CV socket even before a connection engine exists', () => {
    expect(inspectSignal({ endpointId: 'oscillator:pitch' })).toMatchObject({
      version: SIGNAL_INSPECTOR_VERSION,
      endpoint: { module: 'Oscillator Lab', port: 'Pitch CV', direction: 'input' },
      signal: { type: 'cv', rate: 'control-rate' },
      range: { minimum: -3, maximum: 3, unit: 'V', state: 'declared-only', value: null, position: null },
    });
  });

  it('reports an observed CV sample and its position in the declared range', () => {
    const inspection = inspectSignal({ endpointId: 'envelope:envelope', value: 2.5 });
    expect(inspection?.range).toMatchObject({ state: 'within-range', value: 2.5, position: 0.5, unit: 'V' });
  });

  it('makes out-of-range observations explicit instead of silently clipping them', () => {
    expect(inspectSignal({ endpointId: 'oscillator:pitch', value: 4 })?.range).toMatchObject({
      state: 'above-range',
      value: 4,
      position: 7 / 6,
    });
  });

  it('keeps conceptual audio voltage distinct from browser-normalised audio', () => {
    expect(inspectSignal({ endpointId: 'oscillator:waveform', value: 5 })?.range).toMatchObject({
      minimum: -10,
      maximum: 10,
      unit: 'V',
      state: 'within-range',
    });
    expect(inspectSignal({ endpointId: 'filter:audio', value: 0.5 })?.range).toMatchObject({
      minimum: -1,
      maximum: 1,
      unit: 'normalised',
      state: 'within-range',
    });
  });

  it('shows timing meaning for a clock rather than treating it as ordinary CV', () => {
    expect(inspectSignal({ endpointId: 'clock-and-trigger:clock' })?.signal.timing).toContain('Starts the next clock event.');
  });

  it('does not invent ports or accept non-finite observed values', () => {
    expect(inspectSignal({ endpointId: 'missing:port' })).toBeUndefined();
    expect(() => inspectSignal({ endpointId: 'oscillator:pitch', value: Number.NaN })).toThrow('must be finite');
  });
});
