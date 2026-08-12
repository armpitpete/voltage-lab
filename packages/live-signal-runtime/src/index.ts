import {
  propagateSignals,
  type PatchState,
  type SignalDelivery,
  type SignalFrame,
} from '../../connection-engine/src/index';
import { ALL_PORT_CONTRACTS, type ModulePortContract, type PortEndpointId } from '../../port-contracts/src/index';
import type { SignalObservation } from '../../signal-inspector/src/index';

export const LIVE_SIGNAL_RUNTIME_VERSION = '2.0' as const;
export const PERIODIC_SIGNAL_SOURCE_VERSION = '1.0' as const;

export type PeriodicSignalWaveform = 'sine' | 'triangle' | 'saw' | 'square';

export type PeriodicSignalSource = {
  version: typeof PERIODIC_SIGNAL_SOURCE_VERSION;
  kind: 'periodic';
  sourceEndpointId: PortEndpointId;
  signalType: SignalFrame['signalType'];
  waveform: PeriodicSignalWaveform;
  frequencyHz: number;
  amplitude: number;
  offset: number;
  phaseCycles: number;
  startedAtMs: number;
};

export type LiveSignalRuntimeState = {
  version: typeof LIVE_SIGNAL_RUNTIME_VERSION;
  outputFrames: readonly SignalFrame[];
  deliveries: readonly SignalDelivery[];
  periodicSources: readonly PeriodicSignalSource[];
};

export type PublishSignalResult = {
  state: LiveSignalRuntimeState;
  status: 'published' | 'rejected';
  reason: string;
  deliveries: readonly SignalDelivery[];
};

export type PublishPeriodicSignalSourceResult = PublishSignalResult;

export type SampleLiveSignalsResult = {
  state: LiveSignalRuntimeState;
  status: 'sampled' | 'rejected';
  reason: string;
  deliveries: readonly SignalDelivery[];
};

const emptyState: LiveSignalRuntimeState = {
  version: LIVE_SIGNAL_RUNTIME_VERSION,
  outputFrames: [],
  deliveries: [],
  periodicSources: [],
};

function findPort(endpointId: PortEndpointId, ports: readonly ModulePortContract[]): ModulePortContract | undefined {
  return ports.find((port) => port.endpointId === endpointId);
}

function validateFrameSource(
  frame: Pick<SignalFrame, 'sourceEndpointId' | 'signalType'>,
  ports: readonly ModulePortContract[],
): { source?: ModulePortContract; reason?: string } {
  const source = findPort(frame.sourceEndpointId, ports);
  if (!source || source.direction !== 'output') {
    return { reason: 'Live signals must be published from a declared output socket.' };
  }
  if (source.signalType !== frame.signalType) {
    return { reason: `Live signal type ${frame.signalType} does not match ${source.signalType} at ${source.endpointId}.` };
  }
  return { source };
}

function wrapCycle(value: number): number {
  return ((value % 1) + 1) % 1;
}

function periodicUnitValue(waveform: PeriodicSignalWaveform, phaseCycles: number): number {
  const phase = wrapCycle(phaseCycles);
  switch (waveform) {
    case 'sine': return Math.sin(phase * Math.PI * 2);
    case 'triangle': return 1 - 4 * Math.abs(phase - 0.5);
    case 'saw': return (2 * phase) - 1;
    case 'square': return phase < 0.5 ? 1 : -1;
  }
}

function evaluatePeriodicSignalSourceUnchecked(source: PeriodicSignalSource, observedAt: number): SignalFrame {
  const elapsedSeconds = (observedAt - source.startedAtMs) / 1000;
  const phaseCycles = source.phaseCycles + elapsedSeconds * source.frequencyHz;
  return {
    sourceEndpointId: source.sourceEndpointId,
    signalType: source.signalType,
    value: source.offset + source.amplitude * periodicUnitValue(source.waveform, phaseCycles),
    observedAt,
  };
}

export function createLiveSignalRuntime(): LiveSignalRuntimeState {
  return emptyState;
}

/**
 * Evaluates one already-declared periodic source at an explicit observation time.
 * No timers, browser state or wall-clock reads are hidden in the runtime.
 */
export function evaluatePeriodicSignalSource(source: PeriodicSignalSource, observedAt: number): SignalFrame {
  if (!Number.isFinite(observedAt)) throw new Error('Periodic signal observation time must be finite.');
  return evaluatePeriodicSignalSourceUnchecked(source, observedAt);
}

/**
 * Publishes one actual output value, then derives every current direct input delivery
 * from Connection Engine's patch state. Values outside the declared source range are
 * rejected rather than silently clipped or adapted. Publishing a point value replaces
 * any time-varying source previously registered for the same output socket.
 */
export function publishSignal(
  state: LiveSignalRuntimeState,
  patch: PatchState,
  frame: SignalFrame,
  ports: readonly ModulePortContract[] = ALL_PORT_CONTRACTS,
): PublishSignalResult {
  const validation = validateFrameSource(frame, ports);
  const source = validation.source;
  if (!source) {
    return { state, status: 'rejected', reason: validation.reason ?? 'Live signal source is invalid.', deliveries: [] };
  }
  if (!Number.isFinite(frame.value) || !Number.isFinite(frame.observedAt)) {
    return { state, status: 'rejected', reason: 'Live signal values and observedAt must be finite.', deliveries: [] };
  }
  if (frame.value < source.range.minimum || frame.value > source.range.maximum) {
    return {
      state,
      status: 'rejected',
      reason: `${source.endpointId} is declared for ${source.range.minimum} to ${source.range.maximum} ${source.range.unit}; the runtime will not silently clip ${frame.value}.`,
      deliveries: [],
    };
  }

  const outputFrames = [
    ...state.outputFrames.filter((candidate) => candidate.sourceEndpointId !== frame.sourceEndpointId),
    frame,
  ];
  const periodicSources = state.periodicSources.filter((candidate) => candidate.sourceEndpointId !== frame.sourceEndpointId);
  const propagation = propagateSignals(patch, outputFrames, ports);
  return {
    state: {
      version: LIVE_SIGNAL_RUNTIME_VERSION,
      outputFrames,
      deliveries: propagation.deliveries,
      periodicSources,
    },
    status: 'published',
    reason: propagation.deliveries.length
      ? `Published ${source.label}; ${propagation.deliveries.length} live input ${propagation.deliveries.length === 1 ? 'delivery is' : 'deliveries are'} now present.`
      : `Published ${source.label}; it has no connected direct input yet.`,
    deliveries: propagation.deliveries,
  };
}

/**
 * Registers a serialisable periodic source. Its complete possible output range must fit
 * inside the declared source socket before it is accepted. The initial frame is sampled
 * at startedAtMs, and later values are produced only by explicit sampling calls.
 */
export function publishPeriodicSignalSource(
  state: LiveSignalRuntimeState,
  patch: PatchState,
  sourceProgram: PeriodicSignalSource,
  ports: readonly ModulePortContract[] = ALL_PORT_CONTRACTS,
): PublishPeriodicSignalSourceResult {
  const validation = validateFrameSource(sourceProgram, ports);
  const source = validation.source;
  if (!source) {
    return { state, status: 'rejected', reason: validation.reason ?? 'Live signal source is invalid.', deliveries: [] };
  }
  const finiteParameters = [
    sourceProgram.frequencyHz,
    sourceProgram.amplitude,
    sourceProgram.offset,
    sourceProgram.phaseCycles,
    sourceProgram.startedAtMs,
  ];
  if (!finiteParameters.every(Number.isFinite)) {
    return { state, status: 'rejected', reason: 'Periodic signal parameters must all be finite.', deliveries: [] };
  }
  if (sourceProgram.frequencyHz <= 0) {
    return { state, status: 'rejected', reason: 'Periodic signal frequencyHz must be greater than zero.', deliveries: [] };
  }
  if (sourceProgram.amplitude < 0) {
    return { state, status: 'rejected', reason: 'Periodic signal amplitude must not be negative.', deliveries: [] };
  }
  const programMinimum = sourceProgram.offset - sourceProgram.amplitude;
  const programMaximum = sourceProgram.offset + sourceProgram.amplitude;
  if (programMinimum < source.range.minimum || programMaximum > source.range.maximum) {
    return {
      state,
      status: 'rejected',
      reason: `${source.endpointId} is declared for ${source.range.minimum} to ${source.range.maximum} ${source.range.unit}; the periodic source would produce ${programMinimum} to ${programMaximum} and will not be silently clipped.`,
      deliveries: [],
    };
  }

  const periodicSources = [
    ...state.periodicSources.filter((candidate) => candidate.sourceEndpointId !== sourceProgram.sourceEndpointId),
    sourceProgram,
  ];
  const staticFrames = state.outputFrames.filter((candidate) => candidate.sourceEndpointId !== sourceProgram.sourceEndpointId);
  const initialFrame = evaluatePeriodicSignalSourceUnchecked(sourceProgram, sourceProgram.startedAtMs);
  const outputFrames = [...staticFrames, initialFrame];
  const propagation = propagateSignals(patch, outputFrames, ports);
  return {
    state: {
      version: LIVE_SIGNAL_RUNTIME_VERSION,
      outputFrames,
      deliveries: propagation.deliveries,
      periodicSources,
    },
    status: 'published',
    reason: propagation.deliveries.length
      ? `Published time-varying ${source.label}; ${propagation.deliveries.length} live input ${propagation.deliveries.length === 1 ? 'delivery is' : 'deliveries are'} present at the initial observation time.`
      : `Published time-varying ${source.label}; it has no connected direct input yet.`,
    deliveries: propagation.deliveries,
  };
}

/**
 * Deterministically samples every registered periodic source at one requested time,
 * then recomputes deliveries through the current real patch. Disconnecting a cable
 * therefore removes the destination observation on the next sample.
 */
export function sampleLiveSignalsAt(
  state: LiveSignalRuntimeState,
  patch: PatchState,
  observedAt: number,
  ports: readonly ModulePortContract[] = ALL_PORT_CONTRACTS,
): SampleLiveSignalsResult {
  if (!Number.isFinite(observedAt)) {
    return { state, status: 'rejected', reason: 'Live signal observation time must be finite.', deliveries: [] };
  }
  const sourceEndpointIds = new Set(state.periodicSources.map((source) => source.sourceEndpointId));
  const staticFrames = state.outputFrames.filter((frame) => !sourceEndpointIds.has(frame.sourceEndpointId));
  const sampledFrames = state.periodicSources.map((source) => evaluatePeriodicSignalSourceUnchecked(source, observedAt));
  const outputFrames = [...staticFrames, ...sampledFrames];
  const propagation = propagateSignals(patch, outputFrames, ports);
  return {
    state: {
      version: LIVE_SIGNAL_RUNTIME_VERSION,
      outputFrames,
      deliveries: propagation.deliveries,
      periodicSources: state.periodicSources,
    },
    status: 'sampled',
    reason: `Sampled ${state.periodicSources.length} time-varying ${state.periodicSources.length === 1 ? 'source' : 'sources'} at ${observedAt}.`,
    deliveries: propagation.deliveries,
  };
}

/** Returns an Inspector-compatible observation for either a live output or delivered input. */
export function observeLiveSignal(
  state: LiveSignalRuntimeState,
  endpointId: PortEndpointId,
): SignalObservation {
  const output = state.outputFrames.find((frame) => frame.sourceEndpointId === endpointId);
  if (output) return { endpointId, value: output.value, capturedAtMs: output.observedAt };
  const delivery = state.deliveries.find((candidate) => candidate.destinationEndpointId === endpointId);
  if (delivery) return { endpointId, value: delivery.value, capturedAtMs: delivery.observedAt };
  return { endpointId };
}

/** Samples time-varying sources first, then returns the requested Inspector observation. */
export function observeLiveSignalAt(
  state: LiveSignalRuntimeState,
  patch: PatchState,
  endpointId: PortEndpointId,
  observedAt: number,
  ports: readonly ModulePortContract[] = ALL_PORT_CONTRACTS,
): SignalObservation {
  const sampled = sampleLiveSignalsAt(state, patch, observedAt, ports);
  if (sampled.status === 'rejected') return { endpointId };
  return observeLiveSignal(sampled.state, endpointId);
}
