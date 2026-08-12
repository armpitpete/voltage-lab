import { describe, expect, it } from 'vitest';
import { connectPorts, createPatchState, disconnectPort, type PatchState } from '../../connection-engine/src/index';
import {
  LIVE_EVENT_HISTORY_LIMIT,
  createLiveEventRuntime,
  latestEventAtEndpoint,
  publishSignalEvent,
  recentDeliveredEvents,
  recentSourceEvents,
} from './index';

const risingTrigger = (occurredAt = 100) => ({
  sourceEndpointId: 'clock-and-trigger:trigger' as const,
  signalType: 'trigger' as const,
  edge: 'rising' as const,
  level: 5 as const,
  occurredAt,
});

describe('Live Event Runtime v1.0', () => {
  it('preserves a valid trigger edge even when no cable is connected', () => {
    const result = publishSignalEvent(createLiveEventRuntime(), createPatchState(), risingTrigger());
    expect(result.status).toBe('published');
    expect(result.deliveries).toHaveLength(0);
    expect(recentSourceEvents(result.state, 'clock-and-trigger:trigger')).toEqual([risingTrigger()]);
  });

  it('fans one trigger edge out through multiple current real direct cables', () => {
    const envelope = connectPorts(createPatchState(), 'clock-and-trigger:trigger', 'envelope:trigger');
    expect(envelope.status).toBe('connected');
    const quantizer = connectPorts(envelope.state, 'clock-and-trigger:trigger', 'quantizer:trigger');
    expect(quantizer.status).toBe('connected');

    const result = publishSignalEvent(createLiveEventRuntime(), quantizer.state, risingTrigger(250));
    expect(result.status).toBe('published');
    expect(result.deliveries).toHaveLength(2);
    expect(result.deliveries.map((delivery) => delivery.destinationEndpointId).sort()).toEqual([
      'envelope:trigger',
      'quantizer:trigger',
    ]);
    expect(result.deliveries.every((delivery) => delivery.edge === 'rising' && delivery.level === 5)).toBe(true);
  });

  it('records both gate edges so the sustained high state and release remain explicit', () => {
    const patch = connectPorts(createPatchState(), 'clock-and-trigger:gate', 'envelope:gate');
    expect(patch.status).toBe('connected');
    const rising = publishSignalEvent(createLiveEventRuntime(), patch.state, {
      sourceEndpointId: 'clock-and-trigger:gate', signalType: 'gate', edge: 'rising', level: 5, occurredAt: 100,
    });
    const falling = publishSignalEvent(rising.state, patch.state, {
      sourceEndpointId: 'clock-and-trigger:gate', signalType: 'gate', edge: 'falling', level: 0, occurredAt: 350,
    });
    const events = recentDeliveredEvents(falling.state, 'envelope:gate');
    expect(events.map(({ edge, level, occurredAt }) => ({ edge, level, occurredAt }))).toEqual([
      { edge: 'rising', level: 5, occurredAt: 100 },
      { edge: 'falling', level: 0, occurredAt: 350 },
    ]);
    expect(latestEventAtEndpoint(falling.state, 'envelope:gate')).toMatchObject({ edge: 'falling', level: 0 });
  });

  it('stops future event delivery immediately after disconnect while retaining prior evidence', () => {
    const patch = connectPorts(createPatchState(), 'clock-and-trigger:trigger', 'envelope:trigger');
    if (patch.status !== 'connected' || !patch.connection) throw new Error('Expected trigger cable.');
    const first = publishSignalEvent(createLiveEventRuntime(), patch.state, risingTrigger(100));
    expect(first.deliveries).toHaveLength(1);
    const disconnected = disconnectPort(patch.state, patch.connection.id);
    const second = publishSignalEvent(first.state, disconnected.state, risingTrigger(200));
    expect(second.deliveries).toHaveLength(0);
    expect(recentDeliveredEvents(second.state, 'envelope:trigger')).toHaveLength(1);
    expect(recentSourceEvents(second.state, 'clock-and-trigger:trigger')).toHaveLength(2);
  });

  it('rejects signal-type mismatches and invalid edge/level combinations', () => {
    const wrongType = publishSignalEvent(createLiveEventRuntime(), createPatchState(), {
      sourceEndpointId: 'clock-and-trigger:clock', signalType: 'trigger', edge: 'rising', level: 5, occurredAt: 1,
    });
    expect(wrongType.status).toBe('rejected');

    const wrongLevel = publishSignalEvent(createLiveEventRuntime(), createPatchState(), {
      sourceEndpointId: 'clock-and-trigger:gate', signalType: 'gate', edge: 'rising', level: 0, occurredAt: 1,
    });
    expect(wrongLevel.status).toBe('rejected');
  });

  it('revalidates Port Contracts and refuses a forged incompatible connection', () => {
    const valid = connectPorts(createPatchState(), 'clock-and-trigger:trigger', 'envelope:trigger');
    expect(valid.status).toBe('connected');
    const forged: PatchState = {
      ...valid.state,
      connections: valid.state.connections.map((connection) => ({
        ...connection,
        destinationEndpointId: 'filter:audio',
      })) as PatchState['connections'],
    };
    const result = publishSignalEvent(createLiveEventRuntime(), forged, risingTrigger());
    expect(result.status).toBe('published');
    expect(result.deliveries).toHaveLength(0);
  });

  it('bounds source and delivery histories without losing the newest edge evidence', () => {
    const patch = connectPorts(createPatchState(), 'clock-and-trigger:trigger', 'envelope:trigger');
    expect(patch.status).toBe('connected');
    let state = createLiveEventRuntime();
    for (let index = 0; index < LIVE_EVENT_HISTORY_LIMIT + 12; index += 1) {
      state = publishSignalEvent(state, patch.state, risingTrigger(index)).state;
    }
    expect(state.sourceEvents).toHaveLength(LIVE_EVENT_HISTORY_LIMIT);
    expect(state.deliveries).toHaveLength(LIVE_EVENT_HISTORY_LIMIT);
    expect(state.sourceEvents[0]?.occurredAt).toBe(12);
    expect(state.sourceEvents.at(-1)?.occurredAt).toBe(LIVE_EVENT_HISTORY_LIMIT + 11);
  });
});
