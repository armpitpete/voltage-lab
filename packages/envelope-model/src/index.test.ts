import { describe, expect, it } from 'vitest';
import {
  advanceEnvelope,
  envelopeDestinationValue,
  gateEnvelopeOff,
  gateEnvelopeOn,
  idleEnvelope,
  repeatingGateState,
  sustainVoltage,
  type EnvelopeSettings,
} from './index';

const settings: EnvelopeSettings = {
  attackMs: 100,
  decayMs: 200,
  sustainLevel: 0.4,
  releaseMs: 300,
  peakVoltage: 5,
};

describe('ADSR envelope', () => {
  it('reaches the 5 V peak at the configured attack time', () => {
    const state = gateEnvelopeOn(idleEnvelope(), settings, 0);
    const snapshot = advanceEnvelope(state, settings, 100);
    expect(snapshot.stage).toBe('decay');
    expect(snapshot.voltage).toBeCloseTo(5, 8);
  });

  it('reaches the configured sustain voltage after decay', () => {
    const state = gateEnvelopeOn(idleEnvelope(), settings, 0);
    const snapshot = advanceEnvelope(state, settings, 300);
    expect(snapshot.stage).toBe('sustain');
    expect(snapshot.voltage).toBeCloseTo(sustainVoltage(settings), 8);
    expect(snapshot.voltage).toBeCloseTo(2, 8);
  });

  it('holds the sustain voltage while the gate stays high', () => {
    const state = gateEnvelopeOn(idleEnvelope(), settings, 0);
    const snapshot = advanceEnvelope(state, settings, 5000);
    expect(snapshot.stage).toBe('sustain');
    expect(snapshot.gate).toBe(true);
    expect(snapshot.voltage).toBeCloseTo(2, 8);
  });

  it('releases from the current voltage and reaches zero at release time', () => {
    const high = gateEnvelopeOn(idleEnvelope(), settings, 0);
    const released = gateEnvelopeOff(high, settings, 300);
    expect(released.stageStartVoltage).toBeCloseTo(2, 8);
    expect(advanceEnvelope(released, settings, 450).voltage).toBeCloseTo(1, 8);
    const finished = advanceEnvelope(released, settings, 600);
    expect(finished.stage).toBe('idle');
    expect(finished.voltage).toBe(0);
  });

  it('supports an early gate release during attack without a jump', () => {
    const high = gateEnvelopeOn(idleEnvelope(), settings, 0);
    const beforeRelease = advanceEnvelope(high, settings, 50);
    const released = gateEnvelopeOff(high, settings, 50);
    const afterRelease = advanceEnvelope(released, settings, 50);
    expect(beforeRelease.voltage).toBeCloseTo(2.5, 8);
    expect(afterRelease.voltage).toBeCloseTo(beforeRelease.voltage, 8);
  });

  it('retriggers from the current release voltage without a jump', () => {
    const high = gateEnvelopeOn(idleEnvelope(), settings, 0);
    const released = gateEnvelopeOff(high, settings, 300);
    const beforeRetrigger = advanceEnvelope(released, settings, 450);
    const retriggered = gateEnvelopeOn(released, settings, 450);
    const afterRetrigger = advanceEnvelope(retriggered, settings, 450);
    expect(afterRetrigger.stage).toBe('attack');
    expect(afterRetrigger.voltage).toBeCloseTo(beforeRetrigger.voltage, 8);
  });
});

describe('gate and destination helpers', () => {
  it('creates deterministic repeating gates', () => {
    expect(repeatingGateState(0, 120, 25)).toBe(true);
    expect(repeatingGateState(124, 120, 25)).toBe(true);
    expect(repeatingGateState(125, 120, 25)).toBe(false);
    expect(repeatingGateState(499, 120, 25)).toBe(false);
    expect(repeatingGateState(500, 120, 25)).toBe(true);
  });

  it('maps 0–5 V to useful destination ranges', () => {
    expect(envelopeDestinationValue(0, 'amplitude')).toBe(0);
    expect(envelopeDestinationValue(5, 'amplitude')).toBe(1);
    expect(envelopeDestinationValue(0, 'filter')).toBe(120);
    expect(envelopeDestinationValue(5, 'filter')).toBe(8000);
    expect(envelopeDestinationValue(5, 'pitch', 1)).toBe(2);
  });
});
