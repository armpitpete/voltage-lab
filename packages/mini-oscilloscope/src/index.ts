export const MINI_OSCILLOSCOPE_VERSION = '1.0' as const;

export type MiniScopeWaveform = 'sine' | 'stepped' | 'pulse' | 'envelope' | 'filtered';

export type MiniScopeRange = {
  minimum: number;
  maximum: number;
  unit: 'V' | 'normalised';
};

export type MiniScopePoint = {
  x: number;
  y: number;
  value: number;
};

export type MiniScopePreview = {
  version: typeof MINI_OSCILLOSCOPE_VERSION;
  mode: 'declared-preview';
  label: string;
  endpointId: string;
  waveform: MiniScopeWaveform;
  range: MiniScopeRange;
  points: readonly MiniScopePoint[];
  teachingNote: string;
  limitation: string;
};

export type MiniScopePreviewRequest = {
  label: string;
  endpointId: string;
  waveform: MiniScopeWaveform;
  range: MiniScopeRange;
  sampleCount?: number;
  teachingNote: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function sampleWaveform(waveform: MiniScopeWaveform, phase: number): number {
  switch (waveform) {
    case 'sine':
      return Math.sin(phase * Math.PI * 6);
    case 'stepped':
      return [-1, -1 / 3, 1 / 3, 1][Math.min(3, Math.floor(phase * 4))];
    case 'pulse':
      return phase % 0.25 < 0.06 ? 1 : -1;
    case 'envelope':
      if (phase < 0.18) return -1 + phase / 0.18 * 2;
      if (phase < 0.38) return 1 - (phase - 0.18) / 0.2 * 0.7;
      if (phase < 0.72) return 0.3;
      return 0.3 - (phase - 0.72) / 0.28 * 1.3;
    case 'filtered':
      return clamp(Math.sin(phase * Math.PI * 6) * 0.72 + Math.sin(phase * Math.PI * 12) * 0.12, -1, 1);
  }
}

export function formatMiniScopeRange(range: MiniScopeRange): string {
  const sign = (value: number) => `${value > 0 ? '+' : ''}${Number.isInteger(value) ? value : value.toFixed(2)}`;
  return `${sign(range.minimum)} to ${sign(range.maximum)} ${range.unit}`;
}

export function createMiniScopePreview(request: MiniScopePreviewRequest): MiniScopePreview {
  const sampleCount = request.sampleCount ?? 72;
  if (!request.label.trim() || !request.endpointId.trim()) throw new Error('Mini scope previews need a label and endpoint id.');
  if (!Number.isFinite(request.range.minimum) || !Number.isFinite(request.range.maximum) || request.range.minimum >= request.range.maximum) {
    throw new Error('Mini scope previews need a finite increasing range.');
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 8) throw new Error('Mini scope previews need at least eight samples.');

  const span = request.range.maximum - request.range.minimum;
  const points = Array.from({ length: sampleCount }, (_, index) => {
    const x = index / (sampleCount - 1);
    const normalised = clamp(sampleWaveform(request.waveform, x), -1, 1);
    const value = request.range.minimum + (normalised + 1) / 2 * span;
    return { x, y: (value - request.range.minimum) / span, value };
  });

  return {
    version: MINI_OSCILLOSCOPE_VERSION,
    mode: 'declared-preview',
    label: request.label,
    endpointId: request.endpointId,
    waveform: request.waveform,
    range: request.range,
    points,
    teachingNote: request.teachingNote,
    limitation: 'Illustrative declared-output preview only. It does not sample a live cable, a module runtime or Web Audio.',
  };
}
