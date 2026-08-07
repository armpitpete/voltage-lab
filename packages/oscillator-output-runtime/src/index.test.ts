import { describe, expect, it } from 'vitest';
import { publishOscillatorOutput, readOscillatorOutput, resetOscillatorOutputForTest } from './index';

describe('Oscillator Output Runtime v1.0', () => {
  it('retains only a finite Module 03 source configuration and has no invented default', () => {
    resetOscillatorOutputForTest();
    expect(readOscillatorOutput()).toBeUndefined();
    const published = publishOscillatorOutput({ waveform: 'pulse', frequencyHz: 220, amplitudeVolts: 2.5, pulseWidth: 0.4, observedAt: 100 });
    expect(readOscillatorOutput()).toEqual(published);
  });

  it('rejects invalid source states instead of clipping them into a browser source', () => {
    expect(() => publishOscillatorOutput({ waveform: 'sine', frequencyHz: 18001, amplitudeVolts: 2.5, pulseWidth: 0.5, observedAt: 1 })).toThrow('20 to 18000');
    expect(() => publishOscillatorOutput({ waveform: 'sine', frequencyHz: 220, amplitudeVolts: 5.1, pulseWidth: 0.5, observedAt: 1 })).toThrow('0 to 5 V');
  });
});
