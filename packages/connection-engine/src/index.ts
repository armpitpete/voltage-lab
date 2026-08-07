import {
  ALL_PORT_CONTRACTS,
  evaluatePortCompatibility,
  type ModulePortContract,
  type PortCompatibility,
  type PortEndpointId,
} from '../../port-contracts/src/index';
import type { SignalType } from '../../signal-spec/src/index';

export const CONNECTION_ENGINE_VERSION = '1.0' as const;

export type ConnectionId = `connection:${number}`;

export type PatchConnection = {
  id: ConnectionId;
  sourceEndpointId: PortEndpointId;
  destinationEndpointId: PortEndpointId;
  compatibility: PortCompatibility;
};

export type PatchState = {
  version: typeof CONNECTION_ENGINE_VERSION;
  connections: readonly PatchConnection[];
  nextConnectionNumber: number;
};

export type ConnectResult = {
  state: PatchState;
  status: 'connected' | 'rejected';
  connection?: PatchConnection;
  reason: string;
  teachingNote: string;
};

export type DisconnectResult = {
  state: PatchState;
  status: 'disconnected' | 'unchanged';
  reason: string;
};

export type SignalFrame = {
  sourceEndpointId: PortEndpointId;
  signalType: SignalType;
  value: number;
  observedAt: number;
};

export type SignalDelivery = SignalFrame & {
  connectionId: ConnectionId;
  destinationEndpointId: PortEndpointId;
  destinationSignalType: SignalType;
};

export type SignalPropagation = {
  deliveries: readonly SignalDelivery[];
  rejectedFrames: readonly { frame: SignalFrame; reason: string }[];
};

const emptyState: PatchState = {
  version: CONNECTION_ENGINE_VERSION,
  connections: [],
  nextConnectionNumber: 1,
};

function findPort(endpointId: PortEndpointId, ports: readonly ModulePortContract[]): ModulePortContract | undefined {
  return ports.find((port) => port.endpointId === endpointId);
}

export function createPatchState(): PatchState {
  return emptyState;
}

/**
 * Creates a real patch only when the Port Contract is directly compatible.
 * Range and representation adaptations must become explicit adapter modules in a later unit.
 */
export function connectPorts(
  state: PatchState,
  sourceEndpointId: PortEndpointId,
  destinationEndpointId: PortEndpointId,
  ports: readonly ModulePortContract[] = ALL_PORT_CONTRACTS,
): ConnectResult {
  const source = findPort(sourceEndpointId, ports);
  const destination = findPort(destinationEndpointId, ports);

  if (!source || !destination) {
    return {
      state,
      status: 'rejected',
      reason: 'Both endpoints must be declared Port Contracts before they can be connected.',
      teachingNote: 'A modular patch connects named sockets, not guessed signal paths.',
    };
  }

  const compatibility = evaluatePortCompatibility(source, destination);
  if (!compatibility.compatible) {
    return { state, status: 'rejected', reason: compatibility.reason, teachingNote: compatibility.teachingNote };
  }

  if (compatibility.level !== 'direct') {
    return {
      state,
      status: 'rejected',
      reason: `${compatibility.reason} Connection Engine v1.0 does not apply an adapter automatically.`,
      teachingNote: 'A route that needs scaling or representation conversion must stay visible until an explicit adapter exists.',
    };
  }

  const occupied = state.connections.find((connection) => connection.destinationEndpointId === destinationEndpointId);
  if (occupied) {
    return {
      state,
      status: 'rejected',
      reason: `${destination.moduleTitle} · ${destination.label} already has ${occupied.sourceEndpointId} connected.`,
      teachingNote: 'Connection Engine v1.0 permits one source per input. Outputs may still fan out to several inputs.',
    };
  }

  const connection: PatchConnection = {
    id: `connection:${state.nextConnectionNumber}`,
    sourceEndpointId,
    destinationEndpointId,
    compatibility,
  };
  return {
    state: {
      version: CONNECTION_ENGINE_VERSION,
      connections: [...state.connections, connection],
      nextConnectionNumber: state.nextConnectionNumber + 1,
    },
    status: 'connected',
    connection,
    reason: compatibility.reason,
    teachingNote: 'This is now a real patch state. The next visual-cable unit will make the connection visible on the canvas.',
  };
}

export function disconnectPort(state: PatchState, connectionId: ConnectionId): DisconnectResult {
  const connection = state.connections.find((candidate) => candidate.id === connectionId);
  if (!connection) {
    return { state, status: 'unchanged', reason: `No connection named ${connectionId} exists.` };
  }
  return {
    state: {
      version: CONNECTION_ENGINE_VERSION,
      connections: state.connections.filter((candidate) => candidate.id !== connectionId),
      nextConnectionNumber: state.nextConnectionNumber,
    },
    status: 'disconnected',
    reason: `${connection.sourceEndpointId} is no longer connected to ${connection.destinationEndpointId}.`,
  };
}

/**
 * Delivers inspectable signal frames over directly compatible connections only.
 * It never mutates a module model or browser-audio graph; those integrations are later units.
 */
export function propagateSignals(
  state: PatchState,
  frames: readonly SignalFrame[],
  ports: readonly ModulePortContract[] = ALL_PORT_CONTRACTS,
): SignalPropagation {
  const deliveries: SignalDelivery[] = [];
  const rejectedFrames: { frame: SignalFrame; reason: string }[] = [];

  for (const frame of frames) {
    const source = findPort(frame.sourceEndpointId, ports);
    if (!source || source.direction !== 'output') {
      rejectedFrames.push({ frame, reason: 'Signal frame source is not a declared output socket.' });
      continue;
    }
    if (source.signalType !== frame.signalType) {
      rejectedFrames.push({ frame, reason: `Signal frame type ${frame.signalType} does not match ${source.signalType} at its source socket.` });
      continue;
    }
    if (!Number.isFinite(frame.value) || !Number.isFinite(frame.observedAt)) {
      rejectedFrames.push({ frame, reason: 'Signal frames require finite value and observedAt numbers.' });
      continue;
    }

    for (const connection of state.connections) {
      if (connection.sourceEndpointId !== frame.sourceEndpointId) continue;
      const destination = findPort(connection.destinationEndpointId, ports);
      if (!destination) {
        rejectedFrames.push({ frame, reason: `Connection ${connection.id} has no declared destination socket.` });
        continue;
      }
      deliveries.push({
        ...frame,
        connectionId: connection.id,
        destinationEndpointId: destination.endpointId,
        destinationSignalType: destination.signalType,
      });
    }
  }

  return { deliveries, rejectedFrames };
}
