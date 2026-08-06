import type { ConnectionId, PatchState } from '../../connection-engine/src/index';
import { PORT_CONTRACTS, type ModulePortContract, type PortEndpointId } from '../../port-contracts/src/index';

export const VISUAL_PATCH_CABLES_VERSION = '1.0' as const;

export type VisualPatchCable = {
  version: typeof VISUAL_PATCH_CABLES_VERSION;
  connectionId: ConnectionId;
  direction: 'output-to-input';
  signalType: string;
  source: Pick<ModulePortContract, 'endpointId' | 'moduleTitle' | 'label'>;
  destination: Pick<ModulePortContract, 'endpointId' | 'moduleTitle' | 'label'>;
  accessibleLabel: string;
};

export type VisualPatchCableProblem = {
  connectionId: ConnectionId;
  reason: string;
};

export type VisualPatchCableView = {
  cables: readonly VisualPatchCable[];
  problems: readonly VisualPatchCableProblem[];
};

function findPort(endpointId: PortEndpointId, ports: readonly ModulePortContract[]): ModulePortContract | undefined {
  return ports.find((port) => port.endpointId === endpointId);
}

/**
 * Converts Connection Engine's real state into visible directional cable data.
 * It never creates, changes or routes a connection.
 */
export function visualisePatchState(
  state: PatchState,
  ports: readonly ModulePortContract[] = PORT_CONTRACTS,
): VisualPatchCableView {
  const cables: VisualPatchCable[] = [];
  const problems: VisualPatchCableProblem[] = [];

  for (const connection of state.connections) {
    const source = findPort(connection.sourceEndpointId, ports);
    const destination = findPort(connection.destinationEndpointId, ports);
    if (!source || !destination) {
      problems.push({
        connectionId: connection.id,
        reason: 'A saved connection cannot be drawn because one of its declared sockets is missing.',
      });
      continue;
    }
    if (source.direction !== 'output' || destination.direction !== 'input') {
      problems.push({
        connectionId: connection.id,
        reason: 'A connection can only be drawn from a declared output to a declared input.',
      });
      continue;
    }
    cables.push({
      version: VISUAL_PATCH_CABLES_VERSION,
      connectionId: connection.id,
      direction: 'output-to-input',
      signalType: source.signalType,
      source: { endpointId: source.endpointId, moduleTitle: source.moduleTitle, label: source.label },
      destination: { endpointId: destination.endpointId, moduleTitle: destination.moduleTitle, label: destination.label },
      accessibleLabel: source.moduleTitle + ' ' + source.label + ' output connected to ' +
        destination.moduleTitle + ' ' + destination.label + ' input',
    });
  }

  return { cables, problems };
}
