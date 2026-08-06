import type { PatchState } from '../../connection-engine/src/index';

export const FULL_SYNTH_VOICE_VERSION = '1.0' as const;

export type FullSynthVoiceControls = {
  waveform: OscillatorType;
  pitchCv: number;
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

export const REQUIRED_VOICE_CABLES: readonly RequiredVoiceCable[] = [
  {
    sourceEndpointId: 'patch:audio',
    destinationEndpointId: 'filter:audio',
    label: 'Patch audio → Filter audio',
    purpose: 'Carries the browser-normalised voice source into the filter.',
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

const WAVEFORMS: readonly OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function normaliseFullSynthVoiceControls(
  controls: Partial<FullSynthVoiceControls> = {},
): FullSynthVoiceControls {
  return {
    waveform: WAVEFORMS.includes(controls.waveform as OscillatorType) ? controls.waveform as OscillatorType : 'sawtooth',
    pitchCv: clamp(controls.pitchCv ?? 0, -3, 3),
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
 * The browser source is a bounded reference rendering of the Patch audio socket; it
 * deliberately does not import or mutate Module 06's independent teaching controls.
 */
export function planFullSynthVoice(state: PatchState): FullSynthVoicePlan {
  const missingCables = REQUIRED_VOICE_CABLES.filter((required) => !hasDirectCable(state, required));
  return {
    version: FULL_SYNTH_VOICE_VERSION,
    ready: missingCables.length === 0,
    requiredCables: REQUIRED_VOICE_CABLES,
    missingCables,
    teachingNote: missingCables.length
      ? 'A full voice needs a real audio path and a real control path. Connect every listed cable before sound can start.'
      : 'This audible reference voice follows the real Patch audio → Filter → VCA route and Envelope → VCA CV control route.',
  };
}
