import { describe, expect, it } from 'vitest';
import {
  clonePreset,
  nextPatchStep,
  patchGateHigh,
  patchSnapshotAt,
  patchStepDurationMs,
  patchStepSnapshot,
  snapshotBelongsToScale,
  transportStepIndex,
  type PatchSettings,
} from './index';

const settings: PatchSettings = {
  bpm: 120,
  stepsPerBeat: 2,
  gatePercent: 50,
  root: 0,
  scale: 'major',
  octaveOffset: 0,
  tuningCents: 0,
};

const sequence = clonePreset('ascending');

describe('Patch Lab model', () => {
  it('derives deterministic step duration and transport positions', () => {
    expect(patchStepDurationMs(120, 2)).toBe(250);
    expect(transportStepIndex(true, 0, 1000, 1000, 120, 2)).toBe(0);
    expect(transportStepIndex(true, 0, 1000, 1249, 120, 2)).toBe(0);
    expect(transportStepIndex(true, 0, 1000, 1250, 120, 2)).toBe(1);
    expect(transportStepIndex(true, 0, 1000, 3000, 120, 2)).toBe(0);
  });

  it('holds the selected step while transport is stopped', () => {
    expect(transportStepIndex(false, 5, 0, 999999, 120, 2)).toBe(5);
    expect(nextPatchStep(7)).toBe(0);
  });

  it('uses inactive steps as rests', () => {
    const rests = clonePreset('octaveRests');
    const snapshot = patchStepSnapshot(rests, 1, settings, 10);
    expect(snapshot.stepActive).toBe(false);
    expect(snapshot.gateHigh).toBe(false);
  });

  it('limits each active gate to the configured part of its step', () => {
    expect(patchGateHigh(true, 124, 250, 50)).toBe(true);
    expect(patchGateHigh(true, 125, 250, 50)).toBe(false);
    expect(patchGateHigh(false, 1, 250, 99)).toBe(false);
  });

  it('keeps every output inside the selected scale', () => {
    for (let index = 0; index < sequence.length; index += 1) {
      const snapshot = patchStepSnapshot(sequence, index, settings);
      expect(snapshotBelongsToScale(snapshot, settings.root, settings.scale)).toBe(true);
    }
  });

  it('preserves exact one volt per octave behaviour', () => {
    const base = patchStepSnapshot([{ voltage: 0, gate: true }], 0, settings);
    const octave = patchStepSnapshot([{ voltage: 1, gate: true }], 0, settings);
    expect(octave.frequencyHz / base.frequencyHz).toBeCloseTo(2, 12);
  });

  it('applies octave and tuning offsets predictably', () => {
    const base = patchStepSnapshot([{ voltage: 0, gate: true }], 0, settings);
    const shifted = patchStepSnapshot([{ voltage: 0, gate: true }], 0, {
      ...settings,
      octaveOffset: 1,
      tuningCents: 100,
    });
    expect(shifted.oscillatorVoltage - base.oscillatorVoltage).toBeCloseTo(1 + 1 / 12, 12);
    expect(shifted.frequencyHz / base.frequencyHz).toBeCloseTo(2 ** (13 / 12), 12);
  });

  it('combines transport, quantization and gate state in one snapshot', () => {
    const snapshot = patchSnapshotAt(sequence, true, 0, 1000, 1375, settings);
    expect(snapshot.index).toBe(1);
    expect(snapshot.stepElapsedMs).toBe(125);
    expect(snapshot.gateHigh).toBe(false);
    expect(snapshot.note).toMatch(/^[A-G]/);
  });
});
