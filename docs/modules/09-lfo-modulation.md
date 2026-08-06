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

The stationary graph shows two cycles. Blue is the raw voltage before the safety clamp; gold is the routed source voltage. The moving dot shows the current phase without making the trace itself scroll.

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
2. Compare all six source shapes.
3. Raise amplitude and offset until the raw blue trace exceeds ±5 V; confirm the gold trace and output readout clamp safely.
4. Move each destination amount through positive, zero and negative values.
5. Set Pitch amount so the route reaches +1 V; confirm oscillator frequency doubles.
6. Set Filter amount so the route reaches +1 V; confirm cutoff doubles.
7. Confirm VCA gain never leaves 0–100% and pan never exceeds full left or right.
8. Use Stepped random and confirm each value holds for one complete cycle.
9. Try Vibrato, Tremolo, Filter sweep, Auto-pan and Multi-route presets.
10. Start audio and compare Unmodulated, Modulated and Both.
