import { describe, expect, it } from 'vitest';
import { voltageLabModules } from '../../module-interface/src/modules';
import {
  SIGNAL_SPECIFICATIONS,
  SIGNAL_SPEC_VERSION,
  getSignalSpecification,
  validateSignalSpecifications,
  type SignalType,
} from './index';

describe('Voltage Lab Signal Specification v1.0', () => {
  it('defines exactly the five shared signal types', () => {
    expect(Object.keys(SIGNAL_SPECIFICATIONS)).toEqual(['audio', 'cv', 'clock', 'gate', 'trigger']);
    expect(Object.values(SIGNAL_SPECIFICATIONS).every((spec) => spec.version === SIGNAL_SPEC_VERSION)).toBe(true);
    expect(validateSignalSpecifications()).toEqual([]);
  });

  it('keeps timing meanings distinct', () => {
    expect(getSignalSpecification('audio').timing.kind).toBe('continuous');
    expect(getSignalSpecification('cv').timing.kind).toBe('continuous');
    expect(getSignalSpecification('clock').timing.kind).toBe('periodic-pulse');
    expect(getSignalSpecification('gate').timing.kind).toBe('level');
    expect(getSignalSpecification('trigger').timing.kind).toBe('event-pulse');
  });

  it('keeps event signals unipolar in the 0–5 V teaching domain', () => {
    for (const type of ['clock', 'gate', 'trigger'] as const) {
      const spec = getSignalSpecification(type);
      expect(spec.polarity).toBe('unipolar');
      expect(spec.domains).toEqual([
        expect.objectContaining({ kind: 'voltage', minimum: 0, maximum: 5, unit: 'V' }),
      ]);
    }
  });

  it('covers every signal type already declared by the nine accepted modules', () => {
    const declaredTypes = new Set<SignalType>();
    for (const module of voltageLabModules) {
      for (const port of [...module.inputs, ...module.outputs]) declaredTypes.add(port.signalType);
    }
    expect([...declaredTypes].sort()).toEqual(Object.keys(SIGNAL_SPECIFICATIONS).sort());
  });

  it('keeps browser audio explicitly separate from conceptual voltage', () => {
    expect(getSignalSpecification('audio').domains).toEqual([
      expect.objectContaining({ kind: 'voltage', minimum: -10, maximum: 10, unit: 'V' }),
      expect.objectContaining({ kind: 'normalised-audio', minimum: -1, maximum: 1, unit: 'normalised' }),
    ]);
  });
});
