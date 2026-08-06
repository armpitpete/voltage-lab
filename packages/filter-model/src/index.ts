export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export type LfoShape = 'sine' | 'triangle' | 'square';
export type SourceWaveform = 'sine' | 'sawtooth' | 'square' | 'triangle';

export type CutoffSources = {
  baseCutoffHz: number;
  cutoffCv: number;
  modulationCv: number;
  modulationAmount: number;
  lfoCv: number;
  envelopeCv: number;
  minimumHz?: number;
  maximumHz?: number;
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function cutoffFromVoltage(
  baseCutoffHz: number,
  voltage: number,
  minimumHz = 20,
  maximumHz = 20000,
) {
  const safeBase = Math.max(0.001, baseCutoffHz);
  return clamp(safeBase * 2 ** voltage, minimumHz, maximumHz);
}

export function cutoffVoltageFromFrequency(frequencyHz: number, referenceHz: number) {
  return Math.log2(Math.max(0.001, frequencyHz) / Math.max(0.001, referenceHz));
}

export function cutoffFromSources(sources: CutoffSources) {
  const modulation = clamp(sources.modulationAmount, -1, 1)
    * (sources.modulationCv + sources.lfoCv + sources.envelopeCv);
  return cutoffFromVoltage(
    sources.baseCutoffHz,
    sources.cutoffCv + modulation,
    sources.minimumHz ?? 20,
    sources.maximumHz ?? 20000,
  );
}

export function filterMagnitude(
  type: FilterType,
  frequencyHz: number,
  cutoffHz: number,
  resonanceQ: number,
) {
  const frequency = Math.max(0.001, frequencyHz);
  const cutoff = Math.max(0.001, cutoffHz);
  const q = clamp(resonanceQ, 0.1, 40);
  const ratio = frequency / cutoff;
  const denominator = Math.sqrt((1 - ratio ** 2) ** 2 + (ratio / q) ** 2);

  if (type === 'lowpass') return 1 / denominator;
  if (type === 'highpass') return ratio ** 2 / denominator;
  if (type === 'bandpass') return (ratio / q) / denominator;
  return Math.abs(1 - ratio ** 2) / denominator;
}

export function magnitudeToDb(magnitude: number, floorDb = -72) {
  return Math.max(floorDb, 20 * Math.log10(Math.max(1e-8, magnitude)));
}

export function filterResponseDb(
  type: FilterType,
  frequencyHz: number,
  cutoffHz: number,
  resonanceQ: number,
  floorDb = -72,
) {
  return magnitudeToDb(filterMagnitude(type, frequencyHz, cutoffHz, resonanceQ), floorDb);
}

export function lfoValue(shape: LfoShape, phaseCycles: number) {
  const phase = ((phaseCycles % 1) + 1) % 1;
  if (shape === 'sine') return Math.sin(phase * Math.PI * 2);
  if (shape === 'triangle') return 1 - 4 * Math.abs(phase - 0.5);
  return phase < 0.5 ? 1 : -1;
}

export function logarithmicFrequency(position: number, minimumHz = 20, maximumHz = 20000) {
  const normalised = clamp(position, 0, 1);
  return minimumHz * (maximumHz / minimumHz) ** normalised;
}

export function logarithmicPosition(frequencyHz: number, minimumHz = 20, maximumHz = 20000) {
  const frequency = clamp(frequencyHz, minimumHz, maximumHz);
  return Math.log(frequency / minimumHz) / Math.log(maximumHz / minimumHz);
}

export function harmonicAmplitude(waveform: SourceWaveform, harmonic: number) {
  const index = Math.max(1, Math.floor(harmonic));
  if (waveform === 'sine') return index === 1 ? 1 : 0;
  if (waveform === 'sawtooth') return 1 / index;
  if (waveform === 'square') return index % 2 === 1 ? 1 / index : 0;
  return index % 2 === 1 ? 1 / index ** 2 : 0;
}

export function filteredHarmonicAmplitude(
  waveform: SourceWaveform,
  harmonic: number,
  fundamentalHz: number,
  type: FilterType,
  cutoffHz: number,
  resonanceQ: number,
) {
  return harmonicAmplitude(waveform, harmonic)
    * filterMagnitude(type, fundamentalHz * Math.max(1, Math.floor(harmonic)), cutoffHz, resonanceQ);
}

export function formatFrequency(frequencyHz: number) {
  return frequencyHz >= 1000
    ? `${(frequencyHz / 1000).toFixed(frequencyHz >= 10000 ? 1 : 2)} kHz`
    : `${frequencyHz.toFixed(frequencyHz >= 100 ? 0 : 1)} Hz`;
}
