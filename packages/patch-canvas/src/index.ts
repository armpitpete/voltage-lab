import {
  ALL_PORT_CONTRACTS,
  evaluatePortCompatibility,
  type ModulePortContract,
  type PortCompatibility,
  type PortEndpointId,
} from '../../port-contracts/src/index';

export const PATCH_CANVAS_VERSION = '1.0' as const;

export type PatchCanvasStage =
  | 'choose-output'
  | 'choose-input'
  | 'proposal-ready'
  | 'proposal-rejected';

export type PatchCanvasSelection = {
  sourceEndpointId?: PortEndpointId;
  destinationEndpointId?: PortEndpointId;
};

export type PatchCanvasRoute = {
  from: {
    endpointId: PortEndpointId;
    module: string;
    port: string;
  };
  to: {
    endpointId: PortEndpointId;
    module: string;
    port: string;
  };
  direction: 'output-to-input';
  style: 'direct' | 'adaptation-required' | 'incompatible';
  label: string;
};

export type PatchCanvasProposal = {
  version: typeof PATCH_CANVAS_VERSION;
  stage: PatchCanvasStage;
  source?: ModulePortContract;
  destination?: ModulePortContract;
  compatibility?: PortCompatibility;
  route?: PatchCanvasRoute;
  teachingNote: string;
  limitation: string;
};

function findPort(endpointId: PortEndpointId | undefined): ModulePortContract | undefined {
  return endpointId ? PORT_CONTRACTS.find((port) => port.endpointId === endpointId) : undefined;
}

function routeFor(
  source: ModulePortContract,
  destination: ModulePortContract,
  compatibility: PortCompatibility,
): PatchCanvasRoute {
  return {
    from: { endpointId: source.endpointId, module: source.moduleTitle, port: source.label },
    to: { endpointId: destination.endpointId, module: destination.moduleTitle, port: destination.label },
    direction: 'output-to-input',
    style: compatibility.compatible
      ? compatibility.level === 'direct' ? 'direct' : 'adaptation-required'
      : 'incompatible',
    label: `${source.moduleTitle} · ${source.label} → ${destination.moduleTitle} · ${destination.label}`,
  };
}

const limitation =
  'This is a patch plan only. It does not create connection state, a cable, signal movement, audio routing, saved data or a module-side effect.';

/**
 * Produces a read-only patch proposal from declared sockets. Connection Engine v1.0
 * is deliberately responsible for turning a later compatible proposal into a patch.
 */
export function createPatchCanvasProposal(selection: PatchCanvasSelection = {}): PatchCanvasProposal {
  const source = findPort(selection.sourceEndpointId);
  const destination = findPort(selection.destinationEndpointId);

  if (selection.sourceEndpointId && !source) {
    throw new Error(`Unknown source endpoint: ${selection.sourceEndpointId}`);
  }
  if (selection.destinationEndpointId && !destination) {
    throw new Error(`Unknown destination endpoint: ${selection.destinationEndpointId}`);
  }

  if (!source) {
    return {
      version: PATCH_CANVAS_VERSION,
      stage: 'choose-output',
      teachingNote: 'Begin with an output: every proposed signal route has a declared source.',
      limitation,
    };
  }

  if (!destination) {
    return {
      version: PATCH_CANVAS_VERSION,
      stage: 'choose-input',
      source,
      teachingNote: 'Now choose an input and compare its required signal meaning and range with the selected output.',
      limitation,
    };
  }

  const compatibility = evaluatePortCompatibility(source, destination);
  const route = routeFor(source, destination, compatibility);
  return {
    version: PATCH_CANVAS_VERSION,
    stage: compatibility.compatible ? 'proposal-ready' : 'proposal-rejected',
    source,
    destination,
    compatibility,
    route,
    teachingNote: compatibility.teachingNote,
    limitation,
  };
}

export function listPatchCanvasOutputs(): readonly ModulePortContract[] {
  return ALL_PORT_CONTRACTS.filter((port) => port.direction === 'output');
}

export function listPatchCanvasInputs(): readonly ModulePortContract[] {
  return ALL_PORT_CONTRACTS.filter((port) => port.direction === 'input');
}

export type PatchCanvasRackModule = {
  moduleId: string;
  moduleNumber: number;
  moduleTitle: string;
  inputs: readonly ModulePortContract[];
  outputs: readonly ModulePortContract[];
};

/**
 * Produces the whole visible rack from the same port contracts used for compatibility.
 * A declared patch point cannot be omitted from the rack without a contract-test failure.
 */
export function listPatchCanvasRackModules(): readonly PatchCanvasRackModule[] {
  const modules = new Map<string, {
    moduleId: string;
    moduleNumber: number;
    moduleTitle: string;
    inputs: ModulePortContract[];
    outputs: ModulePortContract[];
  }>();

  for (const port of [...listPatchCanvasInputs(), ...listPatchCanvasOutputs()]) {
    const module = modules.get(port.moduleId) ?? {
      moduleId: port.moduleId,
      moduleNumber: port.moduleNumber,
      moduleTitle: port.moduleTitle,
      inputs: [],
      outputs: [],
    };
    if (port.direction === 'input') module.inputs.push(port);
    else module.outputs.push(port);
    modules.set(port.moduleId, module);
  }

  return [...modules.values()].sort((left, right) =>
    left.moduleNumber - right.moduleNumber || left.moduleTitle.localeCompare(right.moduleTitle),
  );
}
