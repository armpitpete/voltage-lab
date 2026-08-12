import {
  createPatchCanvasProposal,
  listPatchCanvasRackModules,
  type PatchCanvasProposal,
} from '../../../packages/patch-canvas/src/index';
import { voltageLabModules } from '../../../packages/module-interface/src/modules';
import {
  connectPorts,
  createPatchState,
  disconnectPort,
  type ConnectionId,
  type PatchState,
} from '../../../packages/connection-engine/src/index';
import { visualisePatchState } from '../../../packages/visual-patch-cables/src/index';
import { BrowserFullSynthVoice } from '../../../packages/full-synth-voice/src/browser';
import {
  normaliseFullSynthVoiceControls,
  pitchCvToFrequency,
  planFullSynthVoice,
  planFullSynthVoiceSource,
  REQUIRED_VOICE_CABLES,
  type FullSynthVoiceControls,
} from '../../../packages/full-synth-voice/src/index';
import { createLiveSignalRuntime, observeLiveSignal, publishSignal, type LiveSignalRuntimeState } from '../../../packages/live-signal-runtime/src/index';
import { inspectSignal } from '../../../packages/signal-inspector/src/index';
import { readOscillatorOutput } from '../../../packages/oscillator-output-runtime/src/index';
import { createBrowserAudioSource, type BrowserAudioSource } from '../../../packages/browser-audio-boundary/src/index';
import type { ModulePortContract, PortEndpointId } from '../../../packages/port-contracts/src/index';
import {
  createM09PatchSource,
  normaliseM09PatchSourceControls,
  publishM09PatchSource,
  sampleM09FilterCutoff,
  updateM09PatchSource,
  type M09PatchSourceControls,
  type M09PatchSourceState,
} from '../../../packages/m09-patch-source/src/index';

const moduleRoutes = new Map(voltageLabModules.map((module) => [module.id, module.route]));
const M09_FILTER_SOURCE = 'lfo-modulation:lfo' as PortEndpointId;
const M09_FILTER_DESTINATION = 'filter:cutoff' as PortEndpointId;

function portButtonMarkup(port: ModulePortContract, role: 'input' | 'output', selected: PortEndpointId | undefined, rejected: PortEndpointId | undefined): string {
  const selectedClass = selected === port.endpointId ? ' selected' : '';
  const rejectedClass = rejected === port.endpointId ? ' rejected' : '';
  const dataAttribute = role === 'output' ? 'data-patch-canvas-output' : 'data-patch-canvas-input';
  return '<button type="button" class="patch-rack-port ' + role + selectedClass + rejectedClass + '" ' + dataAttribute + '="' + port.endpointId + '" aria-pressed="' + (selected === port.endpointId ? 'true' : 'false') + '" aria-invalid="' + (rejected === port.endpointId ? 'true' : 'false') + '">' +
    '<span class="patch-rack-jack" aria-hidden="true"></span><span><b>' + port.label + '</b><small>' + port.signalType + ' · ' + port.range.minimum + ' to ' + port.range.maximum + ' ' + port.range.unit + '</small></span></button>';
}

function moduleControlsMarkup(
  moduleId: string,
  controls: FullSynthVoiceControls,
  localCutoffCv: number,
  envelopeValue: number,
  oscillatorSourceActive: boolean,
  m09Controls: M09PatchSourceControls,
  m09SourceActive: boolean,
  m09SourceVoltage: number | undefined,
  m09CutoffConnected: boolean,
): string {
  const liveLabel = '<p class="patch-rack-control-status"><b>Live voice control</b> · shared with the safe monitor below.</p>';
  if (moduleId === 'oscillator') {
    const waveformOptions = ['sawtooth', 'square', 'triangle', 'sine', 'pulse'].map((waveform) =>
      '<option value="' + waveform + '"' + (controls.waveform === waveform ? ' selected' : '') + '>' +
      ({ sawtooth: 'Saw', square: 'Square', triangle: 'Triangle', sine: 'Sine', pulse: 'Pulse' } as Record<string, string>)[waveform] + '</option>',
    ).join('');
    const sourceState = oscillatorSourceActive
      ? '<p class="patch-rack-control-status"><b>M03 source active</b> · its visible settings feed the Browser Audio Boundary.</p>'
      : '<p class="patch-rack-control-status">No source is active. Publish these visible M03 settings before starting the patch voice.</p>';
    return '<section class="patch-rack-controls"><h4>Controls</h4>' + liveLabel + sourceState +
      '<label>Waveform <select data-full-voice-waveform>' + waveformOptions + '</select></label>' +
      '<label>Pitch CV <input data-full-voice-pitch type="range" min="-3" max="3" step=".01" value="' + controls.pitchCv + '"><output>' + controls.pitchCv.toFixed(2) + ' V</output></label>' +
      '<label>Amplitude <input data-full-voice-amplitude type="range" min="0" max="5" step=".1" value="' + controls.sourceAmplitudeVolts + '"><output>±' + controls.sourceAmplitudeVolts.toFixed(1) + ' V</output></label>' +
      '<label>Pulse width <input data-full-voice-pulse-width type="range" min=".05" max=".95" step=".01" value="' + controls.pulseWidth + '"><output>' + Math.round(controls.pulseWidth * 100) + '%</output></label>' +
      '<button type="button" data-full-voice-publish-source>' + (oscillatorSourceActive ? 'Refresh M03 patch source' : 'Use as M03 patch source') + '</button></section>';
  }
  if (moduleId === 'filter') {
    return '<section class="patch-rack-controls"><h4>Controls</h4>' + liveLabel +
      '<label>Local Cutoff CV <input data-full-voice-cutoff type="range" min="-5" max="5" step=".01" value="' + localCutoffCv + '"><output>' + localCutoffCv.toFixed(2) + ' V</output></label>' +
      '<p class="patch-rack-control-status">Effective cutoff CV: <b data-m09-effective-cutoff>' + controls.cutoffCv.toFixed(2) + ' V</b>. A real M09 → Cutoff cable overrides the local value while the M09 source is active.</p></section>';
  }
  if (moduleId === 'envelope') {
    return '<section class="patch-rack-controls"><h4>Controls</h4>' + liveLabel +
      '<label>Envelope CV output <input data-live-envelope-cv type="range" min="0" max="5" step=".01" value="' + envelopeValue + '"><output>' + envelopeValue.toFixed(2) + ' V</output></label></section>';
  }
  if (moduleId === 'vca-mixer') {
    return '<section class="patch-rack-controls"><h4>Controls</h4>' + liveLabel +
      '<label>Output level <input data-full-voice-level type="range" min="0" max=".16" step=".01" value="' + controls.level + '"><output>' + controls.level.toFixed(2) + '</output></label></section>';
  }
  if (moduleId === 'lfo-modulation') {
    const waveformLabels: Record<M09PatchSourceControls['waveform'], string> = {
      sine: 'Sine', triangle: 'Triangle', square: 'Square', 'saw-up': 'Rising saw', 'saw-down': 'Falling saw', 'stepped-random': 'Stepped random',
    };
    const waveformOptions = (Object.keys(waveformLabels) as M09PatchSourceControls['waveform'][]).map((waveform) =>
      '<option value="' + waveform + '"' + (m09Controls.waveform === waveform ? ' selected' : '') + '>' + waveformLabels[waveform] + '</option>',
    ).join('');
    const sourceState = m09SourceActive
      ? '<p class="patch-rack-control-status"><b>M09 source active</b> · source <span data-m09-source-voltage>' + (m09SourceVoltage === undefined ? '—' : m09SourceVoltage.toFixed(2) + ' V') + '</span> · filter cable <span data-m09-connection-state>' + (m09CutoffConnected ? 'driving Cutoff CV' : 'not connected') + '</span>.</p>'
      : '<p class="patch-rack-control-status">M09 is not active yet. Its controls are visible, but no moving voltage exists until you use the source button.</p>';
    return '<section class="patch-rack-controls"><h4>Controls</h4><p class="patch-rack-control-status"><b>Live M09 source</b> · exact accepted waveform semantics with explicit ±5 V output clamp.</p>' + sourceState +
      '<label>Shape <select data-m09-waveform>' + waveformOptions + '</select></label>' +
      '<label>Rate <input data-m09-rate type="range" min=".05" max="20" step=".05" value="' + m09Controls.rateHz + '"><output>' + m09Controls.rateHz.toFixed(2) + ' Hz</output></label>' +
      '<label>Amplitude <input data-m09-amplitude type="range" min="0" max="5" step=".1" value="' + m09Controls.amplitudeVolts + '"><output>±' + m09Controls.amplitudeVolts.toFixed(1) + ' V</output></label>' +
      '<label>Offset <input data-m09-offset type="range" min="-5" max="5" step=".1" value="' + m09Controls.offsetVolts + '"><output>' + m09Controls.offsetVolts.toFixed(1) + ' V</output></label>' +
      '<label>Phase <input data-m09-phase type="range" min="-180" max="180" step="1" value="' + m09Controls.phaseDegrees + '"><output>' + Math.round(m09Controls.phaseDegrees) + '°</output></label>' +
      '<label>Random seed <input data-m09-seed type="number" min="1" max="32" step="1" value="' + m09Controls.seed + '"><output>' + m09Controls.seed + '</output></label>' +
      '<button type="button" data-m09-publish-source>' + (m09SourceActive ? 'Refresh M09 patch source' : 'Use as M09 patch source') + '</button></section>';
  }
  return '<section class="patch-rack-controls unavailable"><h4>Controls</h4><p>No shared live control yet. This module remains fully patchable; its detailed Lab is still the working teaching surface.</p></section>';
}

function rackMarkup(
  sourceEndpointId: PortEndpointId | undefined,
  destinationEndpointId: PortEndpointId | undefined,
  rejectedDestinationEndpointId: PortEndpointId | undefined,
  controls: FullSynthVoiceControls,
  localCutoffCv: number,
  envelopeValue: number,
  oscillatorSourceActive: boolean,
  m09Controls: M09PatchSourceControls,
  m09SourceActive: boolean,
  m09SourceVoltage: number | undefined,
  m09CutoffConnected: boolean,
): string {
  return listPatchCanvasRackModules().map((module) => {
    const route = moduleRoutes.get(module.moduleId);
    const inputs = module.inputs.length
      ? module.inputs.map((port) => portButtonMarkup(port, 'input', destinationEndpointId, rejectedDestinationEndpointId)).join('')
      : '<p class="patch-rack-empty">No declared inputs</p>';
    const outputs = module.outputs.length
      ? module.outputs.map((port) => portButtonMarkup(port, 'output', sourceEndpointId, undefined)).join('')
      : '<p class="patch-rack-empty">No declared outputs</p>';
    return '<article class="patch-rack-module" data-patch-module="' + module.moduleId + '">' +
      '<header><span class="patch-rack-number">M' + String(module.moduleNumber).padStart(2, '0') + '</span><div><h3>' + module.moduleTitle + '</h3><p>' + (route ? 'Patch points and detailed controls' : 'Explicit signal-representation bridge') + '</p></div></header>' +
      '<div class="patch-rack-ports"><section><h4>Inputs</h4>' + inputs + '</section><section><h4>Outputs</h4>' + outputs + '</section></div>' +
      moduleControlsMarkup(module.moduleId, controls, localCutoffCv, envelopeValue, oscillatorSourceActive, m09Controls, m09SourceActive, m09SourceVoltage, m09CutoffConnected) +
      (route ? '<a class="patch-rack-lab-link" href="' + route + '">Open detailed Lab</a>' : '') +
      '</article>';
  }).join('');
}

function sourceId(value: string): PortEndpointId | undefined {
  return value ? value as PortEndpointId : undefined;
}

function browserWaveformForControl(waveform: FullSynthVoiceControls['waveform']): BrowserAudioSource['waveform'] {
  switch (waveform) {
    case 'sawtooth': return 'saw';
    case 'pulse': return 'pulse';
    case 'sine':
    case 'square':
    case 'triangle': return waveform;
    default: return 'sine';
  }
}

function statusText(proposal: PatchCanvasProposal): { label: string; tone: string } {
  switch (proposal.stage) {
    case 'choose-output':
      return { label: 'Choose an output', tone: 'neutral' };
    case 'choose-input':
      return { label: 'Choose an input', tone: 'neutral' };
    case 'proposal-ready':
      return proposal.compatibility?.level === 'direct'
        ? { label: 'Directly compatible', tone: 'ready' }
        : { label: 'Compatible with an explicit adaptation', tone: 'adaptation' };
    case 'proposal-rejected':
      return { label: 'Not compatible', tone: 'rejected' };
  }
}

function proposedRouteMarkup(proposal: PatchCanvasProposal): string {
  if (!proposal.route || !proposal.source || !proposal.destination) {
    return '<section class="patch-canvas-route panel empty-route"><h3>Proposed route</h3><p>Select an output and an input to inspect a route. Nothing is connected here.</p></section>';
  }
  const status = statusText(proposal);
  const canConnect = proposal.compatibility?.level === 'direct';
  return '<section class="patch-canvas-route panel" data-patch-canvas-route="' + proposal.route.style + '">' +
    '<div class="patch-canvas-route-heading"><div><p class="eyebrow">Proposed route · not connected</p><h3>' + proposal.route.label + '</h3></div>' +
    '<span class="patch-canvas-status ' + status.tone + '">' + status.label + '</span></div>' +
    '<svg class="patch-canvas-diagram" viewBox="0 0 1000 180" preserveAspectRatio="none" role="img" aria-label="Proposed signal direction from selected output to selected input">' +
    '<defs><marker id="patch-canvas-proposal-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>' +
    '<line x1="250" y1="90" x2="750" y2="90" marker-end="url(#patch-canvas-proposal-arrow)"/></svg>' +
    '<div class="patch-canvas-endpoints"><div><small>Output</small><b>' + proposal.source.moduleTitle + '</b><span>' + proposal.source.label + ' · ' + proposal.source.signalType + '</span></div>' +
    '<div><small>Input</small><b>' + proposal.destination.moduleTitle + '</b><span>' + proposal.destination.label + ' · ' + proposal.destination.signalType + '</span></div></div>' +
    '<div class="patch-canvas-explanation"><p><b>Compatibility:</b> ' + proposal.compatibility?.reason + '</p><p>' + proposal.teachingNote + '</p></div>' +
    (canConnect
      ? '<button type="button" class="patch-canvas-connect" data-patch-canvas-connect>Connect these sockets</button>'
      : '<p class="patch-canvas-boundary">This route cannot become a cable until its required adaptation exists.</p>') +
    '</section>';
}

function connectedCablesMarkup(state: PatchState): string {
  const visual = visualisePatchState(state);
  if (!visual.cables.length) {
    return '<section class="patch-canvas-cables panel"><div><p class="eyebrow">Actual patch cables</p><h3>No cable connected</h3><p>Choose a directly compatible route, then connect it. Real cables carry the connection state created by Connection Engine.</p></div></section>';
  }
  const lines = visual.cables.map((cable, index) => {
    const y = 48 + index * 54;
    return '<g><line x1="180" y1="' + y + '" x2="820" y2="' + y + '" marker-end="url(#patch-canvas-live-arrow)"/>' +
      '<circle cx="180" cy="' + y + '" r="8"/><circle cx="820" cy="' + y + '" r="8"/></g>';
  }).join('');
  const rows = visual.cables.map((cable) =>
    '<li><div><b>' + cable.source.label + ' → ' + cable.destination.label + '</b><span>' + cable.source.moduleTitle + ' output to ' + cable.destination.moduleTitle + ' input · ' + cable.signalType + '</span></div>' +
    '<button type="button" data-patch-canvas-disconnect="' + cable.connectionId + '" aria-label="Remove ' + cable.accessibleLabel + '">Remove</button></li>',
  ).join('');
  return '<section class="patch-canvas-cables panel"><div class="patch-canvas-route-heading"><div><p class="eyebrow">Actual patch cables · connected</p><h3>' + visual.cables.length + ' live route' + (visual.cables.length === 1 ? '' : 's') + '</h3></div><span class="patch-canvas-status ready">Signal direction shown</span></div>' +
    '<svg class="patch-canvas-live-diagram" viewBox="0 0 1000 ' + (96 + visual.cables.length * 54) + '" preserveAspectRatio="none" role="img" aria-label="' + visual.cables.map((cable) => cable.accessibleLabel).join('; ') + '">' +
    '<defs><marker id="patch-canvas-live-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>' + lines + '</svg>' +
    '<ul class="patch-canvas-cable-list">' + rows + '</ul>' +
    (visual.problems.length ? '<p class="patch-canvas-boundary">' + visual.problems.map((problem) => problem.reason).join(' ') + '</p>' : '') +
    '</section>';
}

function fullSynthVoiceMarkup(state: PatchState, runtime: LiveSignalRuntimeState, controls: FullSynthVoiceControls, localCutoffCv: number, source: BrowserAudioSource | undefined): string {
  const plan = planFullSynthVoice(state);
  const sourcePlan = planFullSynthVoiceSource(source);
  const envelopeInspection = inspectSignal(observeLiveSignal(runtime, 'envelope:envelope'));
  const vcaInspection = inspectSignal(observeLiveSignal(runtime, 'vca-mixer:vca-cv'));
  const envelopeValue = envelopeInspection?.range.value ?? 5;
  const deliveredValue = vcaInspection?.range.value;
  const cables = plan.requiredCables.map((cable) =>
    '<li><b>' + cable.label + '</b><span>' + cable.purpose + '</span></li>',
  ).join('');
  const readiness = plan.ready
    ? '<p class="patch-canvas-status ready">Complete real cable set: this reference voice can now start.</p>'
    : '<p class="patch-canvas-boundary"><b>Still needed:</b> ' + plan.missingCables.map((cable) => cable.label).join('; ') + '.</p>';
  const actions = plan.ready && sourcePlan.ready
    ? '<div class="full-synth-voice-controls"><p class="patch-canvas-boundary"><b>Module 03 source:</b> ' + sourcePlan.reason + ' Browser boundary peak: ' + source?.normalisedPeak.toFixed(2) + '.</p><label>Local Cutoff CV <input data-full-voice-cutoff type="range" min="-5" max="5" step=".01" value="' + localCutoffCv + '"></label><label>Envelope CV source <input data-live-envelope-cv type="range" min="0" max="5" step=".01" value="' + envelopeValue + '"></label><p class="patch-canvas-boundary"><b>Effective filter CV:</b> <span data-m09-effective-cutoff>' + controls.cutoffCv.toFixed(2) + ' V</span>. <b>Live Inspector:</b> Envelope output ' + (envelopeInspection?.range.value ?? 'not published') + ' V → VCA input ' + (deliveredValue ?? 'not connected') + ' V.</p><div class="button-row"><button type="button" data-full-voice-start>Start Module 03 source</button><button type="button" data-full-voice-note>Play short note</button><button type="button" data-full-voice-stop>Panic / stop</button></div></div>'
    : plan.ready
      ? '<p class="patch-canvas-boundary">' + sourcePlan.reason + ' <a href="#/oscillator">Open Oscillator Lab</a>.</p>'
    : '<button type="button" data-build-full-voice>Build these four real cables</button>';
  return '<section class="patch-canvas-learning panel full-synth-voice"><p class="eyebrow">Full Synth Voice v1.0 · real patch monitor</p><h3>Hear the patched audio and control paths</h3><p>This safe monitor uses Module 03’s published source configuration only through the explicit Browser Audio Boundary.</p><ol class="full-synth-voice-cables">' + cables + '</ol>' + readiness + actions + '<p class="patch-canvas-boundary">The browser re-renders the published Module 03 configuration; it does not transport Module 03’s original AudioNode between routes.</p></section>';
}

function hasM09FilterCable(state: PatchState): boolean {
  return state.connections.some((connection) =>
    connection.sourceEndpointId === M09_FILTER_SOURCE &&
    connection.destinationEndpointId === M09_FILTER_DESTINATION &&
    connection.compatibility.level === 'direct',
  );
}

function m09FilterModulationMarkup(
  state: PatchState,
  sourceActive: boolean,
  sourceVoltage: number | undefined,
  cutoffConnected: boolean,
  effectiveCutoffCv: number,
): string {
  const cablePresent = hasM09FilterCable(state);
  const cableControl = cablePresent
    ? '<p class="patch-canvas-status ready">Real M09 LFO → Filter Cutoff cable connected.</p>'
    : '<button type="button" data-build-m09-filter-patch>Connect M09 LFO → Filter Cutoff</button>';
  const sourceState = sourceActive
    ? '<p><b>M09 source:</b> <span data-m09-source-voltage>' + (sourceVoltage === undefined ? '—' : sourceVoltage.toFixed(2) + ' V') + '</span>. <b>Filter route:</b> <span data-m09-connection-state>' + (cutoffConnected ? 'driving Cutoff CV' : 'not receiving M09') + '</span>. <b>Effective cutoff:</b> <span data-m09-effective-cutoff>' + effectiveCutoffCv.toFixed(2) + ' V</span>.</p>'
    : '<p>M09 controls are available on its rack card. Use <b>Use as M09 patch source</b> to create the moving voltage explicitly.</p>';
  return '<section class="patch-canvas-learning panel"><p class="eyebrow">M09 live modulation · real cable path</p><h3>Make the LFO move the filter</h3><p>This first moving-CV route is direct: M09 LFO CV and M07 Cutoff CV are both declared −5 to +5 V. No hidden scaling or adapter is used.</p>' + cableControl + sourceState + '<p class="patch-canvas-boundary">With the full voice running, change M09 rate, amplitude, offset, phase or shape. Removing this cable immediately returns the filter to its local Cutoff CV value.</p></section>';
}

export function mountPatchCanvas(root: HTMLElement): () => void {
  root.innerHTML = '<section class="module-header"><div><p class="eyebrow">Modular Playground · Full Synth Rack v1.1</p><h2>Patch the whole instrument</h2><p>Every declared module and socket is here at once. The current audible voice and M09 LFO controls live on their own rack cards; unintegrated modules say so plainly.</p></div></section>' +
    '<section class="patch-rack-intro panel"><h3>One visible rack</h3><p>The detailed Labs remain useful for slow learning. This is the instrument view: all nine modules, their patch points and the live patch evidence are kept together.</p><p class="patch-canvas-boundary">Click an <b>output</b> socket, then an <b>input</b> socket. Directly compatible routes can become cables; incompatible or adaptation-required routes stay explicit.</p></section>' +
    '<section class="patch-rack-shell" data-patch-canvas-rack-shell><svg class="patch-rack-cable-layer" data-patch-canvas-cable-layer role="group" aria-label="Patch cables. Click a cable to remove it."></svg><section class="patch-canvas-rack" data-patch-canvas-rack aria-label="Voltage Lab modular synth rack"></section></section>' +
    '<section class="patch-canvas-grid patch-canvas-instrument-grid"><aside class="patch-canvas-controls panel"><h3>Patch selection</h3><p data-patch-canvas-selection>Choose an output socket in the rack.</p><button type="button" data-patch-canvas-clear>Clear selection</button><p class="patch-canvas-boundary">The rack exposes every declared patch point. A module’s standalone detailed controls remain in its Lab until its real runtime has been integrated here.</p></aside>' +
    '<div class="patch-canvas-workbench" data-patch-canvas-workbench></div></section>';

  const rackShell = root.querySelector<HTMLElement>('[data-patch-canvas-rack-shell]');
  const cableLayer = root.querySelector<SVGSVGElement>('[data-patch-canvas-cable-layer]');
  const rack = root.querySelector<HTMLElement>('[data-patch-canvas-rack]');
  const selection = root.querySelector<HTMLElement>('[data-patch-canvas-selection]');
  const clear = root.querySelector<HTMLButtonElement>('[data-patch-canvas-clear]');
  const workbench = root.querySelector<HTMLElement>('[data-patch-canvas-workbench]');
  if (!rackShell || !cableLayer || !rack || !selection || !clear || !workbench) throw new Error('Patch Canvas rack controls are missing.');

  let state = createPatchState();
  let sourceEndpointId: PortEndpointId | undefined;
  let destinationEndpointId: PortEndpointId | undefined;
  let rejectedDestinationEndpointId: PortEndpointId | undefined;
  let message = '';
  let voice: BrowserFullSynthVoice | undefined;
  let voiceControls = normaliseFullSynthVoiceControls({ vcaCv: 0 });
  let localFilterCutoffCv = voiceControls.cutoffCv;
  let runtime = createLiveSignalRuntime();
  let canvasOscillatorSource: BrowserAudioSource | undefined;
  let m09Controls = normaliseM09PatchSourceControls();
  let m09Source: M09PatchSourceState | undefined;
  let m09SourceVoltage: number | undefined;
  let m09CutoffConnected = false;
  let m09AnimationFrame = 0;
  const browserSource = () => {
    const output = readOscillatorOutput();
    return canvasOscillatorSource ?? (output ? createBrowserAudioSource(output) : undefined);
  };
  const canvasSourceFromControls = (): BrowserAudioSource => createBrowserAudioSource({
    version: '1.0',
    waveform: browserWaveformForControl(voiceControls.waveform),
    frequencyHz: pitchCvToFrequency(voiceControls.pitchCv),
    amplitudeVolts: voiceControls.sourceAmplitudeVolts,
    pulseWidth: voiceControls.pulseWidth,
    observedAt: Date.now(),
  });
  const publishOscillatorBoundary = () => {
    const source = browserSource();
    if (!source) return;
    runtime = publishSignal(runtime, state, {
      sourceEndpointId: 'oscillator:waveform', signalType: 'audio', value: source.sourcePeakVolts, observedAt: source.observedAt,
    }).state;
    runtime = publishSignal(runtime, state, {
      sourceEndpointId: 'browser-audio-boundary:normalised-output', signalType: 'audio', value: source.normalisedPeak, observedAt: source.observedAt,
    }).state;
  };
  const drawEndpointCables = () => {
    const visual = visualisePatchState(state);
    const shellRect = rackShell.getBoundingClientRect();
    const width = Math.max(rackShell.clientWidth, 1);
    const height = Math.max(rackShell.clientHeight, rackShell.scrollHeight, 1);
    const pointFor = (endpointId: string, role: 'input' | 'output') => {
      const jack = rack.querySelector<HTMLElement>('[data-patch-canvas-' + role + '="' + endpointId + '"] .patch-rack-jack');
      if (!jack) return undefined;
      const rect = jack.getBoundingClientRect();
      return { x: rect.left - shellRect.left + (rect.width / 2), y: rect.top - shellRect.top + (rect.height / 2) };
    };
    const paths = visual.cables.map((cable) => {
      const start = pointFor(cable.source.endpointId, 'output');
      const end = pointFor(cable.destination.endpointId, 'input');
      if (!start || !end) return '';
      const direction = end.x >= start.x ? 1 : -1;
      const bend = Math.max(42, Math.min(180, Math.abs(end.x - start.x) * .35));
      return '<path class="patch-rack-cable ' + cable.signalType + '" data-patch-canvas-disconnect="' + cable.connectionId + '" d="M ' + start.x + ' ' + start.y + ' C ' + (start.x + (direction * bend)) + ' ' + start.y + ', ' + (end.x - (direction * bend)) + ' ' + end.y + ', ' + end.x + ' ' + end.y + '" marker-end="url(#patch-rack-cable-arrow)" tabindex="0" role="button" aria-label="Remove ' + cable.accessibleLabel + '"/>';
    }).join('');
    cableLayer.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    cableLayer.setAttribute('aria-label', visual.cables.length ? visual.cables.map((cable) => cable.accessibleLabel).join('; ') : 'No patch cables connected.');
    cableLayer.innerHTML = '<defs><marker id="patch-rack-cable-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>' + paths;
  };

  const publishEnvelope = (value: number) => {
    const result = publishSignal(runtime, state, {
      sourceEndpointId: 'envelope:envelope', signalType: 'cv', value, observedAt: Date.now(),
    });
    runtime = result.state;
    const delivered = observeLiveSignal(runtime, 'vca-mixer:vca-cv').value;
    if (delivered !== undefined) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, vcaCv: delivered });
    else voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, vcaCv: 0 });
    message = result.reason;
    voice?.setControls(voiceControls);
  };
  const sampleM09 = (observedAt: number) => {
    if (!m09Source) {
      m09SourceVoltage = undefined;
      m09CutoffConnected = false;
      if (voiceControls.cutoffCv !== localFilterCutoffCv) {
        voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, cutoffCv: localFilterCutoffCv });
        voice?.setControls(voiceControls);
      }
      return;
    }
    const sample = sampleM09FilterCutoff(runtime, state, observedAt, localFilterCutoffCv);
    runtime = sample.runtime;
    m09SourceVoltage = sample.sourceVoltage;
    m09CutoffConnected = sample.connected;
    const effectiveCutoffCv = sample.cutoffCv;
    if (Math.abs(effectiveCutoffCv - voiceControls.cutoffCv) > 0.0001) {
      voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, cutoffCv: effectiveCutoffCv });
      voice?.setControls(voiceControls);
    }
  };
  const updateM09Readouts = () => {
    const sourceText = m09SourceVoltage === undefined ? '—' : m09SourceVoltage.toFixed(2) + ' V';
    root.querySelectorAll<HTMLElement>('[data-m09-source-voltage]').forEach((element) => { element.textContent = sourceText; });
    root.querySelectorAll<HTMLElement>('[data-m09-effective-cutoff]').forEach((element) => { element.textContent = voiceControls.cutoffCv.toFixed(2) + ' V'; });
    root.querySelectorAll<HTMLElement>('[data-m09-connection-state]').forEach((element) => { element.textContent = m09CutoffConnected ? 'driving Cutoff CV' : 'not receiving M09'; });
  };
  const animateM09 = () => {
    sampleM09(Date.now());
    updateM09Readouts();
    m09AnimationFrame = window.requestAnimationFrame(animateM09);
  };
  const render = () => {
    const proposal = createPatchCanvasProposal({
      sourceEndpointId,
      destinationEndpointId,
    });
    const envelopeValue = observeLiveSignal(runtime, 'envelope:envelope').value ?? 5;
    rack.innerHTML = rackMarkup(
      sourceEndpointId,
      destinationEndpointId,
      rejectedDestinationEndpointId,
      voiceControls,
      localFilterCutoffCv,
      envelopeValue,
      Boolean(canvasOscillatorSource),
      m09Controls,
      Boolean(m09Source),
      m09SourceVoltage,
      m09CutoffConnected,
    );
    selection.innerHTML = sourceEndpointId
      ? '<b>Output selected.</b> Choose an input socket. A directly compatible target connects immediately.'
      : (message ? '<b>Patch status:</b> ' + message : 'Choose an output socket in the rack.');
    drawEndpointCables();
    window.requestAnimationFrame(drawEndpointCables);
    workbench.innerHTML = proposedRouteMarkup(proposal) + connectedCablesMarkup(state) + fullSynthVoiceMarkup(state, runtime, voiceControls, localFilterCutoffCv, browserSource()) + m09FilterModulationMarkup(state, Boolean(m09Source), m09SourceVoltage, m09CutoffConnected, voiceControls.cutoffCv) +
      '<section class="patch-canvas-learning panel"><h3>What this teaches</h3><p>An output is a source and an input is a destination. A solid cable with an arrow means Connection Engine has accepted a directly compatible route.</p><p>' +
      (message || 'The rack now has one genuine moving-CV route: M09 can drive the Filter Cutoff only when its real cable exists.') + '</p></section>';
    updateM09Readouts();
  };

  const connect = () => {
    if (!sourceEndpointId || !destinationEndpointId) return;
    const result = connectPorts(state, sourceEndpointId, destinationEndpointId);
    state = result.state;
    message = result.reason;
    sampleM09(Date.now());
    render();
  };
  const buildFullVoicePatch = () => {
    for (const cable of REQUIRED_VOICE_CABLES) {
      const exists = state.connections.some((connection) => connection.sourceEndpointId === cable.sourceEndpointId && connection.destinationEndpointId === cable.destinationEndpointId);
      if (exists) continue;
      const result = connectPorts(state, cable.sourceEndpointId as PortEndpointId, cable.destinationEndpointId as PortEndpointId);
      state = result.state;
      if (result.status === 'rejected') { message = result.reason; render(); return; }
    }
    message = planFullSynthVoice(state).ready ? 'The four real cables are connected. The Module 03 voice monitor is ready.' : 'The voice patch could not be completed.';
    publishOscillatorBoundary();
    publishEnvelope(observeLiveSignal(runtime, 'envelope:envelope').value ?? 5);
    sampleM09(Date.now());
    render();
  };
  const buildM09FilterPatch = () => {
    if (hasM09FilterCable(state)) { message = 'The real M09 LFO → Filter Cutoff cable is already connected.'; render(); return; }
    const result = connectPorts(state, M09_FILTER_SOURCE, M09_FILTER_DESTINATION);
    state = result.state;
    message = result.status === 'connected'
      ? 'Connected M09 LFO CV to Filter Cutoff CV. The moving voltage now matters only while the M09 source is active.'
      : 'M09 filter cable was rejected: ' + result.reason;
    sampleM09(Date.now());
    render();
  };
  const stopVoice = () => { const active = voice; voice = undefined; void active?.stop(); };
  const disconnectCable = (connectionId: ConnectionId) => {
    const result = disconnectPort(state, connectionId);
    state = result.state;
    if (!planFullSynthVoice(state).ready) stopVoice();
    publishOscillatorBoundary();
    publishEnvelope(observeLiveSignal(runtime, 'envelope:envelope').value ?? 5);
    sampleM09(Date.now());
    message = result.reason;
    render();
  };
  const click = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-build-full-voice]')) { buildFullVoicePatch(); return; }
    if (target.closest('[data-build-m09-filter-patch]')) { buildM09FilterPatch(); return; }
    if (target.closest('[data-full-voice-start]')) {
      const source = browserSource();
      if (!planFullSynthVoice(state).ready || !source || voice) return;
      void BrowserFullSynthVoice.start(voiceControls, source).then((started) => { voice = started; sampleM09(Date.now()); message = 'Module 03 source started through the real cable set and explicit browser boundary.'; render(); });
      return;
    }
    if (target.closest('[data-full-voice-note]')) { voice?.gate(true); window.setTimeout(() => voice?.gate(false), 900); return; }
    if (target.closest('[data-full-voice-stop]')) { stopVoice(); message = 'Reference voice stopped.'; render(); return; }
    if (target.closest('[data-patch-canvas-connect]')) {
      connect();
      return;
    }
    const remove = target.closest<HTMLElement>('[data-patch-canvas-disconnect]');
    if (!remove) return;
    disconnectCable(remove.dataset.patchCanvasDisconnect as ConnectionId);
  };

  const updateM09ControlFromInput = (target: HTMLInputElement | HTMLSelectElement): Partial<M09PatchSourceControls> | undefined => {
    if (target.matches('[data-m09-waveform]')) return { waveform: target.value as M09PatchSourceControls['waveform'] };
    if (target.matches('[data-m09-rate]')) return { rateHz: Number(target.value) };
    if (target.matches('[data-m09-amplitude]')) return { amplitudeVolts: Number(target.value) };
    if (target.matches('[data-m09-offset]')) return { offsetVolts: Number(target.value) };
    if (target.matches('[data-m09-phase]')) return { phaseDegrees: Number(target.value) };
    if (target.matches('[data-m09-seed]')) return { seed: Number(target.value) };
    return undefined;
  };
  const input = (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.matches('[data-full-voice-waveform]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, waveform: target.value as FullSynthVoiceControls['waveform'] });
    if (target.matches('[data-full-voice-pitch]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, pitchCv: Number(target.value) });
    if (target.matches('[data-full-voice-amplitude]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, sourceAmplitudeVolts: Number(target.value) });
    if (target.matches('[data-full-voice-pulse-width]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, pulseWidth: Number(target.value) });
    if (target.matches('[data-full-voice-cutoff]')) {
      localFilterCutoffCv = Number(target.value);
      if (!m09CutoffConnected) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, cutoffCv: localFilterCutoffCv });
    }
    if (target.matches('[data-full-voice-level]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, level: Number(target.value) });
    if (target.matches('[data-live-envelope-cv]')) { publishEnvelope(Number(target.value)); render(); return; }
    const m09Change = updateM09ControlFromInput(target);
    if (m09Change) {
      m09Controls = normaliseM09PatchSourceControls({ ...m09Controls, ...m09Change });
      if (m09Source) {
        m09Source = updateM09PatchSource(m09Source, m09Change, Date.now());
        const published = publishM09PatchSource(runtime, state, m09Source);
        runtime = published.state;
        message = published.reason;
        sampleM09(Date.now());
      }
    }
    const readout = target instanceof HTMLInputElement ? target.parentElement?.querySelector('output') : undefined;
    if (readout && target.matches('[data-full-voice-pitch]')) readout.value = Number(target.value).toFixed(2) + ' V';
    if (readout && target.matches('[data-full-voice-amplitude]')) readout.value = '±' + Number(target.value).toFixed(1) + ' V';
    if (readout && target.matches('[data-full-voice-pulse-width]')) readout.value = Math.round(Number(target.value) * 100) + '%';
    if (readout && target.matches('[data-full-voice-cutoff]')) readout.value = Number(target.value).toFixed(2) + ' V';
    if (readout && target.matches('[data-full-voice-level]')) readout.value = Number(target.value).toFixed(2);
    if (readout && target.matches('[data-m09-rate]')) readout.value = Number(target.value).toFixed(2) + ' Hz';
    if (readout && target.matches('[data-m09-amplitude]')) readout.value = '±' + Number(target.value).toFixed(1) + ' V';
    if (readout && target.matches('[data-m09-offset]')) readout.value = Number(target.value).toFixed(1) + ' V';
    if (readout && target.matches('[data-m09-phase]')) readout.value = Math.round(Number(target.value)) + '°';
    if (readout && target.matches('[data-m09-seed]')) readout.value = String(Math.round(Number(target.value)));
    if (target.matches('[data-full-voice-waveform], [data-full-voice-pitch], [data-full-voice-amplitude], [data-full-voice-pulse-width]') && canvasOscillatorSource) {
      canvasOscillatorSource = canvasSourceFromControls();
      publishOscillatorBoundary();
      voice?.setOscillatorSource(canvasOscillatorSource);
    }
    sampleM09(Date.now());
    voice?.setControls(voiceControls);
    updateM09Readouts();
  };

  const selectSocket = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-full-voice-publish-source]')) {
      canvasOscillatorSource = canvasSourceFromControls();
      publishOscillatorBoundary();
      message = 'M03 source published from its Patch Canvas controls. It is ready for the explicit Browser Audio Boundary.';
      render();
      return;
    }
    if (target.closest('[data-m09-publish-source]')) {
      const now = Date.now();
      m09Source = createM09PatchSource(m09Controls, now);
      const published = publishM09PatchSource(runtime, state, m09Source);
      runtime = published.state;
      message = published.reason;
      sampleM09(now);
      render();
      return;
    }
    const output = target.closest<HTMLElement>('[data-patch-canvas-output]');
    if (output) {
      sourceEndpointId = sourceId(output.dataset.patchCanvasOutput ?? '');
      destinationEndpointId = undefined;
      rejectedDestinationEndpointId = undefined;
      message = 'Output selected. Choose an input socket.';
      render();
      return;
    }
    const inputSocket = target.closest<HTMLElement>('[data-patch-canvas-input]');
    if (!inputSocket) return;
    const attemptedDestination = sourceId(inputSocket.dataset.patchCanvasInput ?? '');
    if (!sourceEndpointId || !attemptedDestination) {
      message = 'Choose an output socket before an input socket.';
      render();
      return;
    }
    const proposal = createPatchCanvasProposal({ sourceEndpointId, destinationEndpointId: attemptedDestination });
    if (proposal.compatibility?.level !== 'direct') {
      rejectedDestinationEndpointId = attemptedDestination;
      destinationEndpointId = undefined;
      message = 'Cannot connect these sockets: ' + proposal.compatibility?.reason + ' ' + proposal.teachingNote;
      render();
      return;
    }
    const result = connectPorts(state, sourceEndpointId, attemptedDestination);
    state = result.state;
    rejectedDestinationEndpointId = result.status === 'rejected' ? attemptedDestination : undefined;
    message = result.status === 'connected'
      ? 'Connected. The cable now runs from the output jack to the input jack; its arrow shows signal direction. Click the cable or use Remove in the cable list to disconnect it.'
      : 'Cannot connect these sockets: ' + result.reason + ' ' + result.teachingNote;
    sourceEndpointId = undefined;
    destinationEndpointId = undefined;
    sampleM09(Date.now());
    render();
  };
  const clearSelection = () => {
    sourceEndpointId = undefined;
    destinationEndpointId = undefined;
    rejectedDestinationEndpointId = undefined;
    message = 'Patch selection cleared.';
    render();
  };

  const disconnectCableAtTarget = (event: Event) => {
    const cable = (event.target as Element).closest<SVGPathElement>('[data-patch-canvas-disconnect]');
    if (!cable) return;
    disconnectCable(cable.dataset.patchCanvasDisconnect as ConnectionId);
  };
  const disconnectCableWithKeyboard = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const cable = (event.target as Element).closest<SVGPathElement>('[data-patch-canvas-disconnect]');
    if (!cable) return;
    event.preventDefault();
    disconnectCable(cable.dataset.patchCanvasDisconnect as ConnectionId);
  };

  const rackResizeObserver = new ResizeObserver(drawEndpointCables);
  rackResizeObserver.observe(rackShell);
  rack.addEventListener('click', selectSocket);
  cableLayer.addEventListener('click', disconnectCableAtTarget);
  cableLayer.addEventListener('keydown', disconnectCableWithKeyboard);
  rack.addEventListener('input', input);
  rack.addEventListener('change', input);
  clear.addEventListener('click', clearSelection);
  workbench.addEventListener('click', click);
  workbench.addEventListener('input', input);
  workbench.addEventListener('change', input);
  render();
  m09AnimationFrame = window.requestAnimationFrame(animateM09);
  return () => {
    rackResizeObserver.disconnect();
    window.cancelAnimationFrame(m09AnimationFrame);
    rack.removeEventListener('click', selectSocket);
    cableLayer.removeEventListener('click', disconnectCableAtTarget);
    cableLayer.removeEventListener('keydown', disconnectCableWithKeyboard);
    rack.removeEventListener('input', input);
    rack.removeEventListener('change', input);
    clear.removeEventListener('click', clearSelection);
    workbench.removeEventListener('click', click);
    workbench.removeEventListener('input', input);
    workbench.removeEventListener('change', input);
    stopVoice();
  };
}
