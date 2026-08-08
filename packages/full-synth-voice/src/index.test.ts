import { describe, expect, it } from 'vitest';
import { connectPorts, createPatchState } from '../../connection-engine/src/index';
import {
  cutoffCvToFrequency,
  normaliseFullSynthVoiceControls,
  pitchCvToFrequency,
  planFullSynthVoice,
  planFullSynthVoiceSource,
  vcaCvToGain,
} from './index';

function readyVoiceState() {
  const first = connectPorts(createPatchState(), 'oscillator:waveform', 'browser-audio-boundary:oscillator-input').state;
  const second = connectPorts(first, 'browser-audio-boundary:normalised-output', 'filter:audio').state;
  const third = connectPorts(second, 'filter:filtered', 'vca-mixer:channel-1').state;
  return connectPorts(third, 'envelope:envelope', 'vca-mixer:vca-cv').state;
}

describe('Full Synth Voice v1.0', () => {
  it('does not call a voice ready until every required real cable exists', () => {
    const plan = planFullSynthVoice(createPatchState());
    expect(plan.ready).toBe(false);
    expect(plan.missingCables).toHaveLength(4);
    expect(planFullSynthVoice(readyVoiceState()).ready).toBe(true);
  });

  it('requires the exact source and destination for every voice cable', () => {
    const almost = connectPorts(createPatchState(), 'oscillator:waveform', 'browser-audio-boundary:oscillator-input').state;
    expect(planFullSynthVoice(almost).missingCables.map((cable) => cable.label)).toEqual([
      'Normalised audio → Filter audio',
      'Filtered audio → VCA channel 1',
      'Envelope CV → VCA CV',
    ]);
  });

  it('requires a published Module 03 source as well as real cables', () => {
    expect(planFullSynthVoiceSource(undefined).ready).toBe(false);
    expect(planFullSynthVoiceSource({ version: '1.0', waveform: 'sine', frequencyHz: 220, pulseWidth: 0.5, sourcePeakVolts: 2.5, normalisedPeak: 0.25, observedAt: 1 })).toMatchObject({ ready: true });
  });

  it('keeps reference-voice controls bounded and meaningful', () => {
    expect(normaliseFullSynthVoiceControls({ waveform: 'invalid' as OscillatorType, pitchCv: 99, sourceAmplitudeVolts: 9, pulseWidth: 2, cutoffCv: -99, vcaCv: 9, level: 1 })).toEqual({
      waveform: 'sawtooth', pitchCv: 3, sourceAmplitudeVolts: 5, pulseWidth: 0.95, cutoffCv: -4, vcaCv: 5, level: 0.16,
    });
    expect(normaliseFullSynthVoiceControls({ waveform: 'pulse', pulseWidth: 0.3 })).toMatchObject({ waveform: 'pulse', pulseWidth: 0.3 });
    expect(pitchCvToFrequency(1)).toBeCloseTo(220);
    expect(cutoffCvToFrequency(-99)).toBe(60);
    expect(vcaCvToGain(2.5, 0.12)).toBeCloseTo(0.06);
  });
});
