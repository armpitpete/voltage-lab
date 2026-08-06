export type EnvelopeStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';

export type EnvelopeSettings = {
  attackMs: number;
  decayMs: number;
  sustainLevel: number;
  releaseMs: number;
  peakVoltage?: number;
};

export type EnvelopeState = {
  stage: EnvelopeStage;
  gate: boolean;
  stageStartedAtMs: number;
  stageStartVoltage: number;
};

export type EnvelopeSnapshot = EnvelopeState & {
  voltage: number;
  stageElapsedMs: number;
};

export type EnvelopeDestination = 'amplitude' | 'filter' | 'pitch';

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normaliseEnvelopeSettings(settings: EnvelopeSettings): Required<EnvelopeSettings> {
  return {
    attackMs: Math.max(0, settings.attackMs),
    decayMs: Math.max(0, settings.decayMs),
    sustainLevel: clamp(settings.sustainLevel, 0, 1),
    releaseMs: Math.max(0, settings.releaseMs),
    peakVoltage: Math.max(0.001, settings.peakVoltage ?? 5),
  };
}

export function idleEnvelope(atMs = 0): EnvelopeState {
  return {
    stage: 'idle',
    gate: false,
    stageStartedAtMs: atMs,
    stageStartVoltage: 0,
  };
}

export function sustainVoltage(settings: EnvelopeSettings) {
  const normalised = normaliseEnvelopeSettings(settings);
  return normalised.peakVoltage * normalised.sustainLevel;
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * clamp(progress, 0, 1);
}

export function advanceEnvelope(
  state: EnvelopeState,
  settings: EnvelopeSettings,
  nowMs: number,
): EnvelopeSnapshot {
  const normalised = normaliseEnvelopeSettings(settings);
  const elapsed = Math.max(0, nowMs - state.stageStartedAtMs);

  if (state.stage === 'idle') {
    return { ...state, voltage: 0, stageElapsedMs: elapsed };
  }

  if (state.stage === 'attack') {
    if (normalised.attackMs === 0 || elapsed >= normalised.attackMs) {
      const decayState: EnvelopeState = {
        stage: 'decay',
        gate: state.gate,
        stageStartedAtMs: state.stageStartedAtMs + normalised.attackMs,
        stageStartVoltage: normalised.peakVoltage,
      };
      return advanceEnvelope(decayState, normalised, nowMs);
    }
    return {
      ...state,
      voltage: interpolate(state.stageStartVoltage, normalised.peakVoltage, elapsed / normalised.attackMs),
      stageElapsedMs: elapsed,
    };
  }

  if (state.stage === 'decay') {
    if (normalised.decayMs === 0 || elapsed >= normalised.decayMs) {
      const sustainState: EnvelopeState = {
        stage: 'sustain',
        gate: state.gate,
        stageStartedAtMs: state.stageStartedAtMs + normalised.decayMs,
        stageStartVoltage: sustainVoltage(normalised),
      };
      return advanceEnvelope(sustainState, normalised, nowMs);
    }
    return {
      ...state,
      voltage: interpolate(
        state.stageStartVoltage,
        sustainVoltage(normalised),
        elapsed / normalised.decayMs,
      ),
      stageElapsedMs: elapsed,
    };
  }

  if (state.stage === 'sustain') {
    return {
      ...state,
      voltage: sustainVoltage(normalised),
      stageElapsedMs: elapsed,
    };
  }

  if (normalised.releaseMs === 0 || elapsed >= normalised.releaseMs) {
    return {
      ...idleEnvelope(state.stageStartedAtMs + normalised.releaseMs),
      voltage: 0,
      stageElapsedMs: Math.max(0, nowMs - (state.stageStartedAtMs + normalised.releaseMs)),
    };
  }

  return {
    ...state,
    voltage: interpolate(state.stageStartVoltage, 0, elapsed / normalised.releaseMs),
    stageElapsedMs: elapsed,
  };
}

export function gateEnvelopeOn(
  state: EnvelopeState,
  settings: EnvelopeSettings,
  nowMs: number,
): EnvelopeState {
  const current = advanceEnvelope(state, settings, nowMs);
  return {
    stage: 'attack',
    gate: true,
    stageStartedAtMs: nowMs,
    stageStartVoltage: current.voltage,
  };
}

export function gateEnvelopeOff(
  state: EnvelopeState,
  settings: EnvelopeSettings,
  nowMs: number,
): EnvelopeState {
  const current = advanceEnvelope(state, settings, nowMs);
  if (current.voltage <= 0) return idleEnvelope(nowMs);
  return {
    stage: 'release',
    gate: false,
    stageStartedAtMs: nowMs,
    stageStartVoltage: current.voltage,
  };
}

export function repeatingGateState(elapsedMs: number, bpm: number, gatePercent: number) {
  const safeBpm = Math.max(1, bpm);
  const periodMs = 60000 / safeBpm;
  const highMs = periodMs * clamp(gatePercent, 1, 99) / 100;
  const phaseMs = ((Math.max(0, elapsedMs) % periodMs) + periodMs) % periodMs;
  return phaseMs < highMs;
}

export function envelopeDestinationValue(
  voltage: number,
  destination: EnvelopeDestination,
  pitchDepthOctaves = 1,
) {
  const normalised = clamp(voltage / 5, 0, 1);
  if (destination === 'amplitude') return normalised;
  if (destination === 'filter') return 120 + normalised * 7880;
  return 2 ** (normalised * Math.max(0, pitchDepthOctaves));
}

export function stageLabel(stage: EnvelopeStage) {
  return stage[0].toUpperCase() + stage.slice(1);
}
