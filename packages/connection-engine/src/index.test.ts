import { describe, expect, it } from 'vitest';
import {
  connectPorts,
  createPatchState,
  disconnectPort,
  propagateSignals,
} from './index';

describe('Connection Engine v1.0', () => {
  it('creates serialisable state for a directly compatible output-to-input route', () => {
    const result = connectPorts(createPatchState(), 'clock-and-trigger:clock', 'sample-and-hold:event');
    expect(result.status).toBe('connected');
    expect(result.connection).toMatchObject({
      id: 'connection:1',
      sourceEndpointId: 'clock-and-trigger:clock',
      destinationEndpointId: 'sample-and-hold:event',
      compatibility: { level: 'direct', semantic: 'event-conversion' },
    });
    expect(JSON.parse(JSON.stringify(result.state))).toMatchObject({ version: '1.0', nextConnectionNumber: 2 });
  });

  it('allows an output to fan out but keeps one source per input', () => {
    const first = connectPorts(createPatchState(), 'clock-and-trigger:clock', 'sample-and-hold:event');
    const fanout = connectPorts(first.state, 'clock-and-trigger:clock', 'quantizer:trigger');
    expect(fanout.status).toBe('connected');
    expect(fanout.state.connections).toHaveLength(2);

    const occupied = connectPorts(fanout.state, 'clock-and-trigger:trigger', 'sample-and-hold:event');
    expect(occupied.status).toBe('rejected');
    expect(occupied.state).toBe(fanout.state);
    expect(occupied.reason).toContain('already has');
  });

  it('does not silently create adapters for compatible-but-adaptation-required routes', () => {
    const result = connectPorts(createPatchState(), 'lfo-modulation:lfo', 'oscillator:pitch');
    expect(result.status).toBe('rejected');
    expect(result.state.connections).toHaveLength(0);
    expect(result.reason).toContain('does not apply an adapter automatically');
  });

  it('keeps invalid directions and unknown sockets out of patch state', () => {
    const backwards = connectPorts(createPatchState(), 'envelope:gate', 'clock-and-trigger:clock');
    expect(backwards.status).toBe('rejected');
    expect(backwards.reason).toContain('output socket');

    const missing = connectPorts(createPatchState(), 'unknown:out', 'sample-and-hold:event');
    expect(missing.status).toBe('rejected');
    expect(missing.state.connections).toHaveLength(0);
  });

  it('delivers direct signal frames to every connected destination without module-side effects', () => {
    const first = connectPorts(createPatchState(), 'clock-and-trigger:clock', 'sample-and-hold:event');
    const state = connectPorts(first.state, 'clock-and-trigger:clock', 'quantizer:trigger').state;
    const propagation = propagateSignals(state, [{
      sourceEndpointId: 'clock-and-trigger:clock', signalType: 'clock', value: 5, observedAt: 100,
    }]);
    expect(propagation.rejectedFrames).toEqual([]);
    expect(propagation.deliveries).toEqual([
      expect.objectContaining({ connectionId: 'connection:1', destinationEndpointId: 'sample-and-hold:event', destinationSignalType: 'trigger', value: 5 }),
      expect.objectContaining({ connectionId: 'connection:2', destinationEndpointId: 'quantizer:trigger', destinationSignalType: 'trigger', value: 5 }),
    ]);
  });

  it('stops delivery after a connection is removed and reports malformed frames', () => {
    const connected = connectPorts(createPatchState(), 'clock-and-trigger:clock', 'sample-and-hold:event');
    const disconnected = disconnectPort(connected.state, 'connection:1');
    expect(disconnected.status).toBe('disconnected');
    expect(propagateSignals(disconnected.state, [{
      sourceEndpointId: 'clock-and-trigger:clock', signalType: 'clock', value: 5, observedAt: 100,
    }]).deliveries).toEqual([]);

    const malformed = propagateSignals(connected.state, [{
      sourceEndpointId: 'clock-and-trigger:clock', signalType: 'gate', value: Number.NaN, observedAt: 100,
    }]);
    expect(malformed.rejectedFrames[0]?.reason).toContain('does not match');
  });
});
