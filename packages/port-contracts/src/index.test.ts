import { describe, expect, it } from 'vitest';
import { voltageLabModules } from '../../module-interface/src/modules';
import {
  PORT_CONTRACTS,
  ALL_PORT_CONTRACTS,
  BROWSER_AUDIO_BOUNDARY_PORTS,
  PORT_CONTRACT_VERSION,
  evaluatePortCompatibility,
  findPortContract,
  validatePortContracts,
} from './index';

const port = (moduleId: string, portId: string) => {
  const contract = findPortContract(moduleId, portId);
  if (!contract) throw new Error(`missing test port ${moduleId}:${portId}`);
  return contract;
};

describe('Voltage Lab Module Port Contracts v1.0', () => {
  it('creates one stable contract for every declared socket in the nine accepted modules', () => {
    const declaredCount = voltageLabModules.reduce(
      (count, module) => count + module.inputs.length + module.outputs.length,
      0,
    );
    expect(PORT_CONTRACTS).toHaveLength(declaredCount);
    expect(new Set(PORT_CONTRACTS.map((contract) => contract.endpointId)).size).toBe(declaredCount);
    expect(ALL_PORT_CONTRACTS).toHaveLength(declaredCount + BROWSER_AUDIO_BOUNDARY_PORTS.length);
    expect(PORT_CONTRACTS.every((contract) => contract.version === PORT_CONTRACT_VERSION)).toBe(true);
    expect(validatePortContracts()).toEqual([]);
  });

  it('accepts a direct same-signal patch when the source fits the destination range', () => {
    expect(evaluatePortCompatibility(port('envelope', 'envelope'), port('vca-mixer', 'vca-cv'))).toMatchObject({
      compatible: true,
      level: 'direct',
      semantic: 'same-signal',
      adaptation: 'none',
    });
  });

  it('keeps timing meanings distinct while allowing explicit event conversions', () => {
    expect(evaluatePortCompatibility(port('clock-and-trigger', 'clock'), port('envelope', 'trigger'))).toMatchObject({
      compatible: true,
      level: 'direct',
      semantic: 'event-conversion',
      adaptation: 'none',
    });
  });

  it('requires visible range handling when a source can exceed the destination range', () => {
    expect(evaluatePortCompatibility(port('lfo-modulation', 'pitch'), port('oscillator', 'pitch'))).toMatchObject({
      compatible: true,
      level: 'adaptation-required',
      semantic: 'same-signal',
      adaptation: 'range',
    });
  });

  it('requires an explicit representation boundary for conceptual oscillator volts into browser audio', () => {
    expect(evaluatePortCompatibility(port('oscillator', 'waveform'), port('filter', 'audio'))).toMatchObject({
      compatible: true,
      level: 'adaptation-required',
      semantic: 'same-signal',
      adaptation: 'representation',
    });
  });

  it('offers only the declared browser-audio boundary as a direct bridge for oscillator audio', () => {
    expect(evaluatePortCompatibility(port('oscillator', 'waveform'), port('browser-audio-boundary', 'oscillator-input'))).toMatchObject({ level: 'direct', adaptation: 'none' });
    expect(evaluatePortCompatibility(port('browser-audio-boundary', 'normalised-output'), port('filter', 'audio'))).toMatchObject({ level: 'direct', adaptation: 'none' });
  });

  it('rejects incompatible signal meanings and wrong direction', () => {
    expect(evaluatePortCompatibility(port('envelope', 'envelope'), port('filter', 'audio')).compatible).toBe(false);
    expect(evaluatePortCompatibility(port('filter', 'audio'), port('oscillator', 'waveform')).compatible).toBe(false);
  });
});
