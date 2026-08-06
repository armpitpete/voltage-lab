# Module 05 — Envelope Lab

## Governing question

How does a gate or trigger create a changing control voltage, and what happens when that voltage controls different parts of a synthesizer?

## Core model

The module uses a deterministic linear ADSR envelope from 0 V to 5 V:

- **Attack** rises from the current voltage to 5 V.
- **Decay** falls from 5 V to the sustain voltage.
- **Sustain** is a level held while the gate remains high.
- **Release** falls from the current voltage to 0 V after the gate ends.

Retriggering starts a new attack from the current voltage. It must not introduce a discontinuous jump.

## Interactive controls

- attack, decay, sustain and release
- press-and-hold gate
- one-shot trigger with adjustable gate length
- repeating gate with tempo and gate-length controls
- destination: VCA loudness, low-pass filter brightness or oscillator pitch
- oscillator waveform and base frequency
- dry, enveloped and stereo comparison modes
- explicit audio start, mute and panic/stop

## Visual contract

The module provides two distinct views:

1. A stationary shape preview showing the configured ADSR stages.
2. A live eight-second voltage history showing the actual envelope, gate-high band and continuous retriggers.

Readouts show current voltage, stage, gate state, stage elapsed time and destination value.

## Acceptance contract

- attack reaches 5 V at the configured attack time
- decay reaches the selected sustain voltage at the configured decay time
- sustain remains stable while the gate is high
- release begins from the current voltage and reaches 0 V at the configured release time
- ending the gate during attack or decay starts release from the current voltage
- retriggering begins from the current voltage without a jump
- the repeating gate is deterministic for a given tempo and gate percentage
- audio begins only after explicit user action and panic/stop closes it
