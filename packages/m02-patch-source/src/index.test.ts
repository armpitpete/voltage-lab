import { describe, expect, it } from 'vitest';
import { clockFrame, periodMs, swungInterval } from '../../clock-model/src/index';
import { connectPorts, createPatchState, disconnectPort } from '../../connection-engine/src/index';
import { createLiveEventRuntime, recentDeliveredEvents } from '../../live-event-runtime/src/index';
import {
  createM02PatchSource,
  m02EventsBetween,
  m02OutputLevelsAt,
  normaliseM02PatchSourceControls,
  publishM02EventWindow,
  resetM02PatchSource,
  updateM02PatchSource,
} from './index';

describe('M02 Patch Source v0.1', () => {
  it('normalises only the accepted visible M02 control range/set', () => {
    expect(normaliseM02PatchSourceControls({
      bpm: 999,
      pulseWidth: 0,
      swing: 1,
      division: 3 as never,
      multiplication: 8,
    })).toEqual({
      bpm: 240,
      pulseWidth: 0.05,
      swing: 0.45,
      division: 4,
      multiplication: 8,
    });
  });

  it('matches the accepted Lab clockFrame and swing transform at explicit times', () => {
    const source = createM02PatchSource({ bpm: 120, pulseWidth: 0.4, swing: 0.3, division: 4, multiplication: 2 }, 1000);
    for (const observedAt of [1000, 1125, 1499, 1500, 1700, 1999, 2000]) {
      const elapsed = Math.max(0, observedAt - source.startedAtMs);
      const base = periodMs(source.controls.bpm);
      const beat = Math.floor(elapsed / base);
      const local = elapsed - beat * base;
      const adjusted = beat * base + Math.min(local, swungInterval(base, source.controls.swing, beat));
      const accepted = clockFrame(adjusted, source.controls.bpm, source.controls.pulseWidth, source.controls.division, source.controls.multiplication);
      expect(m02OutputLevelsAt(source, observedAt)).toEqual({
        clock: accepted.trigger,
        gate: accepted.gate,
        trigger: accepted.trigger,
        divided: accepted.divided,
        multiplied: accepted.multiplied,
        beat: accepted.beat,
      });
    }
  });

  it('preserves a short trigger edge crossed entirely between observation endpoints', () => {
    const source = createM02PatchSource({ bpm: 120 }, 0);
    const window = m02EventsBetween(source, 450, 550);
    expect(window.events).toContainEqual({
      sourceEndpointId: 'clock-and-trigger:trigger',
      signalType: 'trigger',
      edge: 'rising',
      level: 5,
      occurredAt: 500,
    });
    expect(window.levelsAtEnd.trigger).toBe(false);
  });

  it('emits the accepted gate rise and fall rather than reducing the gate to one event', () => {
    const source = createM02PatchSource({ bpm: 120, pulseWidth: 0.5 }, 0);
    const window = m02EventsBetween(source, -1, 300);
    const gateEvents = window.events.filter((event) => event.sourceEndpointId === 'clock-and-trigger:gate');
    expect(gateEvents).toEqual([
      { sourceEndpointId: 'clock-and-trigger:gate', signalType: 'gate', edge: 'rising', level: 5, occurredAt: 0 },
      { sourceEndpointId: 'clock-and-trigger:gate', signalType: 'gate', edge: 'falling', level: 0, occurredAt: 250 },
    ]);
  });

  it('emits every multiplied pulse edge even when the observation window is much wider than a pulse', () => {
    const source = createM02PatchSource({ bpm: 120, multiplication: 4 }, 0);
    const window = m02EventsBetween(source, -1, 499);
    const rising = window.events.filter((event) =>
      event.sourceEndpointId === 'clock-and-trigger:multiplied' && event.edge === 'rising');
    expect(rising.map((event) => event.occurredAt)).toEqual([0, 125, 250, 375]);
  });

  it('emits the accepted divided clock only on the configured base beats', () => {
    const source = createM02PatchSource({ bpm: 120, division: 2 }, 0);
    const window = m02EventsBetween(source, -1, 1100);
    const rising = window.events.filter((event) =>
      event.sourceEndpointId === 'clock-and-trigger:divided' && event.edge === 'rising');
    expect(rising.map((event) => event.occurredAt)).toEqual([0, 1000]);
  });

  it('publishes crossed trigger edges through a real cable even when endpoint levels are low', () => {
    const patch = connectPorts(createPatchState(), 'clock-and-trigger:trigger', 'envelope:trigger');
    expect(patch.status).toBe('connected');
    const source = createM02PatchSource({ bpm: 120 }, 0);
    const published = publishM02EventWindow(createLiveEventRuntime(), patch.state, source, 450, 550);
    expect(published.levelsAtEnd.trigger).toBe(false);
    const envelopeEvents = recentDeliveredEvents(published.runtime, 'envelope:trigger');
    expect(envelopeEvents.some((event) => event.edge === 'rising' && event.occurredAt === 500)).toBe(true);
  });

  it('stops future M02 event delivery immediately after the real cable is removed', () => {
    const patch = connectPorts(createPatchState(), 'clock-and-trigger:trigger', 'envelope:trigger');
    if (patch.status !== 'connected' || !patch.connection) throw new Error('Expected trigger cable.');
    const source = createM02PatchSource({ bpm: 120 }, 0);
    const first = publishM02EventWindow(createLiveEventRuntime(), patch.state, source, 450, 550);
    const disconnected = disconnectPort(patch.state, patch.connection.id);
    const second = publishM02EventWindow(first.runtime, disconnected.state, source, 950, 1050);
    expect(second.deliveries).toHaveLength(0);
    expect(recentDeliveredEvents(second.runtime, 'envelope:trigger').filter((event) => event.edge === 'rising')).toHaveLength(1);
  });

  it('resets the accepted shared timing origin on control change and explicit reset', () => {
    const source = createM02PatchSource({ bpm: 120 }, 0);
    const changed = updateM02PatchSource(source, { bpm: 90 }, 1000);
    expect(changed.startedAtMs).toBe(1000);
    expect(changed.controls.bpm).toBe(90);
    expect(m02EventsBetween(changed, 999, 1001).events.some((event) =>
      event.sourceEndpointId === 'clock-and-trigger:trigger' && event.edge === 'rising')).toBe(true);

    const reset = resetM02PatchSource(changed, 2500);
    expect(reset.startedAtMs).toBe(2500);
    expect(reset.controls).toEqual(changed.controls);
    expect(m02EventsBetween(reset, 2499, 2501).events.some((event) =>
      event.sourceEndpointId === 'clock-and-trigger:clock' && event.edge === 'rising')).toBe(true);
  });

  it('rejects reversed or non-finite observation windows', () => {
    const source = createM02PatchSource({}, 0);
    expect(() => m02EventsBetween(source, 10, 9)).toThrow(/end at or after/i);
    expect(() => m02EventsBetween(source, Number.NaN, 10)).toThrow(/finite/i);
  });
});
