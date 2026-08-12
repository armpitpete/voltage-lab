import type { ConnectionId, PatchState } from '../../connection-engine/src/index';
import {
  ALL_PORT_CONTRACTS,
  evaluatePortCompatibility,
  type ModulePortContract,
  type PortEndpointId,
} from '../../port-contracts/src/index';
import type { SignalType } from '../../signal-spec/src/index';

export const LIVE_EVENT_RUNTIME_VERSION = '1.0' as const;
export const LIVE_EVENT_HISTORY_LIMIT = 128;

export type EventSignalType = Extract<SignalType, 'clock' | 'gate' | 'trigger'>;
export type SignalEdge = 'rising' | 'falling';

export type SignalEvent = {
  sourceEndpointId: PortEndpointId;
  signalType: EventSignalType;
  edge: SignalEdge;
  level: 0 | 5;
  occurredAt: number;
};

export type EventDelivery = SignalEvent & {
  connectionId: ConnectionId;
  destinationEndpointId: PortEndpointId;
  destinationSignalType: EventSignalType;
};

export type LiveEventRuntimeState = {
  version: typeof LIVE_EVENT_RUNTIME_VERSION;
  sourceEvents: readonly SignalEvent[];
  deliveries: readonly EventDelivery[];
};

export type PublishSignalEventResult = {
  state: LiveEventRuntimeState;
  status: 'published' | 'rejected';
  reason: string;
  deliveries: readonly EventDelivery[];
};

const emptyState: LiveEventRuntimeState = {
  version: LIVE_EVENT_RUNTIME_VERSION,
  sourceEvents: [],
  deliveries: [],
};

const EVENT_SIGNAL_TYPES: readonly EventSignalType[] = ['clock', 'gate', 'trigger'];

function findPort(endpointId: PortEndpointId, ports: readonly ModulePortContract[]): ModulePortContract | undefined {
  return ports.find((port) => port.endpointId === endpointId);
}

function bounded<T>(items: readonly T[]): readonly T[] {
  return items.length <= LIVE_EVENT_HISTORY_LIMIT
    ? items
    : items.slice(items.length - LIVE_EVENT_HISTORY_LIMIT);
}

function validateSignalEvent(
  event: SignalEvent,
  ports: readonly ModulePortContract[],
): { source?: ModulePortContract; reason?: string } {
  const source = findPort(event.sourceEndpointId, ports);
  if (!source || source.direction !== 'output') {
    return { reason: 'Signal events must originate from a declared output socket.' };
  }
  if (!EVENT_SIGNAL_TYPES.includes(event.signalType)) {
    return { reason: 'Signal events are restricted to clock, gate and trigger signal types.' };
  }
  if (source.signalType !== event.signalType) {
    return { reason: `Signal event type ${event.signalType} does not match ${source.signalType} at ${source.endpointId}.` };
  }
  if (!Number.isFinite(event.occurredAt) || !Number.isFinite(event.level)) {
    return { reason: 'Signal events require finite occurrence times and levels.' };
  }
  if (event.level !== 0 && event.level !== 5) {
    return { reason: 'Voltage Lab event signals must use the declared 0 V low / 5 V high convention.' };
  }
  if ((event.edge === 'rising' && event.level !== 5) || (event.edge === 'falling' && event.level !== 0)) {
    return { reason: 'A rising event must result in 5 V and a falling event must result in 0 V.' };
  }
  if (event.level < source.range.minimum || event.level > source.range.maximum) {
    return { reason: `${source.endpointId} cannot represent event level ${event.level} ${source.range.unit}.` };
  }
  return { source };
}

export function createLiveEventRuntime(): LiveEventRuntimeState {
  return emptyState;
}

/**
 * Publishes one explicit clock/gate/trigger edge and routes that event only through
 * current real direct Connection Engine cables. Existing source/delivery history stays
 * inspectable and is bounded to the most recent LIVE_EVENT_HISTORY_LIMIT records.
 */
export function publishSignalEvent(
  state: LiveEventRuntimeState,
  patch: PatchState,
  event: SignalEvent,
  ports: readonly ModulePortContract[] = ALL_PORT_CONTRACTS,
): PublishSignalEventResult {
  const validation = validateSignalEvent(event, ports);
  const source = validation.source;
  if (!source) {
    return {
      state,
      status: 'rejected',
      reason: validation.reason ?? 'Signal event is invalid.',
      deliveries: [],
    };
  }

  const deliveries: EventDelivery[] = [];
  for (const connection of patch.connections) {
    if (connection.sourceEndpointId !== event.sourceEndpointId) continue;
    const destination = findPort(connection.destinationEndpointId, ports);
    if (!destination || destination.direction !== 'input') continue;

    // Re-evaluate the actual Port Contracts instead of trusting mutable connection metadata.
    const compatibility = evaluatePortCompatibility(source, destination);
    if (!compatibility.compatible || compatibility.level !== 'direct') continue;
    if (!EVENT_SIGNAL_TYPES.includes(destination.signalType as EventSignalType)) continue;

    deliveries.push({
      ...event,
      connectionId: connection.id,
      destinationEndpointId: destination.endpointId,
      destinationSignalType: destination.signalType as EventSignalType,
    });
  }

  const nextState: LiveEventRuntimeState = {
    version: LIVE_EVENT_RUNTIME_VERSION,
    sourceEvents: bounded([...state.sourceEvents, event]),
    deliveries: bounded([...state.deliveries, ...deliveries]),
  };
  return {
    state: nextState,
    status: 'published',
    reason: deliveries.length
      ? `Published ${event.signalType} ${event.edge} edge; ${deliveries.length} real cable ${deliveries.length === 1 ? 'delivery' : 'deliveries'} recorded.`
      : `Published ${event.signalType} ${event.edge} edge; no current direct cable receives it.`,
    deliveries,
  };
}

export function recentSourceEvents(
  state: LiveEventRuntimeState,
  endpointId?: PortEndpointId,
): readonly SignalEvent[] {
  return endpointId
    ? state.sourceEvents.filter((event) => event.sourceEndpointId === endpointId)
    : state.sourceEvents;
}

export function recentDeliveredEvents(
  state: LiveEventRuntimeState,
  endpointId?: PortEndpointId,
): readonly EventDelivery[] {
  return endpointId
    ? state.deliveries.filter((event) => event.destinationEndpointId === endpointId)
    : state.deliveries;
}

export function latestEventAtEndpoint(
  state: LiveEventRuntimeState,
  endpointId: PortEndpointId,
): SignalEvent | EventDelivery | undefined {
  const delivered = [...state.deliveries].reverse().find((event) => event.destinationEndpointId === endpointId);
  if (delivered) return delivered;
  return [...state.sourceEvents].reverse().find((event) => event.sourceEndpointId === endpointId);
}
