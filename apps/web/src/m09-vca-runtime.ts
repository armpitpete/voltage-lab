import { effectiveControlVoltage } from '../../../packages/vca-mixer-model/src/index';

export type PatchVcaModulation = {
  baseCv: number;
  modulationCv?: number;
  attenuverter: number;
  connected: boolean;
};

/**
 * Apply the accepted Module 08 VCA rule to a Patch Canvas modulation cable.
 * A missing cable contributes exactly zero modulation; the explicit attenuverter
 * remains visible and bipolar, and the accepted VCA model owns the 0–5 V clamp.
 */
export function effectivePatchVcaCv(input: PatchVcaModulation): number {
  return effectiveControlVoltage({
    biasVoltage: input.baseCv,
    modulationVoltage: input.connected ? (input.modulationCv ?? 0) : 0,
    attenuverter: input.connected ? input.attenuverter : 0,
  });
}
