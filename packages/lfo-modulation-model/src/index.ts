export type LfoShape = 'sine' | 'triangle' | 'square' | 'saw-up' | 'saw-down' | 'stepped-random';

export type LfoVoltageSettings = {
  shape: LfoShape;
  phaseCycles: number;
  amplitudeVoltage: number;
  offsetVoltage: number;
  minimumVoltage?: number;
  maximumVoltage?: number;
  seed?: number;
};

export type DestinationAmounts = {
  pitch: number;
  cutoff: number;
  gain: number;
  pan: number;
};

export type DestinationBases = {
  oscillatorHz: number;
  cutoffHz: number;
  gain: number;
  pan: number;
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function wrapPhase(phaseCycles: number) {
  return ((phaseCycles % 1) + 1) % 1;
}

export function degreesToCycles(degrees: number) {
  return degrees / 360;
}

export function cycleDurationMs(rateHz: number) {
  return rateHz <= 0 ? Number.POSITIVE_INFINITY : 1000 / rateHz;
}

export function phaseAtTime(timeMs: number, rateHz: number, phaseDegrees = 0, originMs = 0) {
  const elapsedSeconds = Math.max(0, timeMs - originMs) / 1000;
  return elapsedSeconds * Math.max(0, rateHz) + degreesToCycles(phaseDegrees);
}

function deterministicStep(cycleIndex: number, seed: number) {
  let value = (Math.floor(cycleIndex) | 0) ^ (Math.floor(seed) | 0) ^ 0x9e3779b9;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff * 2 - 1;
}

export function lfoWave(shape: LfoShape, phaseCycles: number, seed = 1) {
  const phase = wrapPhase(phaseCycles);
  if (shape === 'sine') return Math.sin(phase * Math.PI * 2);
  if (shape === 'triangle') return 1 - 4 * Math.abs(phase - 0.5);
  if (shape === 'square') return phase < 0.5 ? 1 : -1;
  if (shape === 'saw-up') return phase * 2 - 1;
  if (shape === 'saw-down') return 1 - phase * 2;
  return deterministicStep(Math.floor(phaseCycles), seed);
}

export function lfoVoltage(settings: LfoVoltageSettings) {
  const minimum = settings.minimumVoltage ?? -5;
  const maximum = settings.maximumVoltage ?? 5;
  const waveform = lfoWave(settings.shape, settings.phaseCycles, settings.seed ?? 1);
  const rawVoltage = settings.offsetVoltage + Math.max(0, settings.amplitudeVoltage) * waveform;
  const voltage = clamp(rawVoltage, minimum, maximum);
  return {
    waveform,
    rawVoltage,
    voltage,
    clipped: voltage !== rawVoltage,
  };
}

export function routeVoltage(
  sourceVoltage: number,
  amount: number,
  biasVoltage = 0,
  minimumVoltage = -5,
  maximumVoltage = 5,
) {
  const normalisedAmount = clamp(amount, -1, 1);
  const rawVoltage = biasVoltage + sourceVoltage * normalisedAmount;
  return {
    amount: normalisedAmount,
    rawVoltage,
    voltage: clamp(rawVoltage, minimumVoltage, maximumVoltage),
  };
}

export function oscillatorFrequency(baseFrequencyHz: number, pitchCv: number) {
  return clamp(Math.max(0.001, baseFrequencyHz) * 2 ** pitchCv, 20, 20000);
}

export function filterCutoff(baseCutoffHz: number, cutoffCv: number) {
  return clamp(Math.max(0.001, baseCutoffHz) * 2 ** cutoffCv, 20, 20000);
}

export function gainFromModulation(baseGain: number, modulationCv: number) {
  return clamp(baseGain + modulationCv / 5, 0, 1);
}

export function panFromModulation(basePan: number, modulationCv: number) {
  return clamp(basePan + modulationCv / 5, -1, 1);
}

export function destinationState(
  sourceVoltage: number,
  amounts: DestinationAmounts,
  bases: DestinationBases,
) {
  const pitch = routeVoltage(sourceVoltage, amounts.pitch);
  const cutoff = routeVoltage(sourceVoltage, amounts.cutoff);
  const gain = routeVoltage(sourceVoltage, amounts.gain);
  const pan = routeVoltage(sourceVoltage, amounts.pan);
  return {
    pitchCv: pitch.voltage,
    pitchSemitones: pitch.voltage * 12,
    oscillatorHz: oscillatorFrequency(bases.oscillatorHz, pitch.voltage),
    cutoffCv: cutoff.voltage,
    cutoffHz: filterCutoff(bases.cutoffHz, cutoff.voltage),
    gainCv: gain.voltage,
    gain: gainFromModulation(bases.gain, gain.voltage),
    panCv: pan.voltage,
    pan: panFromModulation(bases.pan, pan.voltage),
  };
}

export function formatFrequency(frequencyHz: number) {
  return frequencyHz >= 1000
    ? `${(frequencyHz / 1000).toFixed(frequencyHz >= 10000 ? 1 : 2)} kHz`
    : `${frequencyHz.toFixed(frequencyHz >= 100 ? 0 : 1)} Hz`;
}
