export const MODULE_INTERFACE_VERSION = '1.0' as const;

export type ModuleSignalType = 'audio' | 'cv' | 'clock' | 'gate' | 'trigger';
export type ModulePortDirection = 'input' | 'output';

export type SignalRange =
  | {
      kind: 'voltage';
      minimum: number;
      maximum: number;
      unit: 'V';
    }
  | {
      kind: 'normalised-audio';
      minimum: number;
      maximum: number;
      unit: 'normalised';
    };

export type ModulePortDeclaration = {
  id: string;
  label: string;
  direction: ModulePortDirection;
  signalType: ModuleSignalType;
  range: SignalRange;
  purpose: string;
};

export type ModuleVisualisation = {
  id: string;
  label: string;
  kind: 'history' | 'oscilloscope' | 'readout' | 'response' | 'routing' | 'spectrum' | 'timeline';
  purpose: string;
};

export type ModuleAudioBehaviour = {
  enabled: boolean;
  requiresExplicitStart: boolean;
  hasPanicStop: boolean;
  purpose: string;
};

export type ModuleTeachingPurpose = {
  purpose: string;
  outcomes: readonly string[];
};

export type VoltageLabModuleDeclaration = {
  interfaceVersion: typeof MODULE_INTERFACE_VERSION;
  moduleNumber: number;
  id: string;
  title: string;
  route: `#/${string}`;
  status: 'accepted-behaviour-preserved';
  inputs: readonly ModulePortDeclaration[];
  outputs: readonly ModulePortDeclaration[];
  visualisations: readonly ModuleVisualisation[];
  audio: ModuleAudioBehaviour;
  teaching: ModuleTeachingPurpose;
};

export type ModuleInterfaceProblem = {
  moduleId: string;
  message: string;
};

export function voltageRange(minimum: number, maximum: number): SignalRange {
  return { kind: 'voltage', minimum, maximum, unit: 'V' };
}

export function normalisedAudioRange(minimum = -1, maximum = 1): SignalRange {
  return { kind: 'normalised-audio', minimum, maximum, unit: 'normalised' };
}

export function validateModuleInterface(
  modules: readonly VoltageLabModuleDeclaration[],
): ModuleInterfaceProblem[] {
  const problems: ModuleInterfaceProblem[] = [];
  const moduleIds = new Set<string>();
  const moduleNumbers = new Set<number>();
  const routes = new Set<string>();

  for (const module of modules) {
    const fail = (message: string) => problems.push({ moduleId: module.id, message });

    if (module.interfaceVersion !== MODULE_INTERFACE_VERSION) fail('uses the wrong interface version');
    if (!module.id.trim()) fail('has no module id');
    if (moduleIds.has(module.id)) fail(`duplicates module id ${module.id}`);
    moduleIds.add(module.id);
    if (moduleNumbers.has(module.moduleNumber)) fail(`duplicates module number ${module.moduleNumber}`);
    moduleNumbers.add(module.moduleNumber);
    if (routes.has(module.route)) fail(`duplicates route ${module.route}`);
    routes.add(module.route);
    if (!module.teaching.purpose.trim()) fail('has no teaching purpose');
    if (module.teaching.outcomes.length === 0) fail('has no teaching outcomes');
    if (module.visualisations.length === 0) fail('has no visualisation declaration');

    if (module.audio.enabled && (!module.audio.requiresExplicitStart || !module.audio.hasPanicStop)) {
      fail('audible modules must require explicit start and provide panic/stop');
    }

    const portIds = new Set<string>();
    for (const [direction, ports] of [
      ['input', module.inputs],
      ['output', module.outputs],
    ] as const) {
      for (const port of ports) {
        if (port.direction !== direction) fail(`${port.id} has the wrong direction`);
        if (portIds.has(port.id)) fail(`duplicates port id ${port.id}`);
        portIds.add(port.id);
        if (!port.purpose.trim()) fail(`${port.id} has no purpose`);
        if (!Number.isFinite(port.range.minimum) || !Number.isFinite(port.range.maximum)) {
          fail(`${port.id} has a non-finite range`);
        } else if (port.range.minimum >= port.range.maximum) {
          fail(`${port.id} has an invalid range`);
        }
      }
    }
  }

  return problems;
}
