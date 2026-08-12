import type { OscillatorOutputSnapshot } from '../../oscillator-output-runtime/src/index';

export const BROWSER_AUDIO_BOUNDARY_VERSION = '1.0' as const;

export type BrowserAudioSource = {
  version: typeof BROWSER_AUDIO_BOUNDARY_VERSION;
  waveform: OscillatorOutputSnapshot['waveform'];
  frequencyHz: number;
  pulseWidth: number;
  sourcePeakVolts: number;
  normalisedPeak: number;
  observedAt: number;
};

/**
 * The only permitted ±10 V conceptual-waveform to -1…1 browser-audio conversion.
 * It converts a declared peak level explicitly; it never clips an unknown source.
 */
export function createBrowserAudioSource(source: OscillatorOutputSnapshot): BrowserAudioSource {
  return {
    version: BROWSER_AUDIO_BOUNDARY_VERSION,
    waveform: source.waveform,
    frequencyHz: source.frequencyHz,
    pulseWidth: source.pulseWidth,
    sourcePeakVolts: source.amplitudeVolts,
    normalisedPeak: source.amplitudeVolts / 10,
    observedAt: source.observedAt,
  };
}
