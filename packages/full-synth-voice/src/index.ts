import type { PatchState } from '../../connection-engine/src/index';
import type { BrowserAudioSource } from '../../browser-audio-boundary/src/index';

export const FULL_SYNTH_VOICE_VERSION = '1.0' as const;

export type FullSynthVoiceWaveform = OscillatorType | 'pulse';

export type FullSynthVoiceControls = {
  waveform: FullSynthVoiceWaveform;
  pitchCv: number;
  sourceAmplitudeVolts: number;
  pulseWidth: number;
  cutoffCv: number;
  vcaCv: number;
  level: number;
};

export type RequiredVoiceCable = {
  sourceEndpointId: string;
  destinationEndpointId: string;
  label: string;
  purpose: string;
};

export type FullSynthVoicePlan = {
  version: typeof FULL_SYNTH_VOICE_VERSION;
  ready: boolean;
  requiredCables: readonly RequiredVoiceCable[];
  missingCables: readonly RequiredVoiceCable[];
  teachingNote: string;
};

export type FullSynthVoiceSourcePlan = {
  ready: boolean;
  reason: string;
};

export const REQUIRED_VOICE_CABLES: readonly RequiredVoiceCable[] = [
  {
    sourceEndpointId: 'oscillator:waveform',
    destinationEndpointId: 'browser-audio-boundary:oscillator-input',
    label: 'Oscillator → Browser Audio Boundary',
    purpose: 'Carries Module 03’s conceptual waveform into the explicit browser-audio boundary.',
  },
  {
    sourceEndpointId: 'browser-audio-boundary:normalised-output',
    destinationEndpointId: 'filter:audio',
    label: 'Normalised audio → Filter audio',
    purpose: 'Carries the explicit browser-normalised waveform into the filter.',
  },
  {
    sourceEndpointId: 'filter:filtered',
    destinationEndpointId: 'vca-mixer:channel-1',
    label: 'Filtered audio → VCA channel 1',
    purpose: 'Carries the shaped audio into the voltage-controlled amplifier.',
  },
  {
    sourceEndpointId: 'envelope:envelope',
    destinationEndpointId: 'vca-mixer:vca-cv',
    label: 'Envelope CV → VCA CV',
    purpose: 'Turns the envelope voltage into audible loudness.',
  },
] as const;

const WAVEFORMS: readonly FullSynthVoiceWaveform[] = ['sine', 'square', 'sawtooth', 'triangle', 'pulse'];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function normaliseFullSynthVoiceControls(
  controls: Partial<FullSynthVoiceControls> = {},
): FullSynthVoiceControls {
  return {
    waveform: WAVEFORMS.includes(controls.waveform as FullSynthVoiceWaveform) ? controls.waveform as FullSynthVoiceWaveform : 'sawtooth',
    pitchCv: clamp(controls.pitchCv ?? 0, -3, 3),
    sourceAmplitudeVolts: clamp(controls.sourceAmplitudeVolts ?? 2.5, 0, 5),
    pulseWidth: clamp(controls.pulseWidth ?? 0.5, 0.05, 0.95),
    cutoffCv: clamp(controls.cutoffCv ?? 0, -4, 4),
    vcaCv: clamp(controls.vcaCv ?? 5, 0, 5),
    level: clamp(controls.level ?? 0.12, 0, 0.16),
  };
}

export function pitchCvToFrequency(pitchCv: number): number {
  return 110 * 2 ** normaliseFullSynthVoiceControls({ pitchCv }).pitchCv;
}

export function cutoffCvToFrequency(cutoffCv: number): number {
  return clamp(440 * 2 ** normaliseFullSynthVoiceControls({ cutoffCv }).cutoffCv, 60, 16000);
}

export function vcaCvToGain(vcaCv: number, level = 0.12): number {
  const normalised = normaliseFullSynthVoiceControls({ vcaCv, level });
  return normalised.level * normalised.vcaCv / 5;
}

function hasDirectCable(state: PatchState, required: RequiredVoiceCable): boolean {
  return state.connections.some((connection) =>
    connection.sourceEndpointId === required.sourceEndpointId &&
    connection.destinationEndpointId === required.destinationEndpointId &&
    connection.compatibility.level === 'direct',
  );
}

/**
 * A voice becomes audible only when these exact real Connection Engine cables exist.
 * It has no default oscillator: the browser source must be published by Module 03 and
 * is rendered only through the explicit conceptual-voltage → browser-audio boundary.
 */
export function planFullSynthVoice(state: PatchState): FullSynthVoicePlan {
  const missingCables = REQUIRED_VOICE_CABLES.filter((required) => !hasDirectCable(state, required));
  return {
    version: FULL_SYNTH_VOICE_VERSION,
    ready: missingCables.length === 0,
    requiredCables: REQUIRED_VOICE_CABLES,
    missingCables,
    teachingNote: missingCables.length
      ? 'A full voice needs the explicit oscillator-to-browser-audio path and the envelope control path. Connect every listed cable before sound can start.'
      : 'This voice follows Module 03 oscillator → Browser Audio Boundary → Filter → VCA, plus Envelope → VCA CV.',
  };
}

export function planFullSynthVoiceSource(source: BrowserAudioSource | undefined): FullSynthVoiceSourcePlan {
  return source
    ? { ready: true, reason: `M03 source: ${source.waveform}, ${source.frequencyHz.toFixed(1)} Hz, ±${source.sourcePeakVolts.toFixed(1)} V.` }
    : { ready: false, reason: 'Use the M03 source button in Patch Canvas, or open Oscillator Lab, to publish an explicit source configuration.' };
}
