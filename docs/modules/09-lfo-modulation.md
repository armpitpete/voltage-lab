# Module 09 — LFO & Modulation Lab

## Governing lesson

An LFO is a repeating control voltage. Its shape, rate, amplitude, offset and phase define the source. Attenuverters then scale, remove or invert copies of that source before each destination applies its own safe range.

## Source contract

- Shapes: sine, triangle, square, rising saw, falling saw and deterministic stepped random.
- Rate: 0.05–20 Hz.
- Amplitude: 0–5 V from the waveform centre.
- DC offset: -5 to +5 V.
- Phase: -180° to +180° plus explicit reset.
- Safe output: clamped to -5 to +5 V after amplitude and offset are combined.

The stationary LFO graph shows two cycles. Blue is the raw voltage before the safety clamp; gold is the routed source voltage. The moving dot shows the current LFO phase without making the trace itself scroll.

## Audible oscillator view

The LFO control waveform and the audible oscillator waveform are separate signals and therefore have separate displays.

- The stationary LFO graph follows the **LFO Shape** selector.
- The stationary audible-oscillator graph follows the **Oscillator waveform** selector.
- Saw, square, triangle and sine selections update both the browser audio oscillator and the audible-oscillator trace.
- The audible trace keeps three fixed cycles visible so waveform shape remains legible.
- The current modulated oscillator frequency appears beside the trace; pitch modulation changes that readout rather than changing the displayed cycle count.
- The moving dot on the audible trace is deliberately slowed for inspection and is not an audio-rate timing display.

## Destination contract

The same source is copied to four independent bipolar attenuverters:

1. Oscillator pitch — exact 1 V/octave.
2. Filter cutoff — exact 1 V/octave.
3. VCA loudness — clamped to 0–100% gain.
4. Stereo pan — clamped fully left to fully right.

Positive amount follows the source, zero disconnects the movement and negative amount reverses it.

## Audio comparison

The browser audio layer provides:

- unmodulated patch,
- modulated patch,
- stereo comparison with dry left and modulated right.

Audio begins only after an explicit user action and includes mute and panic/stop controls.

## Acceptance checks

1. Reset phase and confirm the dot returns to the phase selected by the phase control.
2. Compare all six LFO source shapes and confirm the stationary LFO graph changes.
3. Raise amplitude and offset until the raw blue trace exceeds ±5 V; confirm the gold trace and output readout clamp safely.
4. Move each destination amount through positive, zero and negative values.
5. Set Pitch amount so the route reaches +1 V; confirm oscillator frequency doubles.
6. Set Filter amount so the route reaches +1 V; confirm cutoff doubles.
7. Confirm VCA gain never leaves 0–100% and pan never exceeds full left or right.
8. Use Stepped random and confirm each value holds for one complete cycle.
9. Try Vibrato, Tremolo, Filter sweep, Auto-pan and Multi-route presets.
10. Change Oscillator waveform through Saw, Square, Triangle and Sine; confirm both the sound and the separate audible-oscillator trace change.
11. Start audio and compare Unmodulated, Modulated and Both.
