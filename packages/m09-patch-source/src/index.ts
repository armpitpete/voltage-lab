import type { PatchState } from '../../connection-engine/src/index';
import {
  observeLiveSignal,
  publishPeriodicSignalSource,
  sampleLiveSignalsAt,
  type LiveSignalRuntimeState,
  type PeriodicSignalSource,
  type PeriodicSignalWaveform,
} from '../../live-signal-runtime/src/index';

export const M09_PATCH_SOURCE_VERSION = '0.1' as const;

export type M09PatchSourceControls = {
  waveform: PeriodicSignalWaveform;
  rateHz: number;
  amplitudeVolts: number;
  offsetVolts: number;
  phaseDegrees: number;
  seed: number;
};

export type M09PatchSourceState = {
  version: typeof M09_PATCH_SOURCE_VERSION;
  controls: M09PatchSourceControls;
  source: PeriodicSignalSource;
};

export type M09DestinationSample = {
  runtime: LiveSignalRuntimeState;
  sourceVoltage: number | undefined;
  cutoffCv: number;
  filterConnected: boolean;
  vcaModulationCv: number | undefined;
  vcaConnected: boolean;
};

export type M09FilterCutoffSample = {
  runtime: LiveSignalRuntimeState;
  sourceVoltage: number | undefined;
  cutoffCv: number;
  connected: boolean;
};

const WAVEFORMS: readonly PeriodicSignalWaveform[] = [
  'sine', 'triangle', 'square', 'saw-up', 'saw-down', 'stepped-random',
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function normaliseSeed(value: number): number {
  return Math.round(clamp(value, 1, 32));
}

export function normaliseM09PatchSourceControls(
  controls: Partial<M09PatchSourceControls> = {},
): M09PatchSourceControls {
  return {
    waveform: WAVEFORMS.includes(controls.waveform as PeriodicSignalWaveform)
      ? controls.waveform as PeriodicSignalWaveform
      : 'sine',
    rateHz: clamp(controls.rateHz ?? 0.5, 0.05, 20),
    amplitudeVolts: clamp(controls.amplitudeVolts ?? 2.5, 0, 5),
    offsetVolts: clamp(controls.offsetVolts ?? 0, -5, 5),
    phaseDegrees: clamp(controls.phaseDegrees ?? 0, -180, 180),
    seed: normaliseSeed(controls.seed ?? 7),
  };
}

function sourceFromControls(controls: M09PatchSourceControls, phaseCycles: number, startedAtMs: number): PeriodicSignalSource {
  return {
    version: '1.0',
    kind: 'periodic',
    sourceEndpointId: 'lfo-modulation:lfo',
    signalType: 'cv',
    waveform: controls.waveform,
    frequencyHz: controls.rateHz,
    amplitude: controls.amplitudeVolts,
    offset: controls.offsetVolts,
    phaseCycles,
    startedAtMs,
    seed: controls.seed,
    outputClamp: { minimum: -5, maximum: 5 },
  };
}

/** Creates the explicit M09 source record. Nothing becomes active until it is published. */
export function createM09PatchSource(
  controls: Partial<M09PatchSourceControls>,
  startedAtMs: number,
): M09PatchSourceState {
  const normalised = normaliseM09PatchSourceControls(controls);
  return {
    version: M09_PATCH_SOURCE_VERSION,
    controls: normalised,
    source: sourceFromControls(normalised, normalised.phaseDegrees / 360, startedAtMs),
  };
}

/**
 * Updates visible M09 controls without jumping backwards in phase. The old source is
 * advanced to observedAt first, then the new controls become authoritative from that
 * same instant.
 */
export function updateM09PatchSource(
  state: M09PatchSourceState,
  controls: Partial<M09PatchSourceControls>,
  observedAt: number,
): M09PatchSourceState {
  const next = normaliseM09PatchSourceControls({ ...state.controls, ...controls });
  const elapsedSeconds = Math.max(0, observedAt - state.source.startedAtMs) / 1000;
  const currentPhase = state.source.phaseCycles + elapsedSeconds * state.source.frequencyHz;
  const explicitPhaseChanged = controls.phaseDegrees !== undefined;
  const phaseCycles = explicitPhaseChanged ? next.phaseDegrees / 360 : currentPhase;
  return {
    version: M09_PATCH_SOURCE_VERSION,
    controls: next,
    source: sourceFromControls(next, phaseCycles, observedAt),
  };
}

export function publishM09PatchSource(
  runtime: LiveSignalRuntimeState,
  patch: PatchState,
  state: M09PatchSourceState,
) {
  return publishPeriodicSignalSource(runtime, patch, state.source);
}

/**
 * Samples the one M09 source once, then reports only deliveries created by real
 * Connection Engine cables. A missing destination remains undefined rather than
 * receiving a hidden default or invented adapter.
 */
export function sampleM09Destinations(
  runtime: LiveSignalRuntimeState,
  patch: PatchState,
  observedAt: number,
  localCutoffCv: number,
): M09DestinationSample {
  const sampled = sampleLiveSignalsAt(runtime, patch, observedAt);
  const nextRuntime = sampled.state;
  const sourceVoltage = observeLiveSignal(nextRuntime, 'lfo-modulation:lfo').value;
  const filterDelivery = observeLiveSignal(nextRuntime, 'filter:cutoff').value;
  const vcaDelivery = observeLiveSignal(nextRuntime, 'vca-mixer:modulation').value;
  return {
    runtime: nextRuntime,
    sourceVoltage,
    cutoffCv: filterDelivery ?? localCutoffCv,
    filterConnected: filterDelivery !== undefined,
    vcaModulationCv: vcaDelivery,
    vcaConnected: vcaDelivery !== undefined,
  };
}

/** Backwards-compatible filter-only view used by the first accepted M09 slice. */
export function sampleM09FilterCutoff(
  runtime: LiveSignalRuntimeState,
  patch: PatchState,
  observedAt: number,
  localCutoffCv: number,
): M09FilterCutoffSample {
  const sample = sampleM09Destinations(runtime, patch, observedAt, localCutoffCv);
  return {
    runtime: sample.runtime,
    sourceVoltage: sample.sourceVoltage,
    cutoffCv: sample.cutoffCv,
    connected: sample.filterConnected,
  };
}
