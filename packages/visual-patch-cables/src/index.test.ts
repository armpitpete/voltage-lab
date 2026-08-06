import { describe, expect, it } from 'vitest';
import { connectPorts, createPatchState, disconnectPort } from '../../connection-engine/src/index';
import { PORT_CONTRACTS } from '../../port-contracts/src/index';
import { visualisePatchState } from './index';

describe('Visual Patch Cables v1.0', () => {
  it('draws one directional cable for each real direct connection', () => {
    const state = connectPorts(
      createPatchState(),
      'clock-and-trigger:clock',
      'sample-and-hold:event',
    ).state;
    const view = visualisePatchState(state);
    expect(view.problems).toEqual([]);
    expect(view.cables).toEqual([expect.objectContaining({
      connectionId: 'connection:1',
      direction: 'output-to-input',
      signalType: 'clock',
      source: expect.objectContaining({ label: 'Clock' }),
      destination: expect.objectContaining({ label: 'Trigger / gate' }),
    })]);
    expect(view.cables[0]?.accessibleLabel).toContain('output connected to');
  });

  it('keeps output fan-out as separate visible directional cables', () => {
    const first = connectPorts(createPatchState(), 'clock-and-trigger:clock', 'sample-and-hold:event');
    const state = connectPorts(first.state, 'clock-and-trigger:clock', 'quantizer:trigger').state;
    const view = visualisePatchState(state);
    expect(view.cables.map((cable) => cable.connectionId)).toEqual(['connection:1', 'connection:2']);
  });

  it('removes the visual cable when the real connection is removed', () => {
    const connected = connectPorts(createPatchState(), 'clock-and-trigger:clock', 'sample-and-hold:event');
    const state = disconnectPort(connected.state, 'connection:1').state;
    expect(visualisePatchState(state).cables).toEqual([]);
  });

  it('does not invent a cable for malformed saved connection data', () => {
    const state = {
      ...createPatchState(),
      connections: [{
        id: 'connection:1' as const,
        sourceEndpointId: 'clock-and-trigger:clock' as const,
        destinationEndpointId: 'missing:input' as never,
        compatibility: { compatible: true, level: 'direct' as const, semantic: 'same-signal' as const, adaptation: 'none' as const, reason: '', teachingNote: '' },
      }],
    };
    const view = visualisePatchState(state, PORT_CONTRACTS);
    expect(view.cables).toEqual([]);
    expect(view.problems[0]?.reason).toContain('cannot be drawn');
  });
});
