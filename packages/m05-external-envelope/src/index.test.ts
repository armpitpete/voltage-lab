import { describe, expect, it } from 'vitest';
import type { EventDelivery } from '../../live-event-runtime/src/index';
import {
  applyM05DeliveredEvents,
  createM05ExternalEnvelope,
  normaliseM05ExternalEnvelopeControls,
  sampleM05ExternalEnvelope,
  updateM05ExternalEnvelopeControls,
} from './index';

function gate(edge: 'rising' | 'falling', occurredAt: number): EventDelivery {
  return {
    sourceEndpointId: 'clock-and-trigger:gate',
    signalType: 'gate',
    edge,
    level: edge === 'rising' ? 5 : 0,
    occurredAt,
    connectionId: 'connection:1',
    destinationEndpointId: 'envelope:gate',
    destinationSignalType: 'gate',
  };
}

function trigger(edge: 'rising' | 'falling', occurredAt: number): EventDelivery {
  return {
    sourceEndpointId: 'clock-and-trigger:trigger',
    signalType: 'trigger',
    edge,
    level: edge === 'rising' ? 5 : 0,
    occurredAt,
    connectionId: 'connection:2',
    destinationEndpointId: 'envelope:trigger',
    destinationSignalType: 'trigger',
  };
}

describe('M05 External Envelope v0.1', () => {
  it('normalises the accepted visible M05 control bounds', () => {
    expect(normaliseM05ExternalEnvelopeControls({
      attackMs: -1,
      decayMs: 9999,
      sustainLevel: 2,
      releaseMs: 9999,
      triggerLengthMs: 1,
    })).toEqual({
      attackMs: 0,
      decayMs: 3000,
      sustainLevel: 1,
      releaseMs: 5000,
      triggerLengthMs: 20,
    });
  });

  it('uses real Gate rising/falling deliveries for accepted attack/sustain/release behavior', () => {
    let state = createM05ExternalEnvelope({ attackMs: 100, decayMs: 100, sustainLevel: 0.5, releaseMs: 200 }, 0);
    state = applyM05DeliveredEvents(state, [gate('rising', 0)]);
    expect(sampleM05ExternalEnvelope(state, 50).snapshot.voltage).toBeCloseTo(2.5);
    const sustain = sampleM05ExternalEnvelope(state, 250);
    expect(sustain.snapshot.stage).toBe('sustain');
    expect(sustain.snapshot.voltage).toBeCloseTo(2.5);

    state = applyM05DeliveredEvents(sustain.state, [gate('falling', 300)]);
    const release = sampleM05ExternalEnvelope(state, 400);
    expect(release.snapshot.stage).toBe('release');
    expect(release.snapshot.voltage).toBeCloseTo(1.25);
    expect(sampleM05ExternalEnvelope(release.state, 500).snapshot.voltage).toBeCloseTo(0);
  });

  it('treats Trigger rising as a one-shot gate and ignores the short physical falling edge', () => {
    let state = createM05ExternalEnvelope({ attackMs: 100, decayMs: 100, sustainLevel: 0.5, releaseMs: 200, triggerLengthMs: 220 }, 0);
    state = applyM05DeliveredEvents(state, [trigger('rising', 10), trigger('falling', 27.5)]);
    const afterPhysicalPulse = sampleM05ExternalEnvelope(state, 100);
    expect(afterPhysicalPulse.snapshot.gate).toBe(true);
    expect(afterPhysicalPulse.state.oneShotEndsAtMs).toBe(230);

    const justBeforeEnd = sampleM05ExternalEnvelope(afterPhysicalPulse.state, 229);
    expect(justBeforeEnd.snapshot.gate).toBe(true);
    const afterEnd = sampleM05ExternalEnvelope(justBeforeEnd.state, 240);
    expect(afterEnd.snapshot.gate).toBe(false);
    expect(afterEnd.snapshot.stage).toBe('release');
  });

  it('retriggers from the current voltage without a discontinuity', () => {
    let state = createM05ExternalEnvelope({ attackMs: 100, decayMs: 100, sustainLevel: 0.5, releaseMs: 200, triggerLengthMs: 220 }, 0);
    state = applyM05DeliveredEvents(state, [trigger('rising', 0)]);
    const before = sampleM05ExternalEnvelope(state, 50);
    expect(before.snapshot.voltage).toBeCloseTo(2.5);

    state = applyM05DeliveredEvents(before.state, [trigger('rising', 50)]);
    const immediate = sampleM05ExternalEnvelope(state, 50);
    expect(immediate.snapshot.voltage).toBeCloseTo(before.snapshot.voltage);
    expect(sampleM05ExternalEnvelope(immediate.state, 100).snapshot.voltage).toBeCloseTo(3.75);
  });

  it('lets an external Gate hold the envelope after a Trigger one-shot expires', () => {
    let state = createM05ExternalEnvelope({ attackMs: 50, decayMs: 50, sustainLevel: 0.6, releaseMs: 100, triggerLengthMs: 100 }, 0);
    state = applyM05DeliveredEvents(state, [trigger('rising', 0), gate('rising', 50)]);
    const afterOneShot = sampleM05ExternalEnvelope(state, 150);
    expect(afterOneShot.snapshot.gate).toBe(true);
    expect(afterOneShot.snapshot.stage).toBe('sustain');

    state = applyM05DeliveredEvents(afterOneShot.state, [gate('falling', 200)]);
    expect(sampleM05ExternalEnvelope(state, 225).snapshot.stage).toBe('release');
  });

  it('rebases an in-flight stage on settings changes without changing its current voltage', () => {
    let state = createM05ExternalEnvelope({ attackMs: 200, decayMs: 100, sustainLevel: 0.5, releaseMs: 200 }, 0);
    state = applyM05DeliveredEvents(state, [gate('rising', 0)]);
    const before = sampleM05ExternalEnvelope(state, 50);
    expect(before.snapshot.voltage).toBeCloseTo(1.25);

    const changed = updateM05ExternalEnvelopeControls(before.state, { attackMs: 400 }, 50);
    const immediate = sampleM05ExternalEnvelope(changed, 50);
    expect(immediate.snapshot.voltage).toBeCloseTo(before.snapshot.voltage);
  });

  it('ignores non-M05 deliveries and refuses chronological rollback', () => {
    const state = createM05ExternalEnvelope({}, 100);
    const unrelated = {
      ...trigger('rising', 120),
      destinationEndpointId: 'quantizer:trigger' as const,
    } as EventDelivery;
    const unchanged = applyM05DeliveredEvents(state, [unrelated]);
    expect(unchanged).toEqual(state);
    expect(() => sampleM05ExternalEnvelope(state, 99)).toThrow(/chronological/i);
  });
});
