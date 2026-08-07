import {
  propagateSignals,
  type PatchState,
  type SignalDelivery,
  type SignalFrame,
} from '../../connection-engine/src/index';
import { ALL_PORT_CONTRACTS, type ModulePortContract, type PortEndpointId } from '../../port-contracts/src/index';
import type { SignalObservation } from '../../signal-inspector/src/index';

export const LIVE_SIGNAL_RUNTIME_VERSION = '1.0' as const;

export type LiveSignalRuntimeState = {
  version: typeof LIVE_SIGNAL_RUNTIME_VERSION;
  outputFrames: readonly SignalFrame[];
  deliveries: readonly SignalDelivery[];
};

export type PublishSignalResult = {
  state: LiveSignalRuntimeState;
  status: 'published' | 'rejected';
  reason: string;
  deliveries: readonly SignalDelivery[];
};

const emptyState: LiveSignalRuntimeState = {
  version: LIVE_SIGNAL_RUNTIME_VERSION,
  outputFrames: [],
  deliveries: [],
};

function findPort(endpointId: PortEndpointId, ports: readonly ModulePortContract[]): ModulePortContract | undefined {
  return ports.find((port) => port.endpointId === endpointId);
}

export function createLiveSignalRuntime(): LiveSignalRuntimeState {
  return emptyState;
}

/**
 * Publishes one actual output value, then derives every current direct input delivery
 * from Connection Engine's patch state. Values outside the declared source range are
 * rejected rather than silently clipped or adapted.
 */
export function publishSignal(
  state: LiveSignalRuntimeState,
  patch: PatchState,
  frame: SignalFrame,
  ports: readonly ModulePortContract[] = ALL_PORT_CONTRACTS,
): PublishSignalResult {
  const source = findPort(frame.sourceEndpointId, ports);
  if (!source || source.direction !== 'output') {
    return { state, status: 'rejected', reason: 'Live signals must be published from a declared output socket.', deliveries: [] };
  }
  if (source.signalType !== frame.signalType) {
    return { state, status: 'rejected', reason: `Live signal type ${frame.signalType} does not match ${source.signalType} at ${source.endpointId}.`, deliveries: [] };
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
  const propagation = propagateSignals(patch, outputFrames, ports);
  return {
    state: {
      version: LIVE_SIGNAL_RUNTIME_VERSION,
      outputFrames,
      deliveries: propagation.deliveries,
    },
    status: 'published',
    reason: propagation.deliveries.length
      ? `Published ${source.label}; ${propagation.deliveries.length} live input ${propagation.deliveries.length === 1 ? 'delivery is' : 'deliveries are'} now present.`
      : `Published ${source.label}; it has no connected direct input yet.`,
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
