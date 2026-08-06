import {
  MODULE_INTERFACE_VERSION,
  normalisedAudioRange,
  voltageRange,
  type ModulePortDeclaration,
  type VoltageLabModuleDeclaration,
} from './index';

const input = (
  id: string,
  label: string,
  signalType: ModulePortDeclaration['signalType'],
  range: ModulePortDeclaration['range'],
  purpose: string,
): ModulePortDeclaration => ({ id, label, direction: 'input', signalType, range, purpose });

const output = (
  id: string,
  label: string,
  signalType: ModulePortDeclaration['signalType'],
  range: ModulePortDeclaration['range'],
  purpose: string,
): ModulePortDeclaration => ({ id, label, direction: 'output', signalType, range, purpose });

const browserAudio = (purpose: string) => ({
  enabled: true,
  requiresExplicitStart: true,
  hasPanicStop: true,
  purpose,
});

export const voltageLabModules: readonly VoltageLabModuleDeclaration[] = [
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 1,
    id: 'sample-and-hold',
    title: 'Sample & Hold Lab',
    route: '#/sample-and-hold',
    status: 'accepted-behaviour-preserved',
    inputs: [
      input('signal', 'Signal', 'cv', voltageRange(-5, 5), 'Voltage to sample, track or hold.'),
      input('event', 'Trigger / gate', 'trigger', voltageRange(0, 5), 'Tells the hold circuit when to capture or track.'),
    ],
    outputs: [
      output('held', 'Held CV', 'cv', voltageRange(-5, 5), 'Main sampled, tracked or slewed control voltage.'),
      output('companion-low', 'Companion low', 'cv', voltageRange(-5, 5), 'Lower related voltage in Companion Hold mode.'),
      output('companion-high', 'Companion high', 'cv', voltageRange(-5, 5), 'Higher related voltage in Companion Hold mode.'),
    ],
    visualisations: [
      { id: 'event-history', label: 'Voltage and event evidence', kind: 'history', purpose: 'Align input, capture events and held voltage in time.' },
    ],
    audio: browserAudio('Maps held CV to safe 1 V/octave comparison voices.'),
    teaching: {
      purpose: 'Show how a changing voltage becomes sampled, tracked and held.',
      outcomes: ['Distinguish sample-and-hold from track-and-hold.', 'Hear and measure held CV as pitch.'],
    },
  },
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 2,
    id: 'clock-and-trigger',
    title: 'Clock & Trigger Lab',
    route: '#/clock-and-trigger',
    status: 'accepted-behaviour-preserved',
    inputs: [input('reset', 'Reset', 'trigger', voltageRange(0, 5), 'Returns related timing outputs to a shared start.')],
    outputs: [
      output('clock', 'Clock', 'clock', voltageRange(0, 5), 'Master repeating timing pulse.'),
      output('gate', 'Gate', 'gate', voltageRange(0, 5), 'Variable-width high/low timing signal.'),
      output('trigger', 'Trigger', 'trigger', voltageRange(0, 5), 'Short event pulse at the master clock edge.'),
      output('divided', 'Divided clock', 'clock', voltageRange(0, 5), 'Slower clock derived from the master.'),
      output('multiplied', 'Multiplied clock', 'clock', voltageRange(0, 5), 'Faster clock derived from the master.'),
    ],
    visualisations: [
      { id: 'timing-lanes', label: 'Timing lanes', kind: 'timeline', purpose: 'Compare gate, trigger, division and multiplication edges.' },
    ],
    audio: browserAudio('Turns timing events into quiet comparison clicks.'),
    teaching: {
      purpose: 'Show how repeating time creates clocks, gates and triggers.',
      outcomes: ['Distinguish gates from triggers.', 'Relate BPM, frequency, division, multiplication and swing.'],
    },
  },
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 3,
    id: 'oscillator',
    title: 'Oscillator Lab',
    route: '#/oscillator',
    status: 'accepted-behaviour-preserved',
    inputs: [
      input('pitch', 'Pitch CV', 'cv', voltageRange(-3, 3), 'Controls pitch at exactly 1 V/octave.'),
      input('modulation', 'Modulation CV', 'cv', voltageRange(-5, 5), 'Teaching input for pitch, pulse width or amplitude modulation.'),
    ],
    outputs: [
      output('waveform', 'Oscillator', 'audio', voltageRange(-10, 10), 'Simulated waveform voltage before the browser-audio demonstration boundary.'),
    ],
    visualisations: [
      { id: 'triggered-scope', label: 'Triggered oscilloscope', kind: 'oscilloscope', purpose: 'Keep the waveform stationary while frequency changes visible cycle density.' },
      { id: 'harmonics', label: 'Harmonic spectrum', kind: 'spectrum', purpose: 'Show the ideal harmonic family of the selected waveform.' },
    ],
    audio: browserAudio('Demonstrates pitch and waveform with a Web Audio oscillator; DC offset remains visual only.'),
    teaching: {
      purpose: 'Show how a repeating voltage becomes pitch, waveform and harmonic character.',
      outcomes: ['Connect frequency with visible period and pitch.', 'Use exact 1 V/octave pitch control.', 'Compare waveform families and harmonics.'],
    },
  },
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 4,
    id: 'quantizer',
    title: 'Quantizer Lab',
    route: '#/quantizer',
    status: 'accepted-behaviour-preserved',
    inputs: [
      input('pitch', 'Pitch CV', 'cv', voltageRange(-2, 4), 'Continuous voltage to move to the nearest permitted note.'),
      input('trigger', 'Sample trigger', 'trigger', voltageRange(0, 5), 'Updates the held quantized value in triggered mode.'),
    ],
    outputs: [output('quantized', 'Quantized CV', 'cv', voltageRange(-2, 4), 'Stepped 1 V/octave voltage belonging to the selected scale.')],
    visualisations: [
      { id: 'voltage-history', label: 'Voltage history', kind: 'history', purpose: 'Compare continuous input with the true stepped quantized output.' },
      { id: 'permitted-notes', label: 'Permitted notes', kind: 'readout', purpose: 'Make the selected root and scale inspectable.' },
    ],
    audio: browserAudio('Compares unquantized and quantized 1 V/octave pitches.'),
    teaching: {
      purpose: 'Show how continuous pitch CV is constrained to exact musical notes.',
      outcomes: ['Measure one semitone as exactly 1/12 V.', 'See held output remain unchanged until a trigger.'],
    },
  },
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 5,
    id: 'envelope',
    title: 'Envelope Lab',
    route: '#/envelope',
    status: 'accepted-behaviour-preserved',
    inputs: [
      input('gate', 'Gate', 'gate', voltageRange(0, 5), 'Holds the ADSR envelope through its sustain stage.'),
      input('trigger', 'Trigger', 'trigger', voltageRange(0, 5), 'Starts a one-shot envelope gesture.'),
    ],
    outputs: [output('envelope', 'Envelope CV', 'cv', voltageRange(0, 5), 'Continuous ADSR control voltage.')],
    visualisations: [
      { id: 'shape', label: 'ADSR shape', kind: 'response', purpose: 'Preview the configured attack, decay, sustain and release shape.' },
      { id: 'history', label: 'Envelope history', kind: 'history', purpose: 'Show the actual voltage and gate state through time.' },
    ],
    audio: browserAudio('Routes the envelope to loudness, filter brightness or oscillator pitch for comparison.'),
    teaching: {
      purpose: 'Show how gates and triggers create a changing control voltage.',
      outcomes: ['Identify ADSR stages.', 'See early release and retriggering preserve voltage continuity.'],
    },
  },
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 6,
    id: 'patch',
    title: 'Patch Lab',
    route: '#/patch',
    status: 'accepted-behaviour-preserved',
    inputs: [input('clock-reset', 'Clock reset', 'trigger', voltageRange(0, 5), 'Returns the demonstration sequence to step one.')],
    outputs: [
      output('sequence', 'Sequence CV', 'cv', voltageRange(-2, 4), 'Editable raw sequencer voltage.'),
      output('quantized', 'Quantized CV', 'cv', voltageRange(-2, 4), 'Scale-constrained sequencer voltage before octave and fine tuning.'),
      output('gate', 'Step gate', 'gate', voltageRange(0, 5), 'Marks active sequence steps and rests.'),
      output('audio', 'Patch audio', 'audio', normalisedAudioRange(), 'Browser-normalised result of the complete teaching voice.'),
    ],
    visualisations: [
      { id: 'sequence-overview', label: 'Sequence overview', kind: 'timeline', purpose: 'Show all eight raw and quantized steps.' },
      { id: 'signal-flow', label: 'Signal flow', kind: 'routing', purpose: 'Show the live event moving through the six-stage teaching patch.' },
    ],
    audio: browserAudio('Plays the first complete clock-to-sequencer-to-voice patch.'),
    teaching: {
      purpose: 'Combine the earlier timing, pitch and envelope concepts into a complete playable patch.',
      outcomes: ['Follow one event through the complete signal path.', 'Understand why inactive steps become rests.'],
    },
  },
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 7,
    id: 'filter',
    title: 'Filter Lab',
    route: '#/filter',
    status: 'accepted-behaviour-preserved',
    inputs: [
      input('audio', 'Audio', 'audio', normalisedAudioRange(), 'Oscillator signal to filter.'),
      input('cutoff', 'Cutoff CV', 'cv', voltageRange(-5, 5), 'Moves cutoff at exactly 1 V/octave.'),
      input('modulation', 'Modulation CV', 'cv', voltageRange(-5, 5), 'Bipolar source applied through the cutoff attenuverter.'),
      input('gate', 'Envelope gate', 'gate', voltageRange(0, 5), 'Starts or holds the built-in teaching envelope.'),
    ],
    outputs: [output('filtered', 'Filtered audio', 'audio', normalisedAudioRange(), 'Browser-normalised audio after the selected filter response.')],
    visualisations: [
      { id: 'frequency-response', label: 'Frequency response', kind: 'response', purpose: 'Show the selected filter response and resonance around cutoff.' },
      { id: 'harmonics', label: 'Filtered harmonics', kind: 'spectrum', purpose: 'Compare source harmonics with their post-filter levels.' },
      { id: 'modulation-history', label: 'Cutoff history', kind: 'history', purpose: 'Align cutoff, LFO and envelope movement.' },
    ],
    audio: browserAudio('Compares dry and filtered oscillator signals.'),
    teaching: {
      purpose: 'Show how a voltage-controlled filter removes or emphasises parts of a spectrum.',
      outcomes: ['Compare low-pass, high-pass, band-pass and notch responses.', 'Use exact 1 V/octave cutoff CV and bipolar modulation.'],
    },
  },
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 8,
    id: 'vca-mixer',
    title: 'VCA & Mixer Lab',
    route: '#/vca-mixer',
    status: 'accepted-behaviour-preserved',
    inputs: [
      input('channel-1', 'Channel 1 audio', 'audio', normalisedAudioRange(), 'First mixer signal, routed through the VCA.'),
      input('channel-2', 'Channel 2 audio', 'audio', normalisedAudioRange(), 'Second mixer signal.'),
      input('channel-3', 'Channel 3 audio', 'audio', normalisedAudioRange(), 'Third mixer signal.'),
      input('vca-cv', 'VCA CV', 'cv', voltageRange(0, 5), 'Controls first-channel gain from closed to unity.'),
      input('modulation', 'VCA modulation', 'cv', voltageRange(-5, 5), 'Bipolar modulation added through the attenuverter.'),
    ],
    outputs: [
      output('left', 'Left audio', 'audio', normalisedAudioRange(), 'Normalised left browser-audio result after mix and clipping.'),
      output('right', 'Right audio', 'audio', normalisedAudioRange(), 'Normalised right browser-audio result after mix and clipping.'),
    ],
    visualisations: [
      { id: 'vca-response', label: 'VCA response', kind: 'response', purpose: 'Compare linear and exponential gain curves.' },
      { id: 'mixed-waveform', label: 'Mixed waveform', kind: 'oscilloscope', purpose: 'Compare clean mathematical sum and clipped result.' },
      { id: 'level-history', label: 'CV and level history', kind: 'history', purpose: 'Align effective CV, VCA gain and mixer peak.' },
    ],
    audio: browserAudio('Compares VCA-only, clean, clipped and stereo mixer paths.'),
    teaching: {
      purpose: 'Show how control voltage becomes loudness and how audio signals add, pan, cancel and clip.',
      outcomes: ['Map 0–5 V to VCA gain.', 'See polarity cancellation, headroom and hard clipping.'],
    },
  },
  {
    interfaceVersion: MODULE_INTERFACE_VERSION,
    moduleNumber: 9,
    id: 'lfo-modulation',
    title: 'LFO & Modulation Lab',
    route: '#/lfo-modulation',
    status: 'accepted-behaviour-preserved',
    inputs: [input('reset', 'Phase reset', 'trigger', voltageRange(0, 5), 'Returns the LFO to the selected phase origin.')],
    outputs: [
      output('lfo', 'LFO CV', 'cv', voltageRange(-5, 5), 'Safe bipolar source after amplitude, offset and clamp.'),
      output('pitch', 'Pitch modulation', 'cv', voltageRange(-5, 5), 'Attenuverted copy for exact 1 V/octave oscillator pitch.'),
      output('cutoff', 'Cutoff modulation', 'cv', voltageRange(-5, 5), 'Attenuverted copy for exact 1 V/octave filter cutoff.'),
      output('gain', 'Gain modulation', 'cv', voltageRange(-5, 5), 'Attenuverted copy for VCA gain.'),
      output('pan', 'Pan modulation', 'cv', voltageRange(-5, 5), 'Attenuverted copy for stereo position.'),
    ],
    visualisations: [
      { id: 'lfo-scope', label: 'LFO waveform', kind: 'oscilloscope', purpose: 'Show raw and clamped control voltage as a stationary waveform.' },
      { id: 'oscillator-scope', label: 'Audible oscillator waveform', kind: 'oscilloscope', purpose: 'Keep the audible oscillator visually separate from the LFO.' },
      { id: 'destination-history', label: 'Destination history', kind: 'history', purpose: 'Compare the four independently attenuverted destinations.' },
    ],
    audio: browserAudio('Compares unmodulated and modulated oscillator/filter/VCA/pan paths.'),
    teaching: {
      purpose: 'Show how one bipolar repeating voltage can be scaled, inverted and routed to several destinations.',
      outcomes: ['Read LFO shape, rate, amplitude, offset and phase as voltage.', 'Use independent attenuverters for pitch, cutoff, gain and pan.'],
    },
  },
] as const;
