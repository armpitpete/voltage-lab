import { describe, expect, it } from 'vitest';
import { createBrowserAudioSource } from './index';

describe('Browser Audio Boundary v1.0', () => {
  it('makes Module 03’s conceptual peak-to-browser normalisation explicit', () => {
    expect(createBrowserAudioSource({ version: '1.0', waveform: 'saw', frequencyHz: 440, amplitudeVolts: 5, pulseWidth: 0.5, observedAt: 1 })).toMatchObject({
      waveform: 'saw', frequencyHz: 440, sourcePeakVolts: 5, normalisedPeak: 0.5,
    });
  });
});
