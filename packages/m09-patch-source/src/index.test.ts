import { describe, expect, it } from 'vitest';
import { connectPorts, createPatchState, disconnectPort } from '../../connection-engine/src/index';
import { createLiveSignalRuntime } from '../../live-signal-runtime/src/index';
import { lfoVoltage } from '../../lfo-modulation-model/src/index';
import {
  createM09PatchSource,
  normaliseM09PatchSourceControls,
  publishM09PatchSource,
  sampleM09Destinations,
  sampleM09FilterCutoff,
  updateM09PatchSource,
} from './index';

function filterPatch() {
  return connectPorts(createPatchState(), 'lfo-modulation:lfo', 'filter:cutoff');
}

function filterAndVcaPatch() {
  const filter = filterPatch();
  if (filter.status !== 'connected') throw new Error('Expected direct M09 filter cable.');
  return connectPorts(filter.state, 'lfo-modulation:lfo', 'vca-mixer:modulation');
}

describe('M09 Patch Source v0.1', () => {
  it('normalises the same visible control bounds as the accepted M09 Lab', () => {
    expect(normaliseM09PatchSourceControls({
      waveform: 'bad' as never,
      rateHz: 99,
      amplitudeVolts: 9,
      offsetVolts: -9,
      phaseDegrees: 999,
      seed: 99,
    })).toEqual({
      waveform: 'sine', rateHz: 20, amplitudeVolts: 5, offsetVolts: -5, phaseDegrees: 180, seed: 32,
    });
  });

  it('publishes an explicit source but does not invent a filter delivery without a cable', () => {
    const source = createM09PatchSource({ waveform: 'sine', rateHz: 1, amplitudeVolts: 2, offsetVolts: 0 }, 0);
    const published = publishM09PatchSource(createLiveSignalRuntime(), createPatchState(), source);
    expect(published.status).toBe('published');
    const sample = sampleM09FilterCutoff(published.state, createPatchState(), 250, 1.25);
    expect(sample.sourceVoltage).toBeCloseTo(2);
    expect(sample.connected).toBe(false);
    expect(sample.cutoffCv).toBe(1.25);
  });

  it('delivers the moving source through the real M09 LFO → Filter Cutoff cable only', () => {
    const patch = filterPatch();
    expect(patch.status).toBe('connected');
    const source = createM09PatchSource({ waveform: 'triangle', rateHz: 1, amplitudeVolts: 4, offsetVolts: 0 }, 0);
    const published = publishM09PatchSource(createLiveSignalRuntime(), patch.state, source);
    const quarter = sampleM09FilterCutoff(published.state, patch.state, 250, 0);
    const half = sampleM09FilterCutoff(quarter.runtime, patch.state, 500, 0);
    expect(quarter.connected).toBe(true);
    expect(quarter.cutoffCv).toBeCloseTo(0);
    expect(half.cutoffCv).toBeCloseTo(4);
  });

  it('samples one M09 source into both directly cabled filter and VCA modulation inputs', () => {
    const patch = filterAndVcaPatch();
    expect(patch.status).toBe('connected');
    const source = createM09PatchSource({ waveform: 'square', rateHz: 1, amplitudeVolts: 3, offsetVolts: 0 }, 0);
    const published = publishM09PatchSource(createLiveSignalRuntime(), patch.state, source);
    const sample = sampleM09Destinations(published.state, patch.state, 100, -1.25);
    expect(sample.sourceVoltage).toBe(3);
    expect(sample.filterConnected).toBe(true);
    expect(sample.cutoffCv).toBe(3);
    expect(sample.vcaConnected).toBe(true);
    expect(sample.vcaModulationCv).toBe(3);
  });

  it('removes only the disconnected VCA delivery while preserving the other real M09 cable', () => {
    const patch = filterAndVcaPatch();
    if (patch.status !== 'connected' || !patch.connection) throw new Error('Expected direct M09 VCA cable.');
    const source = createM09PatchSource({ waveform: 'square', rateHz: 1, amplitudeVolts: 2 }, 0);
    const published = publishM09PatchSource(createLiveSignalRuntime(), patch.state, source);
    const disconnected = disconnectPort(patch.state, patch.connection.id);
    const sample = sampleM09Destinations(published.state, disconnected.state, 100, -1.5);
    expect(sample.filterConnected).toBe(true);
    expect(sample.cutoffCv).toBe(2);
    expect(sample.vcaConnected).toBe(false);
    expect(sample.vcaModulationCv).toBeUndefined();
  });

  it('removes the filter effect on the next sample after the cable is disconnected', () => {
    const patch = filterPatch();
    if (!patch.connection) throw new Error('Expected direct M09 filter cable.');
    const source = createM09PatchSource({ waveform: 'square', rateHz: 1, amplitudeVolts: 3 }, 0);
    const published = publishM09PatchSource(createLiveSignalRuntime(), patch.state, source);
    expect(sampleM09FilterCutoff(published.state, patch.state, 100, 0).cutoffCv).toBe(3);
    const disconnected = disconnectPort(patch.state, patch.connection.id);
    const sample = sampleM09FilterCutoff(published.state, disconnected.state, 100, -1.5);
    expect(sample.connected).toBe(false);
    expect(sample.cutoffCv).toBe(-1.5);
  });

  it('matches accepted M09 source clamp semantics', () => {
    const controls = { waveform: 'sine' as const, rateHz: 1, amplitudeVolts: 5, offsetVolts: 4, phaseDegrees: 90, seed: 7 };
    const source = createM09PatchSource(controls, 0);
    const published = publishM09PatchSource(createLiveSignalRuntime(), createPatchState(), source);
    const sample = sampleM09FilterCutoff(published.state, createPatchState(), 0, 0);
    const accepted = lfoVoltage({
      shape: controls.waveform,
      phaseCycles: controls.phaseDegrees / 360,
      amplitudeVoltage: controls.amplitudeVolts,
      offsetVoltage: controls.offsetVolts,
      minimumVoltage: -5,
      maximumVoltage: 5,
      seed: controls.seed,
    });
    expect(sample.sourceVoltage).toBeCloseTo(accepted.voltage);
    expect(sample.sourceVoltage).toBe(5);
  });

  it('updates live controls without resetting phase unless phase itself changes', () => {
    const initial = createM09PatchSource({ waveform: 'sine', rateHz: 1, amplitudeVolts: 2, phaseDegrees: 0 }, 0);
    const updated = updateM09PatchSource(initial, { amplitudeVolts: 3, rateHz: 2 }, 250);
    expect(updated.source.startedAtMs).toBe(250);
    expect(updated.source.phaseCycles).toBeCloseTo(0.25);
    expect(updated.source.frequencyHz).toBe(2);
    expect(updated.source.amplitude).toBe(3);

    const resetPhase = updateM09PatchSource(updated, { phaseDegrees: -180 }, 500);
    expect(resetPhase.source.phaseCycles).toBeCloseTo(-0.5);
  });
});
