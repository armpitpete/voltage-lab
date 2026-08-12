import { describe, expect, it } from 'vitest';
import { createBrowserAudioSource } from '../../../packages/browser-audio-boundary/src/index';
import { modulatedParameters, type ModulationDestination } from '../../../packages/oscillator-model/src/index';
import { effectivePatchOscillatorSource } from './m09-oscillator-runtime';

const base = createBrowserAudioSource({
  version: '1.0',
  waveform: 'pulse',
  frequencyHz: 220,
  amplitudeVolts: 2.5,
  pulseWidth: 0.5,
  observedAt: 0,
});

function accepted(destination: ModulationDestination, cv: number) {
  return modulatedParameters(base.frequencyHz, base.pulseWidth, base.sourcePeakVolts, destination, cv);
}

describe('Patch Canvas M09 → M03 modulation', () => {
  it('restores the exact base oscillator source when the real cable is absent', () => {
    const result = effectivePatchOscillatorSource({ baseSource: base, modulationCv: 5, destination: 'pitch', connected: false, observedAt: 100 });
    expect(result.frequencyHz).toBe(base.frequencyHz);
    expect(result.pulseWidth).toBe(base.pulseWidth);
    expect(result.sourcePeakVolts).toBe(base.sourcePeakVolts);
  });

  it.each<ModulationDestination>(['pitch', 'pulseWidth', 'amplitude'])('matches accepted M03 %s modulation semantics exactly', (destination) => {
    const cv = 1.25;
    const expected = accepted(destination, cv);
    const result = effectivePatchOscillatorSource({ baseSource: base, modulationCv: cv, destination, connected: true, observedAt: 250 });
    expect(result.frequencyHz).toBeCloseTo(expected.frequencyHz);
    expect(result.pulseWidth).toBeCloseTo(expected.pulseWidth);
    expect(result.sourcePeakVolts).toBeCloseTo(expected.amplitude);
  });

  it('preserves the accepted pulse-width and amplitude clamps at the full M09 range', () => {
    const narrow = effectivePatchOscillatorSource({ baseSource: base, modulationCv: -5, destination: 'pulseWidth', connected: true, observedAt: 10 });
    const wide = effectivePatchOscillatorSource({ baseSource: base, modulationCv: 5, destination: 'pulseWidth', connected: true, observedAt: 20 });
    const silent = effectivePatchOscillatorSource({ baseSource: base, modulationCv: -5, destination: 'amplitude', connected: true, observedAt: 30 });
    const loud = effectivePatchOscillatorSource({ baseSource: base, modulationCv: 5, destination: 'amplitude', connected: true, observedAt: 40 });
    expect(narrow.pulseWidth).toBe(0.05);
    expect(wide.pulseWidth).toBe(0.95);
    expect(silent.sourcePeakVolts).toBe(0);
    expect(loud.sourcePeakVolts).toBe(5);
  });
});
