import { describe, expect, it } from 'vitest';
import { voltageLabModules } from '../../../packages/module-interface/src/modules';
import { buildModuleMiniScopePreview } from './mini-oscilloscope';

describe('Universal Mini-Oscilloscope module coverage', () => {
  it('gives every declared module one bounded illustrative output preview', () => {
    const previews = voltageLabModules.map((module) => ({ module, preview: buildModuleMiniScopePreview(module.id) }));
    expect(previews.every(({ preview }) => preview !== undefined)).toBe(true);
    for (const { module, preview } of previews) {
      if (!preview) continue;
      expect(preview.endpointId).toBe(module.id + ':' + module.outputs[0]?.id);
      expect(preview.range).toEqual(module.outputs[0]?.range);
      expect(preview.points.every((point) => point.value >= preview.range.minimum && point.value <= preview.range.maximum)).toBe(true);
      expect(preview.mode).toBe('declared-preview');
    }
  });

  it('does not invent a live route or conceal the representation boundary', () => {
    const oscillator = buildModuleMiniScopePreview('oscillator');
    const filter = buildModuleMiniScopePreview('filter');
    expect(oscillator?.range.unit).toBe('V');
    expect(filter?.range.unit).toBe('normalised');
    expect(oscillator?.limitation).toContain('does not sample a live cable');
  });
});
