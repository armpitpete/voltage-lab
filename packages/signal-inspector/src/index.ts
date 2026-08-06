import { getSignalSpecification, type SignalDomain } from '../../signal-spec/src/index';
import { PORT_CONTRACTS, type ModulePortContract, type PortEndpointId } from '../../port-contracts/src/index';

export const SIGNAL_INSPECTOR_VERSION = '1.0' as const;

export type SignalObservation = {
  endpointId: PortEndpointId;
  value?: number;
  capturedAtMs?: number;
};

export type SignalRangeState = 'declared-only' | 'within-range' | 'below-range' | 'above-range';

export type SignalInspection = {
  version: typeof SIGNAL_INSPECTOR_VERSION;
  endpoint: {
    id: PortEndpointId;
    module: string;
    moduleNumber: number;
    port: string;
    direction: ModulePortContract['direction'];
  };
  signal: {
    type: ModulePortContract['signalType'];
    label: string;
    purpose: string;
    rate: string;
    polarity: string;
    timing: string;
  };
  range: {
    minimum: number;
    maximum: number;
    unit: string;
    purpose: string;
    state: SignalRangeState;
    value: number | null;
    position: number | null;
  };
  teachingNote: string;
  limitation: string;
};

function findPort(endpointId: PortEndpointId): ModulePortContract | undefined {
  return PORT_CONTRACTS.find((port) => port.endpointId === endpointId);
}

function findDomain(port: ModulePortContract): SignalDomain {
  const specification = getSignalSpecification(port.signalType);
  const domain = specification.domains.find(
    (candidate) => candidate.kind === port.range.kind
      && port.range.minimum >= candidate.minimum
      && port.range.maximum <= candidate.maximum,
  );

  if (!domain) {
    throw new Error(`No shared signal domain supports ${port.endpointId}.`);
  }

  return domain;
}

function timingSummary(port: ModulePortContract): string {
  const timing = getSignalSpecification(port.signalType).timing;
  switch (timing.kind) {
    case 'continuous':
      return timing.meaning;
    case 'periodic-pulse':
      return `${timing.risingEdge} ${timing.highDuration}`;
    case 'level':
      return `${timing.highState} when high; ${timing.lowState} when low. ${timing.highDuration}`;
    case 'event-pulse':
      return `${timing.risingEdge} ${timing.highDuration}`;
  }
}

function stateFor(value: number | undefined, minimum: number, maximum: number): SignalRangeState {
  if (value === undefined) return 'declared-only';
  if (value < minimum) return 'below-range';
  if (value > maximum) return 'above-range';
  return 'within-range';
}

/**
 * Produces read-only teaching evidence for one declared socket. A value is optional
 * because v1.0 has no patch engine or live audio graph to sample yet.
 */
export function inspectSignal(observation: SignalObservation): SignalInspection | undefined {
  const port = findPort(observation.endpointId);
  if (!port) return undefined;
  if (observation.value !== undefined && !Number.isFinite(observation.value)) {
    throw new Error(`Signal observation for ${observation.endpointId} must be finite.`);
  }

  const specification = getSignalSpecification(port.signalType);
  const domain = findDomain(port);
  const value = observation.value ?? null;
  const rangeState = stateFor(observation.value, port.range.minimum, port.range.maximum);
  const position = value === null
    ? null
    : (value - port.range.minimum) / (port.range.maximum - port.range.minimum);

  return {
    version: SIGNAL_INSPECTOR_VERSION,
    endpoint: {
      id: port.endpointId,
      module: port.moduleTitle,
      moduleNumber: port.moduleNumber,
      port: port.label,
      direction: port.direction,
    },
    signal: {
      type: port.signalType,
      label: specification.label,
      purpose: port.purpose,
      rate: specification.rate,
      polarity: specification.polarity,
      timing: timingSummary(port),
    },
    range: {
      minimum: port.range.minimum,
      maximum: port.range.maximum,
      unit: port.range.unit,
      purpose: domain.purpose,
      state: rangeState,
      value,
      position,
    },
    teachingNote: specification.teachingRule,
    limitation: 'This is declared-socket evidence plus an optional supplied sample. It does not yet sample a live patch, draw a cable, or route audio.',
  };
}
