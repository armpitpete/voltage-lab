import { describe, expect, it } from 'vitest';
import { connectPorts, createPatchState } from '../../connection-engine/src/index';
import { inspectSignal } from '../../signal-inspector/src/index';
import { createLiveSignalRuntime, observeLiveSignal, publishSignal } from './index';

function envelopeToVcaPatch() {
  return connectPorts(createPatchState(), 'envelope:envelope', 'vca-mixer:vca-cv').state;
}

describe('Live Signal Runtime v1.0', () => {
  it('publishes a declared output and exposes its real direct input delivery to Signal Inspector', () => {
    const result = publishSignal(createLiveSignalRuntime(), envelopeToVcaPatch(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 2.5, observedAt: 1000,
    });
    expect(result.status).toBe('published');
    expect(result.deliveries).toEqual([expect.objectContaining({ destinationEndpointId: 'vca-mixer:vca-cv', value: 2.5 })]);
    expect(inspectSignal(observeLiveSignal(result.state, 'envelope:envelope'))?.range.value).toBe(2.5);
    expect(inspectSignal(observeLiveSignal(result.state, 'vca-mixer:vca-cv'))?.range).toMatchObject({ value: 2.5, state: 'within-range' });
  });

  it('replaces the prior output sample and recomputes its connected delivery', () => {
    const first = publishSignal(createLiveSignalRuntime(), envelopeToVcaPatch(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 1, observedAt: 1,
    });
    const second = publishSignal(first.state, envelopeToVcaPatch(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 4, observedAt: 2,
    });
    expect(second.state.outputFrames).toHaveLength(1);
    expect(observeLiveSignal(second.state, 'vca-mixer:vca-cv')).toMatchObject({ value: 4, capturedAtMs: 2 });
  });

  it('keeps an unpatched output inspectable without inventing an input delivery', () => {
    const result = publishSignal(createLiveSignalRuntime(), createPatchState(), {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value: 5, observedAt: 1,
    });
    expect(result.deliveries).toEqual([]);
    expect(inspectSignal(observeLiveSignal(result.state, 'vca-mixer:vca-cv'))?.range.state).toBe('declared-only');
  });

  it('rejects undeclared, mismatched and out-of-range values instead of adapting them', () => {
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
});
