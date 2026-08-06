import {
  createPatchCanvasProposal,
  listPatchCanvasInputs,
  listPatchCanvasOutputs,
  type PatchCanvasProposal,
} from '../../../packages/patch-canvas/src/index';
import {
  connectPorts,
  createPatchState,
  disconnectPort,
  type ConnectionId,
  type PatchState,
} from '../../../packages/connection-engine/src/index';
import { visualisePatchState } from '../../../packages/visual-patch-cables/src/index';
import type { ModulePortContract, PortEndpointId } from '../../../packages/port-contracts/src/index';

function endpointLabel(port: ModulePortContract): string {
  return 'M' + port.moduleNumber + ' · ' + port.moduleTitle + ' — ' + port.label +
    ' [' + port.signalType + ', ' + port.range.minimum + ' to ' + port.range.maximum + ' ' + port.range.unit + ']';
}

function optionList(ports: readonly ModulePortContract[]): string {
  return ports.map((port) => '<option value="' + port.endpointId + '">' + endpointLabel(port) + '</option>').join('');
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

export function mountPatchCanvas(root: HTMLElement): () => void {
  root.innerHTML = '<section class="module-header"><div><p class="eyebrow">Modular Playground · Visual Patch Cables v1.0</p><h2>Plan and make a signal route</h2><p>Choose declared sockets, inspect their contract, then turn a direct route into a visible patch cable. The cable is real patch state, not an illustration.</p></div></section>' +
    '<section class="patch-canvas-grid"><aside class="patch-canvas-controls panel"><h3>1. Choose sockets</h3><label>Output<select data-patch-canvas-source aria-label="Output socket"><option value="">Choose an output…</option>' +
    optionList(listPatchCanvasOutputs()) + '</select></label><label>Input<select data-patch-canvas-destination aria-label="Input socket"><option value="">Choose an input…</option>' +
    optionList(listPatchCanvasInputs()) + '</select></label><p class="patch-canvas-boundary">Direct routes can become cables. Routes needing range or representation adaptation stay unconnected. Browser audio is still unchanged.</p></aside>' +
    '<div class="patch-canvas-workbench" data-patch-canvas-workbench></div></section>';

  const source = root.querySelector<HTMLSelectElement>('[data-patch-canvas-source]');
  const destination = root.querySelector<HTMLSelectElement>('[data-patch-canvas-destination]');
  const workbench = root.querySelector<HTMLElement>('[data-patch-canvas-workbench]');
  if (!source || !destination || !workbench) throw new Error('Patch Canvas controls are missing.');

  let state = createPatchState();
  let message = '';
  const render = () => {
    const proposal = createPatchCanvasProposal({
      sourceEndpointId: sourceId(source.value),
      destinationEndpointId: sourceId(destination.value),
    });
    workbench.innerHTML = proposedRouteMarkup(proposal) + connectedCablesMarkup(state) +
      '<section class="patch-canvas-learning panel"><h3>What this teaches</h3><p>An output is a source and an input is a destination. A solid cable with an arrow means Connection Engine has accepted a directly compatible route.</p><p>' +
      (message || 'No audio is routed here yet: this canvas makes the real patch state readable before audio integration.') + '</p></section>';
  };

  const connect = () => {
    const sourceEndpointId = sourceId(source.value);
    const destinationEndpointId = sourceId(destination.value);
    if (!sourceEndpointId || !destinationEndpointId) return;
    const result = connectPorts(state, sourceEndpointId, destinationEndpointId);
    state = result.state;
    message = result.reason;
    render();
  };
  const click = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-patch-canvas-connect]')) {
      connect();
      return;
    }
    const remove = target.closest<HTMLElement>('[data-patch-canvas-disconnect]');
    if (!remove) return;
    const result = disconnectPort(state, remove.dataset.patchCanvasDisconnect as ConnectionId);
    state = result.state;
    message = result.reason;
    render();
  };

  source.addEventListener('change', render);
  destination.addEventListener('change', render);
  workbench.addEventListener('click', click);
  render();
  return () => {
    source.removeEventListener('change', render);
    destination.removeEventListener('change', render);
    workbench.removeEventListener('click', click);
  };
}
