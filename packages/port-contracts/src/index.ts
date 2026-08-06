import {
  voltageLabModules,
} from '../../module-interface/src/modules';
import type {
  ModulePortDeclaration,
  SignalRange,
  VoltageLabModuleDeclaration,
} from '../../module-interface/src/index';
import { getSignalSpecification, type SignalType } from '../../signal-spec/src/index';

export const PORT_CONTRACT_VERSION = '1.0' as const;

export type PortEndpointId = `${string}:${string}`;

export type ModulePortContract = {
  version: typeof PORT_CONTRACT_VERSION;
  endpointId: PortEndpointId;
  moduleId: string;
  moduleNumber: number;
  moduleTitle: string;
  portId: string;
  label: string;
  direction: ModulePortDeclaration['direction'];
  signalType: SignalType;
  range: SignalRange;
  purpose: string;
};

export type PortCompatibility = {
  compatible: boolean;
  level: 'direct' | 'adaptation-required' | 'incompatible';
  semantic: 'same-signal' | 'event-conversion' | 'incompatible';
  adaptation: 'none' | 'range' | 'representation';
  reason: string;
  teachingNote: string;
};

export type PortContractProblem = {
  endpointId: string;
  message: string;
};

const EVENT_SIGNAL_TYPES: readonly SignalType[] = ['clock', 'gate', 'trigger'];

function endpointId(moduleId: string, portId: string): PortEndpointId {
  return `${moduleId}:${portId}`;
}

export function buildModulePortContracts(
  modules: readonly VoltageLabModuleDeclaration[] = voltageLabModules,
): readonly ModulePortContract[] {
  return modules.flatMap((module) =>
    [...module.inputs, ...module.outputs].map((port) => ({
      version: PORT_CONTRACT_VERSION,
      endpointId: endpointId(module.id, port.id),
      moduleId: module.id,
      moduleNumber: module.moduleNumber,
      moduleTitle: module.title,
      portId: port.id,
      label: port.label,
      direction: port.direction,
      signalType: port.signalType,
      range: port.range,
      purpose: port.purpose,
    })),
  );
}

export const PORT_CONTRACTS = buildModulePortContracts();

export function findPortContract(moduleId: string, portId: string): ModulePortContract | undefined {
  return PORT_CONTRACTS.find((port) => port.moduleId === moduleId && port.portId === portId);
}

function isEventSignal(type: SignalType): boolean {
  return EVENT_SIGNAL_TYPES.includes(type);
}

function evaluateAdaptation(source: ModulePortContract, destination: ModulePortContract): Pick<PortCompatibility, 'level' | 'adaptation'> {
  if (source.range.kind !== destination.range.kind) {
    return { level: 'adaptation-required', adaptation: 'representation' };
  }

  if (
    source.range.minimum < destination.range.minimum ||
    source.range.maximum > destination.range.maximum
  ) {
    return { level: 'adaptation-required', adaptation: 'range' };
  }

  return { level: 'direct', adaptation: 'none' };
}

export function evaluatePortCompatibility(
  source: ModulePortContract,
  destination: ModulePortContract,
): PortCompatibility {
  if (source.direction !== 'output' || destination.direction !== 'input') {
    return {
      compatible: false,
      level: 'incompatible',
      semantic: 'incompatible',
      adaptation: 'none',
      reason: 'A patch must travel from an output socket to an input socket.',
      teachingNote: 'Signal direction is part of the socket contract.',
    };
  }

  const sameSignal = source.signalType === destination.signalType;
  const eventConversion = isEventSignal(source.signalType) && isEventSignal(destination.signalType);

  if (!sameSignal && !eventConversion) {
    return {
      compatible: false,
      level: 'incompatible',
      semantic: 'incompatible',
      adaptation: 'none',
      reason: `${source.signalType} does not satisfy a ${destination.signalType} input in Port Contracts v1.0.`,
      teachingNote: 'Voltage Lab keeps audio, CV and timing/event meanings explicit instead of silently treating them as interchangeable.',
    };
  }

  const range = evaluateAdaptation(source, destination);
  const semantic = sameSignal ? 'same-signal' : 'event-conversion';
  const eventNote = eventConversion && !sameSignal
    ? `A ${source.signalType} can drive a ${destination.signalType} input, but the destination interprets the pulse using ${destination.signalType} semantics.`
    : 'Source and destination use the same signal meaning.';

  if (range.adaptation === 'representation') {
    return {
      compatible: true,
      ...range,
      semantic,
      reason: 'The sockets are semantically compatible but use different signal representations.',
      teachingNote: `${eventNote} The later connection engine must make the representation boundary explicit.`,
    };
  }

  if (range.adaptation === 'range') {
    return {
      compatible: true,
      ...range,
      semantic,
      reason: 'The source can exceed the destination declared range.',
      teachingNote: `${eventNote} The later connection engine must expose the required range handling rather than silently clipping it.`,
    };
  }

  return {
    compatible: true,
    ...range,
    semantic,
    reason: sameSignal ? 'Signal type and declared range are directly compatible.' : 'Timing/event voltage range is directly compatible.',
    teachingNote: eventNote,
  };
}

export function validatePortContracts(
  contracts: readonly ModulePortContract[] = PORT_CONTRACTS,
): PortContractProblem[] {
  const problems: PortContractProblem[] = [];
  const endpointIds = new Set<string>();

  for (const contract of contracts) {
    const fail = (message: string) => problems.push({ endpointId: contract.endpointId, message });
    if (contract.version !== PORT_CONTRACT_VERSION) fail('uses the wrong port-contract version');
    if (contract.endpointId !== endpointId(contract.moduleId, contract.portId)) fail('has an unstable endpoint id');
    if (endpointIds.has(contract.endpointId)) fail('duplicates an endpoint id');
    endpointIds.add(contract.endpointId);
    if (!contract.label.trim() || !contract.purpose.trim()) fail('has missing teaching text');

    const signal = getSignalSpecification(contract.signalType);
    const supportedDomain = signal.domains.some(
      (domain) =>
        domain.kind === contract.range.kind &&
        contract.range.minimum >= domain.minimum &&
        contract.range.maximum <= domain.maximum,
    );
    if (!supportedDomain) fail('declares a range outside the shared signal specification');
  }

  return problems;
}
