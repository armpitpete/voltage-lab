import {
  createPatchCanvasProposal,
  listPatchCanvasInputs,
  listPatchCanvasOutputs,
  type PatchCanvasProposal,
} from '../../../packages/patch-canvas/src/index';
import type { ModulePortContract, PortEndpointId } from '../../../packages/port-contracts/src/index';

function endpointLabel(port: ModulePortContract): string {
  return `M${port.moduleNumber} · ${port.moduleTitle} — ${port.label} [${port.signalType}, ${port.range.minimum} to ${port.range.maximum} ${port.range.unit}]`;
}

function optionList(ports: readonly ModulePortContract[]): string {
  return ports.map((port) => `<option value="${port.endpointId}">${endpointLabel(port)}</option>`).join('');
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

function routeMarkup(proposal: PatchCanvasProposal): string {
  if (!proposal.route || !proposal.source || !proposal.destination) {
    return '<section class="patch-canvas-route panel empty-route"><h3>Proposed route</h3><p>Select an output and an input to inspect a route. Nothing is connected here.</p></section>';
  }
  const status = statusText(proposal);
  return '<section class="patch-canvas-route panel" data-patch-canvas-route="' + proposal.route.style + '">' +
    '<div class="patch-canvas-route-heading"><div><p class="eyebrow">Proposed route · not connected</p><h3>' + proposal.route.label + '</h3></div>' +
    '<span class="patch-canvas-status ' + status.tone + '">' + status.label + '</span></div>' +
    '<svg class="patch-canvas-diagram" viewBox="0 0 1000 180" preserveAspectRatio="none" role="img" aria-label="Proposed signal direction from selected output to selected input">' +
    '<defs><marker id="patch-canvas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>' +
    '<line x1="250" y1="90" x2="750" y2="90" marker-end="url(#patch-canvas-arrow)"/></svg>' +
    '<div class="patch-canvas-endpoints"><div><small>Output</small><b>' + proposal.source.moduleTitle + '</b><span>' + proposal.source.label + ' · ' + proposal.source.signalType + '</span></div>' +
    '<div><small>Input</small><b>' + proposal.destination.moduleTitle + '</b><span>' + proposal.destination.label + ' · ' + proposal.destination.signalType + '</span></div></div>' +
    '<div class="patch-canvas-explanation"><p><b>Compatibility:</b> ' + proposal.compatibility?.reason + '</p><p>' + proposal.teachingNote + '</p></div></section>';
}

export function mountPatchCanvas(root: HTMLElement): () => void {
  root.innerHTML = '<section class="module-header"><div><p class="eyebrow">Modular Playground · Patch Canvas v1.0</p><h2>Plan a signal route</h2><p>Choose declared sockets, read the compatibility result, then inspect a proposed direction. This stage does not patch anything.</p></div></section>' +
    '<section class="patch-canvas-grid"><aside class="patch-canvas-controls panel"><h3>1. Choose sockets</h3><label>Output<select data-patch-canvas-source aria-label="Output socket"><option value="">Choose an output…</option>' +
    optionList(listPatchCanvasOutputs()) + '</select></label><label>Input<select data-patch-canvas-destination aria-label="Input socket"><option value="">Choose an input…</option>' +
    optionList(listPatchCanvasInputs()) + '</select></label><p class="patch-canvas-boundary">Planning only: this screen cannot create a cable, move a signal or change the audio.</p></aside>' +
    '<div class="patch-canvas-workbench" data-patch-canvas-workbench></div></section>';

  const source = root.querySelector<HTMLSelectElement>('[data-patch-canvas-source]');
  const destination = root.querySelector<HTMLSelectElement>('[data-patch-canvas-destination]');
  const workbench = root.querySelector<HTMLElement>('[data-patch-canvas-workbench]');
  if (!source || !destination || !workbench) throw new Error('Patch Canvas controls are missing.');

  const render = () => {
    const proposal = createPatchCanvasProposal({
      sourceEndpointId: sourceId(source.value),
      destinationEndpointId: sourceId(destination.value),
    });
    workbench.innerHTML = routeMarkup(proposal) +
      '<section class="patch-canvas-learning panel"><h3>What this teaches</h3><p>Outputs are sources; inputs are destinations. Matching names are not enough: the signal meaning, declared voltage range and browser-audio representation all matter.</p><p>' + proposal.limitation + '</p></section>';
  };

  source.addEventListener('change', render);
  destination.addEventListener('change', render);
  render();
  return () => {
    source.removeEventListener('change', render);
    destination.removeEventListener('change', render);
  };
}
