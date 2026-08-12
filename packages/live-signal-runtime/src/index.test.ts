import { describe, expect, it } from 'vitest';
import { connectPorts, createPatchState, disconnectPort } from '../../connection-engine/src/index';
import { inspectSignal } from '../../signal-inspector/src/index';
import {
  createLiveSignalRuntime,
  evaluatePeriodicSignalSource,
  observeLiveSignal,
  observeLiveSignalAt,
  publishPeriodicSignalSource,
  publishSignal,
  sampleLiveSignalsAt,
  type PeriodicSignalSource,
} from './index';

function envelopeToVcaPatch() {
  return connectPorts(createPatchState(), 'envelope:envelope', 'vca-mixer:vca-cv').state;
}

function lfoToFilterPatch() {
  return connectPorts(createPatchState(), 'lfo-modulation:lfo', 'filter:modulation');
}

function lfoSource(overrides: Partial<PeriodicSignalSource> = {}): PeriodicSignalSource {
  return {
    version: '1.0',
    kind: 'periodic',
    sourceEndpointId: 'lfo-modulation:lfo',
    signalType: 'cv',
    waveform: 'sine',
    frequencyHz: 1,
    amplitude: 2,
    offset: 0,
    phaseCycles: 0,
    startedAtMs: 1000,
    ...overrides,
  };
}

describe('Live Signal Runtime v2.0', () => {
  it('preserves point-sample publication and real direct delivery', () => {
    const result = publishSignal(createLiveSignalRuntime(), envelopeToVcaPatch(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 2.5, observedAt: 1000,
    });
    expect(result.status).toBe('published');
    expect(result.deliveries).toEqual([expect.objectContaining({ destinationEndpointId: 'vca-mixer:vca-cv', value: 2.5 })]);
    expect(inspectSignal(observeLiveSignal(result.state, 'envelope:envelope'))?.range.value).toBe(2.5);
    expect(inspectSignal(observeLiveSignal(result.state, 'vca-mixer:vca-cv'))?.range).toMatchObject({ value: 2.5, state: 'within-range' });
  });

  it('replaces the prior point sample and recomputes its connected delivery', () => {
    const first = publishSignal(createLiveSignalRuntime(), envelopeToVcaPatch(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 1, observedAt: 1,
    });
    const second = publishSignal(first.state, envelopeToVcaPatch(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 4, observedAt: 2,
    });
    expect(second.state.outputFrames).toHaveLength(1);
    expect(observeLiveSignal(second.state, 'vca-mixer:vca-cv')).toMatchObject({ value: 4, capturedAtMs: 2 });
  });

  it('keeps an unpatched point output inspectable without inventing an input delivery', () => {
    const result = publishSignal(createLiveSignalRuntime(), createPatchState(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 5, observedAt: 1,
    });
    expect(result.deliveries).toEqual([]);
    expect(inspectSignal(observeLiveSignal(result.state, 'vca-mixer:vca-cv'))?.range.state).toBe('declared-only');
  });

  it('rejects undeclared, mismatched and out-of-range point values instead of adapting them', () => {
    const state = createLiveSignalRuntime();
    expect(publishSignal(state, createPatchState(), {
      sourceEndpointId: 'vca-mixer:vca-cv', signalType: 'cv', value: 1, observedAt: 1,
    }).status).toBe('rejected');
    expect(publishSignal(state, createPatchState(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'gate', value: 5, observedAt: 1,
    }).reason).toContain('does not match');
    expect(publishSignal(state, createPatchState(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 6, observedAt: 1,
    }).reason).toContain('will not silently clip');
  });

  it('evaluates a serialisable periodic source deterministically at requested times', () => {
    const source = lfoSource();
    expect(evaluatePeriodicSignalSource(source, 1000).value).toBeCloseTo(0, 10);
    expect(evaluatePeriodicSignalSource(source, 1250).value).toBeCloseTo(2, 10);
    expect(evaluatePeriodicSignalSource(source, 1500).value).toBeCloseTo(0, 10);
    expect(evaluatePeriodicSignalSource(source, 1750).value).toBeCloseTo(-2, 10);
  });

  it('delivers a moving source only through the current real cable', () => {
    const connection = lfoToFilterPatch();
    expect(connection.status).toBe('connected');
    const published = publishPeriodicSignalSource(createLiveSignalRuntime(), connection.state, lfoSource());
    expect(published.status).toBe('published');
    expect(published.state.periodicSources).toHaveLength(1);

    expect(observeLiveSignalAt(published.state, connection.state, 'lfo-modulation:lfo', 1250)).toMatchObject({ value: 2, capturedAtMs: 1250 });
    expect(observeLiveSignalAt(published.state, connection.state, 'filter:modulation', 1250)).toMatchObject({ value: 2, capturedAtMs: 1250 });

    const disconnected = disconnectPort(connection.state, connection.connection!.id).state;
    expect(observeLiveSignalAt(published.state, disconnected, 'filter:modulation', 1250)).toEqual({ endpointId: 'filter:modulation' });
  });

  it('rejects a periodic source whose possible range exceeds its declared socket', () => {
    const result = publishPeriodicSignalSource(createLiveSignalRuntime(), createPatchState(), lfoSource({ amplitude: 2, offset: 4 }));
    expect(result.status).toBe('rejected');
    expect(result.reason).toContain('would produce 2 to 6');
    expect(result.reason).toContain('will not be silently clipped');
  });

  it('rejects invalid periodic parameters and non-finite sampling times', () => {
    expect(publishPeriodicSignalSource(createLiveSignalRuntime(), createPatchState(), lfoSource({ frequencyHz: 0 })).reason).toContain('greater than zero');
    expect(publishPeriodicSignalSource(createLiveSignalRuntime(), createPatchState(), lfoSource({ amplitude: -1 })).reason).toContain('must not be negative');
    expect(sampleLiveSignalsAt(createLiveSignalRuntime(), createPatchState(), Number.NaN).status).toBe('rejected');
  });

  it('lets an explicit point publication replace a time-varying source on the same socket', () => {
    const periodic = publishPeriodicSignalSource(createLiveSignalRuntime(), createPatchState(), lfoSource());
    const point = publishSignal(periodic.state, createPatchState(), {
      sourceEndpointId: 'lfo-modulation:lfo', signalType: 'cv', value: 1.25, observedAt: 2000,
    });
    expect(point.status).toBe('published');
    expect(point.state.periodicSources).toEqual([]);
    expect(observeLiveSignal(point.state, 'lfo-modulation:lfo')).toMatchObject({ value: 1.25, capturedAtMs: 2000 });
  });
});
