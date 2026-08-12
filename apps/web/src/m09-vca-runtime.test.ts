import { describe, expect, it } from 'vitest';
import { effectivePatchVcaCv } from './m09-vca-runtime';

describe('Patch Canvas M09 → VCA modulation', () => {
  it('leaves the base VCA CV unchanged without a real cable', () => {
    expect(effectivePatchVcaCv({ baseCv: 2.5, modulationCv: 5, attenuverter: 1, connected: false })).toBe(2.5);
  });

  it('uses the accepted visible attenuverter rule when connected', () => {
    expect(effectivePatchVcaCv({ baseCv: 2.5, modulationCv: 2, attenuverter: 0.5, connected: true })).toBe(3.5);
    expect(effectivePatchVcaCv({ baseCv: 2.5, modulationCv: 2, attenuverter: -0.5, connected: true })).toBe(1.5);
  });

  it('keeps the effective VCA CV inside the accepted 0–5 V range', () => {
    expect(effectivePatchVcaCv({ baseCv: 5, modulationCv: 5, attenuverter: 1, connected: true })).toBe(5);
    expect(effectivePatchVcaCv({ baseCv: 0, modulationCv: 5, attenuverter: -1, connected: true })).toBe(0);
  });
});
