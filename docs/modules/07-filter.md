# Module 07 — Filter Lab

## Purpose

Filter Lab teaches how a voltage-controlled filter changes an oscillator by removing or emphasising parts of its frequency spectrum.

## Core signal path

```text
Oscillator → Filter → Audio
                ↑
Base cutoff + cutoff CV + modulation CV + LFO + envelope
```

## Filter types

- **Low-pass** keeps frequencies below cutoff and progressively reduces frequencies above it.
- **High-pass** keeps frequencies above cutoff and progressively reduces frequencies below it.
- **Band-pass** keeps a region around cutoff and reduces frequencies on both sides.
- **Notch** rejects a region around cutoff while allowing frequencies on both sides through.

## Cutoff and control voltage

Cutoff follows an exact 1 V/octave relationship:

```text
cutoff = base cutoff × 2^voltage
```

Therefore:

- `0 V` leaves the base cutoff unchanged.
- `+1 V` doubles cutoff.
- `−1 V` halves cutoff.
- `+2 V` raises cutoff by two octaves, or four times.

The supported display and model range is clamped from 20 Hz to 20 kHz.

## Modulation attenuverter

The modulation amount is bipolar:

- positive values make positive modulation open the filter;
- zero disconnects modulation;
- negative values reverse the movement, so positive modulation closes the filter.

The master amount affects modulation CV, LFO voltage and envelope voltage together.

## Resonance

Resonance, shown as Q, emphasises frequencies around cutoff. High resonance can make the cutoff boundary dominate the sound. It does not change the base cutoff frequency itself.

## LFO and envelope

The LFO provides repeating sine, triangle or square movement. The envelope provides a one-shot or held ADSR gesture controlled by the press-and-hold gate.

The live history shows:

- effective cutoff in gold;
- LFO voltage in blue;
- envelope voltage in green.

## Harmonic spectrum

The spectrum view compares the source oscillator's deterministic harmonics with the level of each harmonic after filtering. Saw, square, triangle and sine waves start with different harmonic structures.

## Audio comparison

Audio must be started explicitly. The user can hear:

- dry oscillator only;
- filtered oscillator only;
- both at once, with dry on the left and filtered on the right.

Mute and panic/stop remain explicit safety controls.

## Acceptance

The module is technically complete when its model tests and production build pass and GitHub Pages deploys. Live visual, interaction and listening acceptance remains a separate human action.
