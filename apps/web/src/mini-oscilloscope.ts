import {
  createMiniScopePreview,
  formatMiniScopeRange,
  type MiniScopePreview,
  type MiniScopeWaveform,
} from '../../../packages/mini-oscilloscope/src/index';
import { voltageLabModules } from '../../../packages/module-interface/src/modules';
import type { VoltageLabModuleDeclaration } from '../../../packages/module-interface/src/index';

const PRESET_BY_MODULE: Readonly<Record<string, { waveform: MiniScopeWaveform; teachingNote: string }>> = {
  'sample-and-hold': { waveform: 'stepped', teachingNote: 'A held voltage stays at one level until the next capture event.' },
  'clock-and-trigger': { waveform: 'pulse', teachingNote: 'A clock is a repeating timing pulse, not ordinary continuous CV.' },
  oscillator: { waveform: 'sine', teachingNote: 'A repeating audio-rate voltage has visible shape and range.' },
  quantizer: { waveform: 'stepped', teachingNote: 'Quantized pitch CV moves in deliberate voltage steps.' },
  envelope: { waveform: 'envelope', teachingNote: 'An envelope is a changing control voltage shaped by attack, decay, sustain and release.' },
  patch: { waveform: 'stepped', teachingNote: 'A sequence output holds one intended voltage for each step.' },
  filter: { waveform: 'filtered', teachingNote: 'Filtered audio is shown in browser-normalised representation.' },
  'vca-mixer': { waveform: 'filtered', teachingNote: 'A mixed audio result has shape and headroom before it reaches the listener.' },
  'lfo-modulation': { waveform: 'sine', teachingNote: 'An LFO is a slow repeating control voltage.' },
};

function previewFor(module: VoltageLabModuleDeclaration): MiniScopePreview | undefined {
  const output = module.outputs[0];
  const preset = PRESET_BY_MODULE[module.id];
  if (!output || !preset) return undefined;
  return createMiniScopePreview({
    label: output.label,
    endpointId: module.id + ':' + output.id,
    waveform: preset.waveform,
    range: output.range,
    teachingNote: preset.teachingNote,
  });
}

export function buildModuleMiniScopePreview(moduleId: string): MiniScopePreview | undefined {
  const module = voltageLabModules.find((candidate) => candidate.id === moduleId);
  return module ? previewFor(module) : undefined;
}

function tracePoints(preview: MiniScopePreview): string {
  return preview.points
    .map((point) => (point.x * 100).toFixed(2) + ',' + (4 + (1 - point.y) * 32).toFixed(2))
    .join(' ');
}

export function mountModuleMiniOscilloscope(root: HTMLElement, moduleId: string): (() => void) | undefined {
  const preview = buildModuleMiniScopePreview(moduleId);
  if (!preview) return undefined;

  const panel = document.createElement('section');
  const range = formatMiniScopeRange(preview.range);
  const representation = preview.range.unit === 'V' ? 'Conceptual voltage' : 'Browser-normalised audio';
  panel.className = 'mini-scope panel';
  panel.dataset.moduleMiniScope = moduleId;
  panel.innerHTML =
    '<div class="mini-scope-heading"><div><p class="eyebrow">Universal mini-oscilloscope · illustrative output preview</p><h3>' + preview.label +
    '</h3></div><div class="readouts"><span>Declared range<b>' + range +
    '</b></span><span>Representation<b>' + representation +
    '</b></span></div></div><svg class="mini-scope-trace" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Illustrative ' + preview.label +
    ' waveform within the declared range ' + range +
    '"><path class="mini-scope-grid" d="M0 4H100M0 20H100M0 36H100M25 0V40M50 0V40M75 0V40"/><polyline class="mini-scope-line" points="' + tracePoints(preview) +
    '"/></svg><p class="mini-scope-note">' + preview.teachingNote +
    '</p><p class="mini-scope-limit">' + preview.limitation + '</p>';
  root.append(panel);
  return () => panel.remove();
}
