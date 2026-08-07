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
  planFullSynthVoice,
  REQUIRED_VOICE_CABLES,
  type FullSynthVoiceControls,
} from '../../../packages/full-synth-voice/src/index';
import { createLiveSignalRuntime, observeLiveSignal, publishSignal, type LiveSignalRuntimeState } from '../../../packages/live-signal-runtime/src/index';
import { inspectSignal } from '../../../packages/signal-inspector/src/index';
import type { ModulePortContract, PortEndpointId } from '../../../packages/port-contracts/src/index';

const moduleRoutes = new Map(voltageLabModules.map((module) => [module.id, module.route]));

function portButtonMarkup(port: ModulePortContract, role: 'input' | 'output', selected: PortEndpointId | undefined): string {
  const selectedClass = selected === port.endpointId ? ' selected' : '';
  const dataAttribute = role === 'output' ? 'data-patch-canvas-output' : 'data-patch-canvas-input';
  return '<button type="button" class="patch-rack-port ' + role + selectedClass + '" ' + dataAttribute + '="' + port.endpointId + '" aria-pressed="' + (selected === port.endpointId ? 'true' : 'false') + '">' +
    '<span class="patch-rack-jack" aria-hidden="true"></span><span><b>' + port.label + '</b><small>' + port.signalType + ' · ' + port.range.minimum + ' to ' + port.range.maximum + ' ' + port.range.unit + '</small></span></button>';
}

function moduleControlsMarkup(moduleId: string, controls: FullSynthVoiceControls, envelopeValue: number): string {
  const liveLabel = '<p class="patch-rack-control-status"><b>Live voice control</b> · shared with the safe monitor below.</p>';
  if (moduleId === 'oscillator') {
    const waveformOptions = ['sawtooth', 'square', 'triangle', 'sine'].map((waveform) =>
      '<option value="' + waveform + '"' + (controls.waveform === waveform ? ' selected' : '') + '>' +
      ({ sawtooth: 'Saw', square: 'Square', triangle: 'Triangle', sine: 'Sine' } as Record<string, string>)[waveform] + '</option>',
    ).join('');
    return '<section class="patch-rack-controls"><h4>Controls</h4>' + liveLabel +
      '<label>Waveform <select data-full-voice-waveform>' + waveformOptions + '</select></label>' +
      '<label>Pitch CV <input data-full-voice-pitch type="range" min="-3" max="3" step=".01" value="' + controls.pitchCv + '"><output>' + controls.pitchCv.toFixed(2) + ' V</output></label></section>';
  }
  if (moduleId === 'filter') {
    return '<section class="patch-rack-controls"><h4>Controls</h4>' + liveLabel +
      '<label>Cutoff CV <input data-full-voice-cutoff type="range" min="-4" max="4" step=".01" value="' + controls.cutoffCv + '"><output>' + controls.cutoffCv.toFixed(2) + ' V</output></label></section>';
  }
  if (moduleId === 'envelope') {
    return '<section class="patch-rack-controls"><h4>Controls</h4>' + liveLabel +
      '<label>Envelope CV output <input data-live-envelope-cv type="range" min="0" max="5" step=".01" value="' + envelopeValue + '"><output>' + envelopeValue.toFixed(2) + ' V</output></label></section>';
  }
  if (moduleId === 'vca-mixer') {
    return '<section class="patch-rack-controls"><h4>Controls</h4>' + liveLabel +
      '<label>Output level <input data-full-voice-level type="range" min="0" max=".16" step=".01" value="' + controls.level + '"><output>' + controls.level.toFixed(2) + '</output></label></section>';
  }
  return '<section class="patch-rack-controls unavailable"><h4>Controls</h4><p>No shared live control yet. This module remains fully patchable; its detailed Lab is still the working teaching surface.</p></section>';
}

function rackMarkup(sourceEndpointId: PortEndpointId | undefined, destinationEndpointId: PortEndpointId | undefined, controls: FullSynthVoiceControls, envelopeValue: number): string {
  return listPatchCanvasRackModules().map((module) => {
    const route = moduleRoutes.get(module.moduleId);
    const inputs = module.inputs.length
      ? module.inputs.map((port) => portButtonMarkup(port, 'input', destinationEndpointId)).join('')
      : '<p class="patch-rack-empty">No declared inputs</p>';
    const outputs = module.outputs.length
      ? module.outputs.map((port) => portButtonMarkup(port, 'output', sourceEndpointId)).join('')
      : '<p class="patch-rack-empty">No declared outputs</p>';
    return '<article class="patch-rack-module" data-patch-module="' + module.moduleId + '">' +
      '<header><span class="patch-rack-number">M' + String(module.moduleNumber).padStart(2, '0') + '</span><div><h3>' + module.moduleTitle + '</h3><p>' + (route ? 'Patch points and detailed controls' : 'Explicit signal-representation bridge') + '</p></div></header>' +
      '<div class="patch-rack-ports"><section><h4>Inputs</h4>' + inputs + '</section><section><h4>Outputs</h4>' + outputs + '</section></div>' +
      moduleControlsMarkup(module.moduleId, controls, envelopeValue) +
      (route ? '<a class="patch-rack-lab-link" href="' + route + '">Open detailed Lab</a>' : '') +
      '</article>';
  }).join('');
}

function sourceId(value: string): PortEndpointId | undefined {
  return value ? value as PortEndpointId : undefined;
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

function fullSynthVoiceMarkup(state: PatchState, runtime: LiveSignalRuntimeState, controls: FullSynthVoiceControls): string {
  const plan = planFullSynthVoice(state);
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
  const actions = plan.ready
    ? '<div class="full-synth-voice-controls"><p class="patch-canvas-boundary">Use the compact live controls on M03 Oscillator, M05 Filter, M06 Envelope and M07 VCA above. They share this monitor’s state.</p><p class="patch-canvas-boundary"><b>Live Inspector:</b> Envelope output ' + (envelopeInspection?.range.value ?? 'not published') + ' V → VCA input ' + (deliveredValue ?? 'not connected') + ' V.</p><div class="button-row"><button type="button" data-full-voice-start>Start reference voice</button><button type="button" data-full-voice-note>Play short note</button><button type="button" data-full-voice-stop>Panic / stop</button></div></div>'
    : '<button type="button" data-build-full-voice>Build these three real cables</button>';

  return '<section class="patch-canvas-learning panel full-synth-voice"><p class="eyebrow">Full Synth Voice v1.0 · real patch monitor</p><h3>Hear the patched audio and control paths</h3><p>This safe reference monitor is enabled only by the actual Connection Engine cables listed here.</p><ol class="full-synth-voice-cables">' + cables + '</ol>' + readiness + actions + '<p class="patch-canvas-boundary">The source is a bounded reference rendering of the declared Patch audio socket. It does not read or alter Module 06’s independently accepted controls.</p></section>';
}

export function mountPatchCanvas(root: HTMLElement): () => void {
  root.innerHTML = '<section class="module-header"><div><p class="eyebrow">Modular Playground · Full Synth Rack v1.0</p><h2>Patch the whole instrument</h2><p>Every declared module and socket is here at once. The current audible voice controls live on their own rack cards; unintegrated modules say so plainly.</p></div></section>' +
    '<section class="patch-rack-intro panel"><h3>One visible rack</h3><p>The detailed Labs remain useful for slow learning. This is the instrument view: all nine modules, their patch points and the live patch evidence are kept together.</p><p class="patch-canvas-boundary">Click an <b>output</b> socket, then an <b>input</b> socket. Directly compatible routes can become cables; incompatible or adaptation-required routes stay explicit.</p></section>' +
    '<section class="patch-canvas-rack" data-patch-canvas-rack aria-label="Voltage Lab modular synth rack"></section>' +
    '<section class="patch-canvas-grid patch-canvas-instrument-grid"><aside class="patch-canvas-controls panel"><h3>Patch selection</h3><p data-patch-canvas-selection>Choose an output socket in the rack.</p><button type="button" data-patch-canvas-clear>Clear selection</button><p class="patch-canvas-boundary">The rack exposes every declared patch point. A module’s standalone detailed controls remain in its Lab until its real runtime has been integrated here.</p></aside>' +
    '<div class="patch-canvas-workbench" data-patch-canvas-workbench></div></section>';

  const rack = root.querySelector<HTMLElement>('[data-patch-canvas-rack]');
  const selection = root.querySelector<HTMLElement>('[data-patch-canvas-selection]');
  const clear = root.querySelector<HTMLButtonElement>('[data-patch-canvas-clear]');
  const workbench = root.querySelector<HTMLElement>('[data-patch-canvas-workbench]');
  if (!rack || !selection || !clear || !workbench) throw new Error('Patch Canvas rack controls are missing.');

  let state = createPatchState();
  let sourceEndpointId: PortEndpointId | undefined;
  let destinationEndpointId: PortEndpointId | undefined;
  let message = '';
  let voice: BrowserFullSynthVoice | undefined;
  let voiceControls = normaliseFullSynthVoiceControls({ vcaCv: 0 });
  let runtime = createLiveSignalRuntime();
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
  const render = () => {
    const proposal = createPatchCanvasProposal({
      sourceEndpointId,
      destinationEndpointId,
    });
    const envelopeValue = observeLiveSignal(runtime, 'envelope:envelope').value ?? 5;
    rack.innerHTML = rackMarkup(sourceEndpointId, destinationEndpointId, voiceControls, envelopeValue);
    selection.innerHTML = sourceEndpointId
      ? (destinationEndpointId ? '<b>Route selected:</b> output → input. Review it below, then connect if directly compatible.' : '<b>Output selected.</b> Now choose an input socket.')
      : 'Choose an output socket in the rack.';
    workbench.innerHTML = proposedRouteMarkup(proposal) + connectedCablesMarkup(state) + fullSynthVoiceMarkup(state, runtime, voiceControls) +
      '<section class="patch-canvas-learning panel"><h3>What this teaches</h3><p>An output is a source and an input is a destination. A solid cable with an arrow means Connection Engine has accepted a directly compatible route.</p><p>' +
      (message || 'No audio is routed here yet: this canvas makes the real patch state readable before audio integration.') + '</p></section>';
  };

  const connect = () => {
    if (!sourceEndpointId || !destinationEndpointId) return;
    const result = connectPorts(state, sourceEndpointId, destinationEndpointId);
    state = result.state;
    message = result.reason;
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
    message = planFullSynthVoice(state).ready ? 'The three real cables are connected. The Full Synth Voice reference monitor is ready.' : 'The voice patch could not be completed.';
    publishEnvelope(observeLiveSignal(runtime, 'envelope:envelope').value ?? 5);
    render();
  };
  const stopVoice = () => { const active = voice; voice = undefined; void active?.stop(); };
  const click = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-build-full-voice]')) { buildFullVoicePatch(); return; }
    if (target.closest('[data-full-voice-start]')) {
      if (!planFullSynthVoice(state).ready || voice) return;
      void BrowserFullSynthVoice.start(voiceControls).then((started) => { voice = started; message = 'Reference voice started from the real cable set.'; render(); });
      return;
    }
    if (target.closest('[data-full-voice-note]')) { voice?.gate(true); window.setTimeout(() => voice?.gate(false), 360); return; }
    if (target.closest('[data-full-voice-stop]')) { stopVoice(); message = 'Reference voice stopped.'; render(); return; }
    if (target.closest('[data-patch-canvas-connect]')) {
      connect();
      return;
    }
    const remove = target.closest<HTMLElement>('[data-patch-canvas-disconnect]');
    if (!remove) return;
    const result = disconnectPort(state, remove.dataset.patchCanvasDisconnect as ConnectionId);
    state = result.state;
    if (!planFullSynthVoice(state).ready) stopVoice();
    publishEnvelope(observeLiveSignal(runtime, 'envelope:envelope').value ?? 5);
    message = result.reason;
    render();
  };

  const input = (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.matches('[data-full-voice-waveform]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, waveform: target.value as OscillatorType });
    if (target.matches('[data-full-voice-pitch]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, pitchCv: Number(target.value) });
    if (target.matches('[data-full-voice-cutoff]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, cutoffCv: Number(target.value) });
    if (target.matches('[data-full-voice-level]')) voiceControls = normaliseFullSynthVoiceControls({ ...voiceControls, level: Number(target.value) });
    if (target.matches('[data-live-envelope-cv]')) { publishEnvelope(Number(target.value)); render(); return; }
    voice?.setControls(voiceControls);
  };

  const selectSocket = (event: Event) => {
    const target = event.target as HTMLElement;
    const output = target.closest<HTMLElement>('[data-patch-canvas-output]');
    if (output) {
      sourceEndpointId = sourceId(output.dataset.patchCanvasOutput ?? '');
      destinationEndpointId = undefined;
      message = 'Output selected. Choose an input socket.';
      render();
      return;
    }
    const inputSocket = target.closest<HTMLElement>('[data-patch-canvas-input]');
    if (!inputSocket) return;
    if (!sourceEndpointId) {
      message = 'Choose an output socket before an input socket.';
      render();
      return;
    }
    destinationEndpointId = sourceId(inputSocket.dataset.patchCanvasInput ?? '');
    message = 'Route selected. Read the compatibility result below.';
    render();
  };
  const clearSelection = () => {
    sourceEndpointId = undefined;
    destinationEndpointId = undefined;
    message = 'Patch selection cleared.';
    render();
  };

  rack.addEventListener('click', selectSocket);
  rack.addEventListener('input', input);
  rack.addEventListener('change', input);
  clear.addEventListener('click', clearSelection);
  workbench.addEventListener('click', click);
  workbench.addEventListener('input', input);
  workbench.addEventListener('change', input);
  render();
  return () => {
    rack.removeEventListener('click', selectSocket);
    rack.removeEventListener('input', input);
    rack.removeEventListener('change', input);
    clear.removeEventListener('click', clearSelection);
    workbench.removeEventListener('click', click);
    workbench.removeEventListener('input', input);
    workbench.removeEventListener('change', input);
    stopVoice();
  };
}
