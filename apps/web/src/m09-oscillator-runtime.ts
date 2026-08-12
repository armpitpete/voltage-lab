import { createBrowserAudioSource, type BrowserAudioSource } from '../../../packages/browser-audio-boundary/src/index';
import { modulatedParameters, type ModulationDestination } from '../../../packages/oscillator-model/src/index';

export type PatchOscillatorModulation = {
  baseSource: BrowserAudioSource;
  modulationCv?: number;
  destination: ModulationDestination;
  connected: boolean;
  observedAt: number;
};

/**
 * Apply Module 03's already accepted external-CV destination semantics to a Patch
 * Canvas source. The base source is never mutated. Without the real modulation cable,
 * the returned source is exactly the base oscillator configuration apart from the
 * observation timestamp.
 */
export function effectivePatchOscillatorSource(input: PatchOscillatorModulation): BrowserAudioSource {
  if (!input.connected) return { ...input.baseSource, observedAt: input.observedAt };
  const params = modulatedParameters(
    input.baseSource.frequencyHz,
    input.baseSource.pulseWidth,
    input.baseSource.sourcePeakVolts,
    input.destination,
    input.modulationCv ?? 0,
  );
  return createBrowserAudioSource({
    version: '1.0',
    waveform: input.baseSource.waveform,
    frequencyHz: params.frequencyHz,
    amplitudeVolts: params.amplitude,
    pulseWidth: params.pulseWidth,
    observedAt: input.observedAt,
  });
}
