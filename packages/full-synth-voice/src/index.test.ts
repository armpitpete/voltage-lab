import { describe, expect, it } from 'vitest';
import { connectPorts, createPatchState } from '../../connection-engine/src/index';
import {
  cutoffCvToFrequency,
  normaliseFullSynthVoiceControls,
  pitchCvToFrequency,
  planFullSynthVoice,
  vcaCvToGain,
} from './index';

function readyVoiceState() {
  const first = connectPorts(createPatchState(), 'patch:audio', 'filter:audio').state;
  const second = connectPorts(first, 'filter:filtered', 'vca-mixer:channel-1').state;
  return connectPorts(second, 'envelope:envelope', 'vca-mixer:vca-cv').state;
}

describe('Full Synth Voice v1.0', () => {
  it('does not call a voice ready until every required real cable exists', () => {
    const plan = planFullSynthVoice(createPatchState());
    expect(plan.ready).toBe(false);
    expect(plan.missingCables).toHaveLength(3);
    expect(planFullSynthVoice(readyVoiceState()).ready).toBe(true);
  });

  it('requires the exact source and destination for every voice cable', () => {
    const almost = connectPorts(createPatchState(), 'patch:audio', 'filter:audio').state;
    expect(planFullSynthVoice(almost).missingCables.map((cable) => cable.label)).toEqual([
      'Filtered audio → VCA channel 1',
      'Envelope CV → VCA CV',
    ]);
  });

  it('keeps reference-voice controls bounded and meaningful', () => {
    expect(normaliseFullSynthVoiceControls({ waveform: 'invalid' as OscillatorType, pitchCv: 99, cutoffCv: -99, vcaCv: 9, level: 1 })).toEqual({
      waveform: 'sawtooth', pitchCv: 3, cutoffCv: -4, vcaCv: 5, level: 0.16,
    });
    expect(pitchCvToFrequency(1)).toBeCloseTo(220);
    expect(cutoffCvToFrequency(-99)).toBe(60);
    expect(vcaCvToGain(2.5, 0.12)).toBeCloseTo(0.06);
  });
});
