import {
  isAllowedSemitone,
  noteNameFromVoltage,
  quantizeVoltage,
  voltageToFrequency,
  type ScaleName,
} from '../../quantizer-model/src/index';

export const PATCH_STEP_COUNT = 8;

export type PatchStep = {
  voltage: number;
  gate: boolean;
};

export type PatchSettings = {
  bpm: number;
  stepsPerBeat: number;
  gatePercent: number;
  root: number;
  scale: ScaleName;
  octaveOffset: number;
  tuningCents: number;
};

export type PatchStepSnapshot = {
  index: number;
  rawVoltage: number;
  quantizedVoltage: number;
  oscillatorVoltage: number;
  note: string;
  frequencyHz: number;
  stepActive: boolean;
  gateHigh: boolean;
  stepElapsedMs: number;
  stepDurationMs: number;
};

export type SequencePresetName = 'ascending' | 'minorPulse' | 'octaveRests';

export const SEQUENCE_PRESETS: Record<SequencePresetName, readonly PatchStep[]> = {
  ascending: [
    { voltage: 0, gate: true },
    { voltage: 0.16, gate: true },
    { voltage: 0.33, gate: true },
    { voltage: 0.42, gate: true },
    { voltage: 0.58, gate: true },
    { voltage: 0.75, gate: true },
    { voltage: 0.92, gate: true },
    { voltage: 1, gate: true },
  ],
  minorPulse: [
    { voltage: 0, gate: true },
    { voltage: 0.25, gate: true },
    { voltage: 0.58, gate: false },
    { voltage: 0.25, gate: true },
    { voltage: 0.83, gate: true },
    { voltage: 0.58, gate: false },
    { voltage: 0.25, gate: true },
    { voltage: 0, gate: true },
  ],
  octaveRests: [
    { voltage: -0.5, gate: true },
    { voltage: 0, gate: false },
    { voltage: 0.5, gate: true },
    { voltage: 0, gate: false },
    { voltage: 1, gate: true },
    { voltage: 0, gate: false },
    { voltage: 1.5, gate: true },
    { voltage: 0, gate: false },
  ],
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalisePatchSettings(settings: PatchSettings): PatchSettings {
  return {
    bpm: clamp(settings.bpm, 20, 300),
    stepsPerBeat: clamp(settings.stepsPerBeat, 0.25, 8),
    gatePercent: clamp(settings.gatePercent, 1, 99),
    root: Math.round(settings.root),
    scale: settings.scale,
    octaveOffset: clamp(Math.round(settings.octaveOffset), -4, 4),
    tuningCents: clamp(settings.tuningCents, -100, 100),
  };
}

export function normaliseSequence(sequence: readonly PatchStep[]) {
  return Array.from({ length: PATCH_STEP_COUNT }, (_, index) => {
    const step = sequence[index] ?? { voltage: 0, gate: false };
    return {
      voltage: clamp(step.voltage, -2, 4),
      gate: Boolean(step.gate),
    };
  });
}

export function clonePreset(name: SequencePresetName) {
  return normaliseSequence(SEQUENCE_PRESETS[name]);
}

export function patchStepDurationMs(bpm: number, stepsPerBeat: number) {
  const safeBpm = Math.max(1, bpm);
  const safeStepsPerBeat = Math.max(0.01, stepsPerBeat);
  return 60000 / safeBpm / safeStepsPerBeat;
}

export function transportStepIndex(
  running: boolean,
  heldIndex: number,
  startedAtMs: number,
  nowMs: number,
  bpm: number,
  stepsPerBeat: number,
  stepCount = PATCH_STEP_COUNT,
) {
  const safeCount = Math.max(1, Math.floor(stepCount));
  const safeHeld = ((Math.floor(heldIndex) % safeCount) + safeCount) % safeCount;
  if (!running) return safeHeld;
  const elapsed = Math.max(0, nowMs - startedAtMs);
  return (safeHeld + Math.floor(elapsed / patchStepDurationMs(bpm, stepsPerBeat))) % safeCount;
}

export function transportStepElapsedMs(
  running: boolean,
  startedAtMs: number,
  nowMs: number,
  bpm: number,
  stepsPerBeat: number,
) {
  if (!running) return 0;
  const duration = patchStepDurationMs(bpm, stepsPerBeat);
  return Math.max(0, nowMs - startedAtMs) % duration;
}

export function nextPatchStep(index: number, stepCount = PATCH_STEP_COUNT) {
  const safeCount = Math.max(1, Math.floor(stepCount));
  return (((Math.floor(index) + 1) % safeCount) + safeCount) % safeCount;
}

export function patchGateHigh(stepActive: boolean, stepElapsedMs: number, stepDurationMs: number, gatePercent: number) {
  if (!stepActive) return false;
  const highDuration = Math.max(0, stepDurationMs) * clamp(gatePercent, 1, 99) / 100;
  return Math.max(0, stepElapsedMs) < highDuration;
}

export function patchStepSnapshot(
  sequence: readonly PatchStep[],
  index: number,
  settings: PatchSettings,
  stepElapsedMs = 0,
): PatchStepSnapshot {
  const normalisedSettings = normalisePatchSettings(settings);
  const normalisedSequence = normaliseSequence(sequence);
  const safeIndex = ((Math.floor(index) % normalisedSequence.length) + normalisedSequence.length) % normalisedSequence.length;
  const step = normalisedSequence[safeIndex];
  const quantizedVoltage = quantizeVoltage(step.voltage, normalisedSettings.root, normalisedSettings.scale);
  const oscillatorVoltage = quantizedVoltage + normalisedSettings.octaveOffset + normalisedSettings.tuningCents / 1200;
  const duration = patchStepDurationMs(normalisedSettings.bpm, normalisedSettings.stepsPerBeat);

  return {
    index: safeIndex,
    rawVoltage: step.voltage,
    quantizedVoltage,
    oscillatorVoltage,
    note: noteNameFromVoltage(quantizedVoltage),
    frequencyHz: voltageToFrequency(oscillatorVoltage),
    stepActive: step.gate,
    gateHigh: patchGateHigh(step.gate, stepElapsedMs, duration, normalisedSettings.gatePercent),
    stepElapsedMs: Math.max(0, stepElapsedMs),
    stepDurationMs: duration,
  };
}

export function patchSnapshotAt(
  sequence: readonly PatchStep[],
  running: boolean,
  heldIndex: number,
  startedAtMs: number,
  nowMs: number,
  settings: PatchSettings,
) {
  const index = transportStepIndex(
    running,
    heldIndex,
    startedAtMs,
    nowMs,
    settings.bpm,
    settings.stepsPerBeat,
    sequence.length || PATCH_STEP_COUNT,
  );
  const elapsed = transportStepElapsedMs(running, startedAtMs, nowMs, settings.bpm, settings.stepsPerBeat);
  return patchStepSnapshot(sequence, index, settings, elapsed);
}

export function snapshotBelongsToScale(snapshot: PatchStepSnapshot, root: number, scale: ScaleName) {
  return isAllowedSemitone(Math.round(snapshot.quantizedVoltage * 12), root, scale);
}
