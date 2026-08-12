import type { PatchState } from '../../../packages/connection-engine/src/index';
import { createLiveEventRuntime, type LiveEventRuntimeState } from '../../../packages/live-event-runtime/src/index';
import {
  createM02PatchSource,
  m02OutputLevelsAt,
  publishM02EventWindow,
  resetM02PatchSource,
  updateM02PatchSource,
  type M02OutputLevels,
  type M02PatchSourceControls,
  type M02PatchSourceState,
} from '../../../packages/m02-patch-source/src/index';
import {
  applyM05DeliveredEvents,
  createM05ExternalEnvelope,
  releaseM05ExternalGate,
  resetM05ExternalEnvelope,
  sampleM05ExternalEnvelope,
  updateM05ExternalEnvelopeControls,
  type M05ExternalEnvelopeControls,
  type M05ExternalEnvelopeState,
} from '../../../packages/m05-external-envelope/src/index';
import type { EnvelopeStage } from '../../../packages/envelope-model/src/index';

export type PatchCanvasTimingSnapshot = {
  m02Controls: M02PatchSourceControls;
  m02Levels: M02OutputLevels;
  m05Controls: M05ExternalEnvelopeControls;
  m05Stage: EnvelopeStage;
  m05GateHigh: boolean;
  m05Voltage: number;
  gateCableConnected: boolean;
  triggerCableConnected: boolean;
  deliveriesThisWindow: number;
};

const M02_GATE_SOURCE = 'clock-and-trigger:gate';
const M02_TRIGGER_SOURCE = 'clock-and-trigger:trigger';
const M05_GATE_DESTINATION = 'envelope:gate';
const M05_TRIGGER_DESTINATION = 'envelope:trigger';

function hasExactCable(state: PatchState, sourceEndpointId: string, destinationEndpointId: string): boolean {
  return state.connections.some((connection) =>
    connection.sourceEndpointId === sourceEndpointId &&
    connection.destinationEndpointId === destinationEndpointId &&
    connection.compatibility.level === 'direct',
  );
}

function hasM02GateDeliveryCable(state: PatchState): boolean {
  return state.connections.some((connection) =>
    connection.sourceEndpointId.startsWith('clock-and-trigger:') &&
    connection.destinationEndpointId === M05_GATE_DESTINATION &&
    connection.compatibility.level === 'direct',
  );
}

export class PatchCanvasTimingController {
  private eventRuntime: LiveEventRuntimeState;
  private m02: M02PatchSourceState;
  private m05: M05ExternalEnvelopeState;
  private lastSampleAtMs: number;
  private latest: PatchCanvasTimingSnapshot;

  constructor(atMs: number) {
    if (!Number.isFinite(atMs)) throw new Error('Patch Canvas timing start must be finite.');
    this.eventRuntime = createLiveEventRuntime();
    this.m02 = createM02PatchSource({}, atMs);
    this.m05 = createM05ExternalEnvelope({}, atMs);
    this.lastSampleAtMs = atMs;
    const envelope = sampleM05ExternalEnvelope(this.m05, atMs);
    this.m05 = envelope.state;
    this.latest = {
      m02Controls: this.m02.controls,
      m02Levels: m02OutputLevelsAt(this.m02, atMs),
      m05Controls: this.m05.controls,
      m05Stage: envelope.snapshot.stage,
      m05GateHigh: envelope.snapshot.gate,
      m05Voltage: envelope.snapshot.voltage,
      gateCableConnected: false,
      triggerCableConnected: false,
      deliveriesThisWindow: 0,
    };
  }

  sample(patch: PatchState, observedAtMs: number): PatchCanvasTimingSnapshot {
    if (observedAtMs < this.lastSampleAtMs) {
      throw new Error('Patch Canvas timing samples must be chronological.');
    }
    const published = publishM02EventWindow(
      this.eventRuntime,
      patch,
      this.m02,
      this.lastSampleAtMs,
      observedAtMs,
    );
    this.eventRuntime = published.runtime;
    this.m05 = applyM05DeliveredEvents(this.m05, published.deliveries);

    if (!hasM02GateDeliveryCable(patch) && this.m05.externalGateHigh) {
      this.m05 = releaseM05ExternalGate(this.m05, observedAtMs);
    }

    const envelope = sampleM05ExternalEnvelope(this.m05, observedAtMs);
    this.m05 = envelope.state;
    this.lastSampleAtMs = observedAtMs;
    this.latest = {
      m02Controls: this.m02.controls,
      m02Levels: published.levelsAtEnd,
      m05Controls: this.m05.controls,
      m05Stage: envelope.snapshot.stage,
      m05GateHigh: envelope.snapshot.gate,
      m05Voltage: envelope.snapshot.voltage,
      gateCableConnected: hasExactCable(patch, M02_GATE_SOURCE, M05_GATE_DESTINATION),
      triggerCableConnected: hasExactCable(patch, M02_TRIGGER_SOURCE, M05_TRIGGER_DESTINATION),
      deliveriesThisWindow: published.deliveries.filter((delivery) =>
        delivery.destinationEndpointId === M05_GATE_DESTINATION || delivery.destinationEndpointId === M05_TRIGGER_DESTINATION,
      ).length,
    };
    return this.latest;
  }

  /** Call immediately after a PatchState mutation to avoid retroactively routing old edges. */
  reconcilePatch(patch: PatchState, observedAtMs: number): PatchCanvasTimingSnapshot {
    if (observedAtMs < this.lastSampleAtMs) throw new Error('Patch reconciliation must be chronological.');
    if (!hasM02GateDeliveryCable(patch) && this.m05.externalGateHigh) {
      this.m05 = releaseM05ExternalGate(this.m05, observedAtMs);
    } else {
      this.m05 = sampleM05ExternalEnvelope(this.m05, observedAtMs).state;
    }
    this.lastSampleAtMs = observedAtMs;
    const envelope = sampleM05ExternalEnvelope(this.m05, observedAtMs);
    this.latest = {
      ...this.latest,
      m02Controls: this.m02.controls,
      m02Levels: m02OutputLevelsAt(this.m02, observedAtMs),
      m05Controls: this.m05.controls,
      m05Stage: envelope.snapshot.stage,
      m05GateHigh: envelope.snapshot.gate,
      m05Voltage: envelope.snapshot.voltage,
      gateCableConnected: hasExactCable(patch, M02_GATE_SOURCE, M05_GATE_DESTINATION),
      triggerCableConnected: hasExactCable(patch, M02_TRIGGER_SOURCE, M05_TRIGGER_DESTINATION),
      deliveriesThisWindow: 0,
    };
    return this.latest;
  }

  updateM02(controls: Partial<M02PatchSourceControls>, observedAtMs: number): void {
    this.m02 = updateM02PatchSource(this.m02, controls, observedAtMs);
    this.lastSampleAtMs = observedAtMs;
  }

  resetM02(observedAtMs: number): void {
    this.m02 = resetM02PatchSource(this.m02, observedAtMs);
    this.lastSampleAtMs = observedAtMs;
  }

  updateM05(controls: Partial<M05ExternalEnvelopeControls>, observedAtMs: number): void {
    this.m05 = updateM05ExternalEnvelopeControls(this.m05, controls, observedAtMs);
    this.lastSampleAtMs = observedAtMs;
  }

  resetM05(observedAtMs: number): void {
    this.m05 = resetM05ExternalEnvelope(this.m05, observedAtMs);
    this.lastSampleAtMs = observedAtMs;
  }

  snapshot(): PatchCanvasTimingSnapshot {
    return this.latest;
  }
}

export function m02RackControlsMarkup(snapshot: PatchCanvasTimingSnapshot): string {
  const controls = snapshot.m02Controls;
  const divisionOptions = [1, 2, 4, 8].map((value) => '<option value="' + value + '"' + (controls.division === value ? ' selected' : '') + '>÷' + value + '</option>').join('');
  const multiplicationOptions = [1, 2, 4, 8].map((value) => '<option value="' + value + '"' + (controls.multiplication === value ? ' selected' : '') + '>×' + value + '</option>').join('');
  return '<section class="patch-rack-controls"><h4>Controls</h4><p class="patch-rack-control-status"><b>Live M02 timing source</b> · event edges are preserved even between animation frames.</p>' +
    '<label>Tempo <input data-m02-bpm type="range" min="30" max="240" step="1" value="' + controls.bpm + '"><output>' + Math.round(controls.bpm) + ' BPM</output></label>' +
    '<label>Gate / pulse width <input data-m02-pulse-width type="range" min=".05" max=".95" step=".01" value="' + controls.pulseWidth + '"><output>' + Math.round(controls.pulseWidth * 100) + '%</output></label>' +
    '<label>Swing <input data-m02-swing type="range" min="0" max=".45" step=".01" value="' + controls.swing + '"><output>' + Math.round(controls.swing * 100) + '%</output></label>' +
    '<label>Division <select data-m02-division>' + divisionOptions + '</select></label>' +
    '<label>Multiplication <select data-m02-multiplication>' + multiplicationOptions + '</select></label>' +
    '<button type="button" data-m02-reset>Reset clock phase</button>' +
    '<p class="patch-rack-control-status">Beat <b data-m02-beat>' + snapshot.m02Levels.beat + '</b> · Clock <span data-m02-clock-level>' + (snapshot.m02Levels.clock ? '5 V' : '0 V') + '</span> · Gate <span data-m02-gate-level>' + (snapshot.m02Levels.gate ? '5 V' : '0 V') + '</span> · Trigger <span data-m02-trigger-level>' + (snapshot.m02Levels.trigger ? '5 V' : '0 V') + '</span>.</p></section>';
}

export function m05RackControlsMarkup(snapshot: PatchCanvasTimingSnapshot): string {
  const controls = snapshot.m05Controls;
  return '<section class="patch-rack-controls"><h4>Controls</h4><p class="patch-rack-control-status"><b>Live M05 ADSR</b> · accepted envelope model driven only by delivered Gate/Trigger events.</p>' +
    '<label>Attack <input data-m05-attack type="range" min="0" max="3000" step="10" value="' + controls.attackMs + '"><output>' + Math.round(controls.attackMs) + ' ms</output></label>' +
    '<label>Decay <input data-m05-decay type="range" min="0" max="3000" step="10" value="' + controls.decayMs + '"><output>' + Math.round(controls.decayMs) + ' ms</output></label>' +
    '<label>Sustain <input data-m05-sustain type="range" min="0" max="1" step=".01" value="' + controls.sustainLevel + '"><output>' + Math.round(controls.sustainLevel * 100) + '%</output></label>' +
    '<label>Release <input data-m05-release type="range" min="0" max="5000" step="10" value="' + controls.releaseMs + '"><output>' + Math.round(controls.releaseMs) + ' ms</output></label>' +
    '<label>Trigger gate length <input data-m05-trigger-length type="range" min="20" max="1200" step="10" value="' + controls.triggerLengthMs + '"><output>' + Math.round(controls.triggerLengthMs) + ' ms</output></label>' +
    '<button type="button" data-m05-reset>Reset envelope</button>' +
    '<p class="patch-rack-control-status">Stage <b data-m05-stage>' + snapshot.m05Stage + '</b> · Gate <span data-m05-gate-state>' + (snapshot.m05GateHigh ? 'high' : 'low') + '</span> · Output <span data-m05-voltage>' + snapshot.m05Voltage.toFixed(2) + ' V</span> · M02 Gate cable <span data-m02-m05-gate-state>' + (snapshot.gateCableConnected ? 'connected' : 'not connected') + '</span> · Trigger cable <span data-m02-m05-trigger-state>' + (snapshot.triggerCableConnected ? 'connected' : 'not connected') + '</span>.</p></section>';
}

export function timingWorkbenchMarkup(snapshot: PatchCanvasTimingSnapshot): string {
  const gateControl = snapshot.gateCableConnected
    ? '<p class="patch-canvas-status ready">Real M02 Gate → M05 Gate cable connected.</p>'
    : '<button type="button" data-build-m02-m05-gate>Connect M02 Gate → M05 Gate</button>';
  const triggerControl = snapshot.triggerCableConnected
    ? '<p class="patch-canvas-status ready">Real M02 Trigger → M05 Trigger cable connected.</p>'
    : '<button type="button" data-build-m02-m05-trigger>Connect M02 Trigger → M05 Trigger</button>';
  return '<section class="patch-canvas-learning panel"><p class="eyebrow">M02 → M05 live timing · real event cables</p><h3>Let timing shape the real envelope</h3><p>Gate holds M05 sustain for the full high interval. Trigger rising starts M05’s explicit one-shot gesture; the short physical trigger pulse is preserved as evidence but does not truncate the envelope.</p><div class="button-row">' + gateControl + triggerControl + '</div><p><b>M05:</b> <span data-m05-stage>' + snapshot.m05Stage + '</span> · <span data-m05-voltage>' + snapshot.m05Voltage.toFixed(2) + ' V</span>. That voltage reaches the VCA only if the existing Envelope → VCA CV cable is present.</p><p class="patch-canvas-boundary">Unplugging the Gate cable releases an active external hold. Unplugging Trigger stops future trigger gestures but lets an already-started one-shot finish.</p></section>';
}

export function m02ControlChange(target: HTMLInputElement | HTMLSelectElement): Partial<M02PatchSourceControls> | undefined {
  if (target.matches('[data-m02-bpm]')) return { bpm: Number(target.value) };
  if (target.matches('[data-m02-pulse-width]')) return { pulseWidth: Number(target.value) };
  if (target.matches('[data-m02-swing]')) return { swing: Number(target.value) };
  if (target.matches('[data-m02-division]')) return { division: Number(target.value) as M02PatchSourceControls['division'] };
  if (target.matches('[data-m02-multiplication]')) return { multiplication: Number(target.value) as M02PatchSourceControls['multiplication'] };
  return undefined;
}

export function m05ControlChange(target: HTMLInputElement | HTMLSelectElement): Partial<M05ExternalEnvelopeControls> | undefined {
  if (target.matches('[data-m05-attack]')) return { attackMs: Number(target.value) };
  if (target.matches('[data-m05-decay]')) return { decayMs: Number(target.value) };
  if (target.matches('[data-m05-sustain]')) return { sustainLevel: Number(target.value) };
  if (target.matches('[data-m05-release]')) return { releaseMs: Number(target.value) };
  if (target.matches('[data-m05-trigger-length]')) return { triggerLengthMs: Number(target.value) };
  return undefined;
}
