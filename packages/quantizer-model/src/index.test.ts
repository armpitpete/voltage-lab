import { describe, expect, it } from 'vitest';
import {
  allowedPitchClasses,
  correctionCents,
  isAllowedSemitone,
  noteNameFromVoltage,
  quantizeVoltage,
  semitoneVoltage,
  sweepVoltage,
  triggerHeldVoltage,
  voltageToFrequency,
} from './index';

describe('quantizer model', () => {
  it('uses exactly one twelfth of a volt per semitone', () => {
    expect(semitoneVoltage()).toBeCloseTo(1 / 12, 12);
    expect(quantizeVoltage(1 / 12, 0, 'chromatic')).toBeCloseTo(1 / 12, 12);
  });

  it('uses exact one volt per octave', () => {
    expect(voltageToFrequency(1)).toBeCloseTo(voltageToFrequency(0) * 2, 8);
    expect(voltageToFrequency(-1)).toBeCloseTo(voltageToFrequency(0) / 2, 8);
  });

  it('quantizes only to notes in the selected scale', () => {
    for (let input = -2; input <= 4; input += 0.013) {
      const output = quantizeVoltage(input, 2, 'minorPentatonic');
      expect(isAllowedSemitone(Math.round(output * 12), 2, 'minorPentatonic')).toBe(true);
    }
  });

  it('moves the scale with its root note', () => {
    expect(allowedPitchClasses(0, 'major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(allowedPitchClasses(2, 'major')).toEqual([2, 4, 6, 7, 9, 11, 1]);
  });

  it('chooses the nearest allowed note and resolves exact ties downward', () => {
    expect(quantizeVoltage(0.10, 0, 'major')).toBeCloseTo(1 / 6, 12);
    expect(quantizeVoltage(1 / 24, 0, 'chromatic')).toBeCloseTo(0, 12);
  });

  it('holds output until a trigger arrives', () => {
    const held = triggerHeldVoltage(0.31, 0.25, false, 0, 'major');
    expect(held).toBe(0.25);
    const updated = triggerHeldVoltage(0.31, held, true, 0, 'major');
    expect(updated).toBeCloseTo(1 / 3, 12);
  });

  it('reports note names and correction size', () => {
    expect(noteNameFromVoltage(0)).toBe('C4');
    expect(noteNameFromVoltage(1)).toBe('C5');
    expect(correctionCents(0.1, 1 / 12)).toBeCloseTo(-20, 8);
  });

  it('produces a bounded repeating sweep', () => {
    expect(sweepVoltage(0, -1, 1, 1)).toBeCloseTo(-1);
    expect(sweepVoltage(0.5, -1, 1, 1)).toBeCloseTo(1);
    expect(sweepVoltage(1, -1, 1, 1)).toBeCloseTo(-1);
  });
});
