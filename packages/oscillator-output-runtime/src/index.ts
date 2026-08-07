export const OSCILLATOR_OUTPUT_RUNTIME_VERSION = '1.0' as const;

export type OscillatorOutputWaveform = 'sine' | 'triangle' | 'saw' | 'square' | 'pulse';

export type OscillatorOutputSnapshot = {
  version: typeof OSCILLATOR_OUTPUT_RUNTIME_VERSION;
  waveform: OscillatorOutputWaveform;
  frequencyHz: number;
  amplitudeVolts: number;
  pulseWidth: number;
  observedAt: number;
};

let latest: OscillatorOutputSnapshot | undefined;

function finiteInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

/** Publishes Module 03's current declared waveform configuration without starting audio. */
export function publishOscillatorOutput(snapshot: Omit<OscillatorOutputSnapshot, 'version'>): OscillatorOutputSnapshot {
  if (!finiteInRange(snapshot.frequencyHz, 20, 18000)) throw new Error('Oscillator frequency must be 20 to 18000 Hz.');
  if (!finiteInRange(snapshot.amplitudeVolts, 0, 5)) throw new Error('Oscillator amplitude must be 0 to 5 V peak.');
  if (!finiteInRange(snapshot.pulseWidth, 0.05, 0.95)) throw new Error('Oscillator pulse width must be 5% to 95%.');
  if (!Number.isFinite(snapshot.observedAt)) throw new Error('Oscillator observation time must be finite.');
  latest = { version: OSCILLATOR_OUTPUT_RUNTIME_VERSION, ...snapshot };
  return latest;
}

/** The latest state published by Module 03; undefined means the source has not been opened yet. */
export function readOscillatorOutput(): OscillatorOutputSnapshot | undefined {
  return latest;
}

/** Test-only reset; production code has no hidden default oscillator source. */
export function resetOscillatorOutputForTest(): void {
  latest = undefined;
}
