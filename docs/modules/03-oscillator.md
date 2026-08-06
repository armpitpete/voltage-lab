# Module 03: Oscillator Lab

The Oscillator Lab teaches how a repeating voltage becomes pitch, waveform and harmonic character.

## Learn mode

Eight guided experiments cover repetition, frequency and pitch, 1 V/octave, waveform families, pulse width, phase, amplitude and DC offset, and harmonics.

## Explore mode

Explore exposes the full control surface:

- sine, triangle, saw, square and pulse waveforms;
- 20 Hz to 1 kHz base frequency;
- ±3 V pitch input at 1 V/octave;
- octave and cent tuning;
- pulse width, phase, amplitude and DC offset;
- safe browser volume, mute and panic/stop.

## Evidence

The oscilloscope uses a fixed 20 ms time window. Frequency therefore changes the visible cycle density: 220 Hz shows 4.4 cycles, while 440 Hz shows 8.8 cycles in the same width. A gold marker identifies the current sample and the current-voltage readout follows it. Motion is time-expanded so audio-rate movement remains inspectable, while cycle density, frequency and period use the real oscillator values. The trace shows waveform shape, amplitude, offset and phase. The harmonic spectrum shows the ideal relative harmonic family for the selected waveform.

## Safety and boundaries

Audio starts only after explicit user action. Frequency is clamped to 20–18,000 Hz, gain begins at zero, and panic/stop disconnects and closes the audio context. Phase and DC offset are visual teaching controls; browser oscillator playback demonstrates pitch and waveform character without pretending to output physical DC voltage.

Future hard sync, FM, phase modulation and wave morphing remain separate planned lessons rather than hidden controls in this module.
