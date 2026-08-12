import { clampPulseWidth, clockFrame, periodMs, swungInterval } from '../../clock-model/src/index';
import type { PatchState } from '../../connection-engine/src/index';
import {
  publishSignalEvent,
  type EventDelivery,
  type LiveEventRuntimeState,
  type SignalEvent,
} from '../../live-event-runtime/src/index';

export const M02_PATCH_SOURCE_VERSION = '0.1' as const;

export type M02PatchSourceControls = {
  bpm: number;
  pulseWidth: number;
  swing: number;
  division: 1 | 2 | 4 | 8;
  multiplication: 1 | 2 | 4 | 8;
};

export type M02PatchSourceState = {
  version: typeof M02_PATCH_SOURCE_VERSION;
  controls: M02PatchSourceControls;
  startedAtMs: number;
};

export type M02OutputLevels = {
  clock: boolean;
  gate: boolean;
  trigger: boolean;
  divided: boolean;
  multiplied: boolean;
  beat: number;
};

export type M02EventWindow = {
  fromExclusiveMs: number;
  toInclusiveMs: number;
  events: readonly SignalEvent[];
  levelsAtEnd: M02OutputLevels;
};

export type PublishM02WindowResult = M02EventWindow & {
  runtime: LiveEventRuntimeState;
  deliveries: readonly EventDelivery[];
};

const DIVISIONS = [1, 2, 4, 8] as const;
const EPSILON_MS = 1e-6;

const OUTPUTS = [
  { key: 'clock', endpointId: 'clock-and-trigger:clock', signalType: 'clock' },
  { key: 'gate', endpointId: 'clock-and-trigger:gate', signalType: 'gate' },
  { key: 'trigger', endpointId: 'clock-and-trigger:trigger', signalType: 'trigger' },
  { key: 'divided', endpointId: 'clock-and-trigger:divided', signalType: 'clock' },
  { key: 'multiplied', endpointId: 'clock-and-trigger:multiplied', signalType: 'clock' },
] as const;

function clamp(value: number, minimum: number, maximum: number, fallback: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : fallback));
}

function acceptedDivision(value: number | undefined, fallback: 1 | 2 | 4 | 8): 1 | 2 | 4 | 8 {
  return DIVISIONS.includes(value as 1 | 2 | 4 | 8) ? value as 1 | 2 | 4 | 8 : fallback;
}

export function normaliseM02PatchSourceControls(
  controls: Partial<M02PatchSourceControls> = {},
): M02PatchSourceControls {
  return {
    bpm: clamp(controls.bpm ?? 120, 30, 240, 120),
    pulseWidth: clampPulseWidth(controls.pulseWidth ?? 0.5),
    swing: clamp(controls.swing ?? 0, 0, 0.45, 0),
    division: acceptedDivision(controls.division, 4),
    multiplication: acceptedDivision(controls.multiplication, 2),
  };
}

export function createM02PatchSource(
  controls: Partial<M02PatchSourceControls> = {},
  startedAtMs: number,
): M02PatchSourceState {
  if (!Number.isFinite(startedAtMs)) throw new Error('M02 start time must be finite.');
  return {
    version: M02_PATCH_SOURCE_VERSION,
    controls: normaliseM02PatchSourceControls(controls),
    startedAtMs,
  };
}

/** Accepted M02 controls reset the shared timing origin when changed, matching the Lab. */
export function updateM02PatchSource(
  state: M02PatchSourceState,
  controls: Partial<M02PatchSourceControls>,
  observedAtMs: number,
): M02PatchSourceState {
  return createM02PatchSource({ ...state.controls, ...controls }, observedAtMs);
}

export function resetM02PatchSource(
  state: M02PatchSourceState,
  observedAtMs: number,
): M02PatchSourceState {
  return createM02PatchSource(state.controls, observedAtMs);
}

/**
 * Reproduces the accepted Clock & Trigger Lab's current timing transform exactly.
 * In particular, swing uses the Lab's existing per-beat swungInterval/min mapping;
 * this controller does not silently replace it with a different musical swing model.
 */
export function m02OutputLevelsAt(state: M02PatchSourceState, observedAtMs: number): M02OutputLevels {
  if (!Number.isFinite(observedAtMs)) throw new Error('M02 observation time must be finite.');
  if (observedAtMs < state.startedAtMs) {
    return { clock: false, gate: false, trigger: false, divided: false, multiplied: false, beat: 0 };
  }

  const elapsedMs = observedAtMs - state.startedAtMs;
  const baseMs = periodMs(state.controls.bpm);
  const beat = Math.floor(elapsedMs / baseMs);
  const localMs = elapsedMs - beat * baseMs;
  const acceptedSwungInterval = swungInterval(baseMs, state.controls.swing, beat);
  const adjustedElapsedMs = beat * baseMs + Math.min(localMs, acceptedSwungInterval);
  const frame = clockFrame(
    adjustedElapsedMs,
    state.controls.bpm,
    state.controls.pulseWidth,
    state.controls.division,
    state.controls.multiplication,
  );

  return {
    clock: frame.trigger,
    gate: frame.gate,
    trigger: frame.trigger,
    divided: frame.divided,
    multiplied: frame.multiplied,
    beat: frame.beat,
  };
}

function candidateTimes(
  state: M02PatchSourceState,
  fromExclusiveMs: number,
  toInclusiveMs: number,
): number[] {
  const baseMs = periodMs(state.controls.bpm);
  const relativeFrom = fromExclusiveMs - state.startedAtMs;
  const relativeTo = toInclusiveMs - state.startedAtMs;
  const firstBeat = Math.max(0, Math.floor(relativeFrom / baseMs) - 1);
  const lastBeat = Math.max(0, Math.ceil(relativeTo / baseMs) + 1);
  const candidates: number[] = [];

  for (let beat = firstBeat; beat <= lastBeat; beat += 1) {
    const beatStart = state.startedAtMs + beat * baseMs;
    const activeSpan = Math.min(baseMs, swungInterval(baseMs, state.controls.swing, beat));
    const localBoundaries = [
      0,
      0.035 * baseMs,
      state.controls.pulseWidth * baseMs,
    ];

    const multipliedPeriod = baseMs / state.controls.multiplication;
    for (let index = 0; index < state.controls.multiplication; index += 1) {
      const rising = index * multipliedPeriod;
      localBoundaries.push(rising, rising + 0.035 * multipliedPeriod);
    }

    for (const local of localBoundaries) {
      // The accepted Lab freezes an odd swung beat after activeSpan; boundaries after
      // that point are not reached before the next real base-beat boundary.
      if (local > activeSpan + EPSILON_MS) continue;
      const time = beatStart + local;
      if (time > fromExclusiveMs && time <= toInclusiveMs && time >= state.startedAtMs) {
        candidates.push(time);
      }
    }
  }

  candidates.sort((a, b) => a - b);
  return candidates.filter((time, index) => index === 0 || Math.abs(time - candidates[index - 1]) > EPSILON_MS);
}

function levelBefore(state: M02PatchSourceState, timeMs: number): M02OutputLevels {
  if (timeMs <= state.startedAtMs) {
    return { clock: false, gate: false, trigger: false, divided: false, multiplied: false, beat: 0 };
  }
  return m02OutputLevelsAt(state, timeMs - EPSILON_MS);
}

/**
 * Returns every actual edge in an explicit observation window, not merely the value at
 * the end of the window. Short triggers therefore remain present even if no animation
 * frame happened during their brief 5 V pulse.
 */
export function m02EventsBetween(
  state: M02PatchSourceState,
  fromExclusiveMs: number,
  toInclusiveMs: number,
): M02EventWindow {
  if (!Number.isFinite(fromExclusiveMs) || !Number.isFinite(toInclusiveMs)) {
    throw new Error('M02 event-window times must be finite.');
  }
  if (toInclusiveMs < fromExclusiveMs) {
    throw new Error('M02 event window must end at or after it starts.');
  }

  const events: SignalEvent[] = [];
  for (const occurredAt of candidateTimes(state, fromExclusiveMs, toInclusiveMs)) {
    const before = levelBefore(state, occurredAt);
    const at = m02OutputLevelsAt(state, occurredAt);
    for (const output of OUTPUTS) {
      const wasHigh = before[output.key];
      const isHigh = at[output.key];
      if (wasHigh === isHigh) continue;
      events.push({
        sourceEndpointId: output.endpointId,
        signalType: output.signalType,
        edge: isHigh ? 'rising' : 'falling',
        level: isHigh ? 5 : 0,
        occurredAt,
      });
    }
  }

  return {
    fromExclusiveMs,
    toInclusiveMs,
    events,
    levelsAtEnd: m02OutputLevelsAt(state, toInclusiveMs),
  };
}

/** Publishes a complete M02 edge window sequentially through the explicit event runtime. */
export function publishM02EventWindow(
  runtime: LiveEventRuntimeState,
  patch: PatchState,
  state: M02PatchSourceState,
  fromExclusiveMs: number,
  toInclusiveMs: number,
): PublishM02WindowResult {
  const window = m02EventsBetween(state, fromExclusiveMs, toInclusiveMs);
  let nextRuntime = runtime;
  const deliveries: EventDelivery[] = [];
  for (const event of window.events) {
    const published = publishSignalEvent(nextRuntime, patch, event);
    if (published.status !== 'published') {
      throw new Error(`M02 generated an invalid ${event.signalType} event: ${published.reason}`);
    }
    nextRuntime = published.state;
    deliveries.push(...published.deliveries);
  }
  return { ...window, runtime: nextRuntime, deliveries };
}
