import { describe, expect, it } from 'vitest';
import { MODULE_INTERFACE_VERSION, validateModuleInterface } from './index';
import { voltageLabModules } from './modules';

describe('Voltage Lab Module Interface v1.0', () => {
  it('declares exactly the nine accepted modules in order', () => {
    expect(voltageLabModules.map((module) => module.moduleNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(voltageLabModules.every((module) => module.interfaceVersion === MODULE_INTERFACE_VERSION)).toBe(true);
    expect(voltageLabModules.every((module) => module.status === 'accepted-behaviour-preserved')).toBe(true);
  });

  it('passes deterministic interface validation', () => {
    expect(validateModuleInterface(voltageLabModules)).toEqual([]);
  });

  it('declares typed ranges for every conceptual port', () => {
    for (const module of voltageLabModules) {
      for (const port of [...module.inputs, ...module.outputs]) {
        expect(port.signalType).toMatch(/^(audio|cv|clock|gate|trigger)$/);
        expect(port.range.minimum).toBeLessThan(port.range.maximum);
      }
    }
  });

  it('keeps browser audio behind explicit start and panic/stop', () => {
    for (const module of voltageLabModules.filter((module) => module.audio.enabled)) {
      expect(module.audio.requiresExplicitStart).toBe(true);
      expect(module.audio.hasPanicStop).toBe(true);
    }
  });
});
