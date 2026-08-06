export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;

export type ScaleName = 'chromatic' | 'major' | 'minor' | 'majorPentatonic' | 'minorPentatonic';

export const SCALE_INTERVALS: Record<ScaleName, readonly number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
};

export const SCALE_LABELS: Record<ScaleName, string> = {
  chromatic: 'Chromatic',
  major: 'Major',
  minor: 'Natural minor',
  majorPentatonic: 'Major pentatonic',
  minorPentatonic: 'Minor pentatonic',
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalisePitchClass(semitone: number) {
  return ((semitone % 12) + 12) % 12;
}

export function allowedPitchClasses(root: number, scale: ScaleName) {
  const rootClass = normalisePitchClass(root);
  return SCALE_INTERVALS[scale].map((interval) => normalisePitchClass(rootClass + interval));
}

export function isAllowedSemitone(semitone: number, root: number, scale: ScaleName) {
  return allowedPitchClasses(root, scale).includes(normalisePitchClass(semitone));
}

export function quantizeSemitone(inputSemitone: number, root: number, scale: ScaleName) {
  const centre = Math.round(inputSemitone);
  let best = centre;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let candidate = centre - 24; candidate <= centre + 24; candidate += 1) {
    if (!isAllowedSemitone(candidate, root, scale)) continue;
    const distance = Math.abs(candidate - inputSemitone);
    if (distance < bestDistance - Number.EPSILON || (Math.abs(distance - bestDistance) <= Number.EPSILON && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

export function quantizeVoltage(inputVolts: number, root: number, scale: ScaleName) {
  return quantizeSemitone(inputVolts * 12, root, scale) / 12;
}

export function semitoneVoltage() {
  return 1 / 12;
}

export function voltageToFrequency(volts: number, referenceFrequency = 261.625565) {
  return referenceFrequency * 2 ** volts;
}

export function noteNameFromSemitone(semitone: number) {
  const rounded = Math.round(semitone);
  const note = NOTE_NAMES[normalisePitchClass(rounded)];
  const octave = 4 + Math.floor(rounded / 12);
  return `${note}${octave}`;
}

export function noteNameFromVoltage(volts: number) {
  return noteNameFromSemitone(volts * 12);
}

export function correctionCents(inputVolts: number, outputVolts: number) {
  return (outputVolts - inputVolts) * 1200;
}

export function triggerHeldVoltage(
  inputVolts: number,
  previousOutputVolts: number,
  triggered: boolean,
  root: number,
  scale: ScaleName,
) {
  return triggered ? quantizeVoltage(inputVolts, root, scale) : previousOutputVolts;
}

export function sweepVoltage(
  timeSeconds: number,
  minimumVolts: number,
  maximumVolts: number,
  cyclesPerSecond: number,
) {
  const phase = ((timeSeconds * cyclesPerSecond) % 1 + 1) % 1;
  const triangle = 1 - Math.abs(phase * 2 - 1);
  return minimumVolts + triangle * (maximumVolts - minimumVolts);
}
