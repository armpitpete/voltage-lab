import {
  advanceEnvelope,
  gateEnvelopeOff,
  gateEnvelopeOn,
  idleEnvelope,
  normaliseEnvelopeSettings,
  sustainVoltage,
  type EnvelopeSettings,
  type EnvelopeSnapshot,
  type EnvelopeState,
} from '../../envelope-model/src/index';
import type { EventDelivery } from '../../live-event-runtime/src/index';

export const M05_EXTERNAL_ENVELOPE_VERSION = '0.1' as const;

export type M05ExternalEnvelopeControls = {
  attackMs: number;
  decayMs: number;
  sustainLevel: number;
  releaseMs: number;
  triggerLengthMs: number;
};

export type M05ExternalEnvelopeState = {
  version: typeof M05_EXTERNAL_ENVELOPE_VERSION;
  controls: M05ExternalEnvelopeControls;
  envelope: EnvelopeState;
  externalGateHigh: boolean;
  oneShotEndsAtMs: number | undefined;
  processedThroughMs: number;
};

export type M05ExternalEnvelopeSample = {
  state: M05ExternalEnvelopeState;
  snapshot: EnvelopeSnapshot;
};

function clamp(value: number, minimum: number, maximum: number, fallback: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : fallback));
}

function settingsFromControls(controls: M05ExternalEnvelopeControls): Required<EnvelopeSettings> {
  return normaliseEnvelopeSettings({
    attackMs: controls.attackMs,
    decayMs: controls.decayMs,
    sustainLevel: controls.sustainLevel,
    releaseMs: controls.releaseMs,
    peakVoltage: 5,
  });
}

function stateFromSnapshot(snapshot: EnvelopeSnapshot): EnvelopeState {
  return {
    stage: snapshot.stage,
    gate: snapshot.gate,
    stageStartedAtMs: snapshot.stageStartedAtMs,
    stageStartVoltage: snapshot.stageStartVoltage,
  };
}

export function normaliseM05ExternalEnvelopeControls(
  controls: Partial<M05ExternalEnvelopeControls> = {},
): M05ExternalEnvelopeControls {
  return {
    attackMs: clamp(controls.attackMs ?? 250, 0, 3000, 250),
    decayMs: clamp(controls.decayMs ?? 350, 0, 3000, 350),
    sustainLevel: clamp(controls.sustainLevel ?? 0.55, 0, 1, 0.55),
    releaseMs: clamp(controls.releaseMs ?? 700, 0, 5000, 700),
    triggerLengthMs: clamp(controls.triggerLengthMs ?? 220, 20, 1200, 220),
  };
}

export function createM05ExternalEnvelope(
  controls: Partial<M05ExternalEnvelopeControls> = {},
  atMs: number,
): M05ExternalEnvelopeState {
  if (!Number.isFinite(atMs)) throw new Error('M05 envelope start time must be finite.');
  return {
    version: M05_EXTERNAL_ENVELOPE_VERSION,
    controls: normaliseM05ExternalEnvelopeControls(controls),
    envelope: idleEnvelope(atMs),
    externalGateHigh: false,
    oneShotEndsAtMs: undefined,
    processedThroughMs: atMs,
  };
}

function advanceStateTo(
  state: M05ExternalEnvelopeState,
  observedAtMs: number,
): M05ExternalEnvelopeState {
  if (!Number.isFinite(observedAtMs)) throw new Error('M05 envelope observation time must be finite.');
  if (observedAtMs < state.processedThroughMs) {
    throw new Error('M05 envelope events and samples must be processed in chronological order.');
  }

  const settings = settingsFromControls(state.controls);
  let envelope = state.envelope;
  let oneShotEndsAtMs = state.oneShotEndsAtMs;

  if (oneShotEndsAtMs !== undefined && oneShotEndsAtMs <= observedAtMs) {
    const beforeDeadline = advanceEnvelope(envelope, settings, oneShotEndsAtMs);
    envelope = stateFromSnapshot(beforeDeadline);
    if (!state.externalGateHigh && envelope.gate) {
      envelope = gateEnvelopeOff(envelope, settings, oneShotEndsAtMs);
    }
    oneShotEndsAtMs = undefined;
  }

  const snapshot = advanceEnvelope(envelope, settings, observedAtMs);
  return {
    ...state,
    envelope: stateFromSnapshot(snapshot),
    oneShotEndsAtMs,
    processedThroughMs: observedAtMs,
  };
}

/**
 * Applies only deliveries that actually reached M05's declared Gate/Trigger sockets.
 * Gate edges control a sustained state. Trigger rising edges retrigger from the current
 * voltage and create the accepted explicit one-shot gate length; trigger falling edges
 * do not prematurely end that one-shot gesture.
 */
export function applyM05DeliveredEvents(
  state: M05ExternalEnvelopeState,
  deliveries: readonly EventDelivery[],
): M05ExternalEnvelopeState {
  const relevant = deliveries
    .filter((delivery) => delivery.destinationEndpointId === 'envelope:gate' || delivery.destinationEndpointId === 'envelope:trigger')
    .sort((a, b) => a.occurredAt - b.occurredAt);

  let next = state;
  for (const delivery of relevant) {
    next = advanceStateTo(next, delivery.occurredAt);
    const settings = settingsFromControls(next.controls);

    if (delivery.destinationEndpointId === 'envelope:gate') {
      if (delivery.edge === 'rising') {
        const shouldStart = !next.envelope.gate;
        next = {
          ...next,
          externalGateHigh: true,
          envelope: shouldStart ? gateEnvelopeOn(next.envelope, settings, delivery.occurredAt) : next.envelope,
        };
      } else {
        const oneShotStillHigh = next.oneShotEndsAtMs !== undefined && delivery.occurredAt < next.oneShotEndsAtMs;
        next = {
          ...next,
          externalGateHigh: false,
          envelope: !oneShotStillHigh && next.envelope.gate
            ? gateEnvelopeOff(next.envelope, settings, delivery.occurredAt)
            : next.envelope,
        };
      }
      continue;
    }

    if (delivery.edge === 'rising') {
      next = {
        ...next,
        envelope: gateEnvelopeOn(next.envelope, settings, delivery.occurredAt),
        oneShotEndsAtMs: delivery.occurredAt + next.controls.triggerLengthMs,
      };
    }
    // Trigger falling is pulse-shape evidence only. The accepted M05 one-shot gate
    // remains high until triggerLengthMs expires (or an external Gate holds it longer).
  }

  return next;
}

export function sampleM05ExternalEnvelope(
  state: M05ExternalEnvelopeState,
  observedAtMs: number,
): M05ExternalEnvelopeSample {
  const advanced = advanceStateTo(state, observedAtMs);
  const snapshot = advanceEnvelope(advanced.envelope, settingsFromControls(advanced.controls), observedAtMs);
  return { state: advanced, snapshot };
}

/**
 * Matches M05 Lab's settings rebase: preserve the current voltage, update accepted
 * visible control bounds, and restart the current stage timing from the edit instant.
 */
export function updateM05ExternalEnvelopeControls(
  state: M05ExternalEnvelopeState,
  controls: Partial<M05ExternalEnvelopeControls>,
  observedAtMs: number,
): M05ExternalEnvelopeState {
  const sampled = sampleM05ExternalEnvelope(state, observedAtMs);
  const current = sampled.snapshot;
  const nextControls = normaliseM05ExternalEnvelopeControls({ ...state.controls, ...controls });
  const nextSettings = settingsFromControls(nextControls);
  let envelope: EnvelopeState;

  if (current.stage === 'idle') {
    envelope = idleEnvelope(observedAtMs);
  } else if (current.stage === 'sustain') {
    envelope = {
      stage: 'sustain',
      gate: current.gate,
      stageStartedAtMs: observedAtMs,
      stageStartVoltage: sustainVoltage(nextSettings),
    };
  } else {
    envelope = {
      stage: current.stage,
      gate: current.gate,
      stageStartedAtMs: observedAtMs,
      stageStartVoltage: current.voltage,
    };
  }

  return {
    ...sampled.state,
    controls: nextControls,
    envelope,
    processedThroughMs: observedAtMs,
  };
}

export function resetM05ExternalEnvelope(
  state: M05ExternalEnvelopeState,
  observedAtMs: number,
): M05ExternalEnvelopeState {
  return createM05ExternalEnvelope(state.controls, observedAtMs);
}
