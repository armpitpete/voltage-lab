export const SIGNAL_SPEC_VERSION = '1.0' as const;

export type SignalType = 'audio' | 'cv' | 'clock' | 'gate' | 'trigger';
export type SignalRate = 'audio-rate' | 'control-rate' | 'event-rate';
export type SignalPolarity = 'bipolar' | 'unipolar' | 'context-dependent';

export type SignalDomain =
  | {
      kind: 'voltage';
      minimum: number;
      maximum: number;
      unit: 'V';
      purpose: string;
    }
  | {
      kind: 'normalised-audio';
      minimum: -1;
      maximum: 1;
      unit: 'normalised';
      purpose: string;
    };

export type SignalTimingMeaning =
  | { kind: 'continuous'; meaning: string }
  | { kind: 'periodic-pulse'; risingEdge: string; highDuration: string }
  | { kind: 'level'; highState: string; lowState: string; highDuration: string }
  | { kind: 'event-pulse'; risingEdge: string; highDuration: string };

export type SignalSpecification = {
  version: typeof SIGNAL_SPEC_VERSION;
  type: SignalType;
  label: string;
  purpose: string;
  rate: SignalRate;
  polarity: SignalPolarity;
  domains: readonly SignalDomain[];
  timing: SignalTimingMeaning;
  teachingRule: string;
};

const voltageDomain = (minimum: number, maximum: number, purpose: string): SignalDomain => ({
  kind: 'voltage',
  minimum,
  maximum,
  unit: 'V',
  purpose,
});

export const SIGNAL_SPECIFICATIONS: Readonly<Record<SignalType, SignalSpecification>> = {
  audio: {
    version: SIGNAL_SPEC_VERSION,
    type: 'audio',
    label: 'Audio',
    purpose: 'A continuously changing signal intended to become or modify audible sound.',
    rate: 'audio-rate',
    polarity: 'bipolar',
    domains: [
      voltageDomain(-10, 10, 'Conceptual modular-synth voltage used by the teaching models.'),
      {
        kind: 'normalised-audio',
        minimum: -1,
        maximum: 1,
        unit: 'normalised',
        purpose: 'Safe browser-audio representation after the explicit audio boundary.',
      },
    ],
    timing: { kind: 'continuous', meaning: 'Instantaneous value carries the waveform shape.' },
    teachingRule: 'Treat waveform shape and level as signal information; browser-normalised audio is not a physical voltage.',
  },
  cv: {
    version: SIGNAL_SPEC_VERSION,
    type: 'cv',
    label: 'Control voltage',
    purpose: 'A continuously varying voltage used to control another parameter.',
    rate: 'control-rate',
    polarity: 'context-dependent',
    domains: [voltageDomain(-10, 10, 'Teaching envelope for bipolar and unipolar control-voltage examples.')],
    timing: { kind: 'continuous', meaning: 'Instantaneous voltage is the control value.' },
    teachingRule: 'Read the voltage numerically and interpret it through the destination, such as 1 V/octave pitch or 0–5 V gain.',
  },
  clock: {
    version: SIGNAL_SPEC_VERSION,
    type: 'clock',
    label: 'Clock',
    purpose: 'A repeating pulse train that provides a shared musical or sequencing timebase.',
    rate: 'event-rate',
    polarity: 'unipolar',
    domains: [voltageDomain(0, 5, 'Voltage Lab clock convention: low at 0 V and high at 5 V.')],
    timing: {
      kind: 'periodic-pulse',
      risingEdge: 'Starts the next clock event.',
      highDuration: 'May express pulse width, but repetition rate defines the clock.',
    },
    teachingRule: 'Count clock edges to understand tempo, division, multiplication and swing.',
  },
  gate: {
    version: SIGNAL_SPEC_VERSION,
    type: 'gate',
    label: 'Gate',
    purpose: 'A high/low control signal whose high state remains meaningful for its full duration.',
    rate: 'event-rate',
    polarity: 'unipolar',
    domains: [voltageDomain(0, 5, 'Voltage Lab gate convention: inactive at 0 V and active at 5 V.')],
    timing: {
      kind: 'level',
      highState: 'Active or held.',
      lowState: 'Inactive or released.',
      highDuration: 'Meaningful: the destination may behave differently for as long as the gate is high.',
    },
    teachingRule: 'A gate describes a state through time, not merely the instant when it rises.',
  },
  trigger: {
    version: SIGNAL_SPEC_VERSION,
    type: 'trigger',
    label: 'Trigger',
    purpose: 'A short event pulse used to make something happen once.',
    rate: 'event-rate',
    polarity: 'unipolar',
    domains: [voltageDomain(0, 5, 'Voltage Lab trigger convention: a short 0 V to 5 V event pulse.')],
    timing: {
      kind: 'event-pulse',
      risingEdge: 'Represents the event.',
      highDuration: 'Kept short; unlike a gate, the held-high duration is not the teaching value.',
    },
    teachingRule: 'Treat a trigger as one event; do not teach its high duration as a sustained state.',
  },
};

export type SignalSpecificationProblem = { signalType: SignalType | 'registry'; message: string };

export function getSignalSpecification(type: SignalType): SignalSpecification {
  return SIGNAL_SPECIFICATIONS[type];
}

export function validateSignalSpecifications(
  specifications: Readonly<Record<SignalType, SignalSpecification>> = SIGNAL_SPECIFICATIONS,
): SignalSpecificationProblem[] {
  const problems: SignalSpecificationProblem[] = [];
  const expectedTypes: readonly SignalType[] = ['audio', 'cv', 'clock', 'gate', 'trigger'];

  for (const type of expectedTypes) {
    const spec = specifications[type];
    if (!spec) {
      problems.push({ signalType: 'registry', message: `missing ${type} specification` });
      continue;
    }
    const fail = (message: string) => problems.push({ signalType: type, message });
    if (spec.version !== SIGNAL_SPEC_VERSION) fail('uses the wrong specification version');
    if (spec.type !== type) fail(`declares mismatched type ${spec.type}`);
    if (!spec.label.trim() || !spec.purpose.trim() || !spec.teachingRule.trim()) fail('has missing teaching text');
    if (spec.domains.length === 0) fail('declares no supported domain');
    for (const domain of spec.domains) {
      if (!Number.isFinite(domain.minimum) || !Number.isFinite(domain.maximum) || domain.minimum >= domain.maximum) {
        fail(`has invalid ${domain.kind} domain`);
      }
      if (!domain.purpose.trim()) fail(`has unexplained ${domain.kind} domain`);
    }
  }

  return problems;
}
