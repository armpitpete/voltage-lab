# Module 06 — Patch Lab

Patch Lab is the first complete playable Voltage Lab signal chain. It combines the concepts already established in Clock & Trigger, Quantizer, Oscillator and Envelope.

## Signal path

```text
Clock → eight-step sequencer CV → quantizer → oscillator → ADSR / VCA → audio
```

Each stage has one clear responsibility:

- the clock decides **when** the sequence moves
- the sequencer supplies an editable control voltage
- the gate switch decides whether the step sounds or becomes a rest
- the quantizer restricts voltage to the selected root and scale
- the oscillator converts exact 1 V/oct voltage into frequency
- the envelope turns the gate into a changing 0–5 V amplitude signal
- the VCA applies that envelope to the audible oscillator

## Mathematical contract

- one semitone is exactly `1/12 V`
- adding `1 V` doubles oscillator frequency
- the clock step duration is `60000 / BPM / steps-per-beat`
- inactive steps never produce a gate
- gate length is a percentage of the deterministic step duration
- octave offsets add whole volts after quantization
- fine tuning adds cents as `cents / 1200 V`

## Interaction

The user can:

- edit all eight sequence voltages
- enable or disable each step gate
- start, stop, reset or manually advance the transport
- change tempo and quarter/eighth/sixteenth-note rate
- choose root and scale
- change oscillator waveform, octave and fine tuning
- alter the ADSR amplitude envelope
- load three deterministic teaching presets
- rotate the sequence without changing its contents
- inspect raw CV, quantized CV, note, frequency, gate and envelope voltage
- see the live event move through the complete patch path
- hear the resulting patch after explicitly starting browser audio

## Acceptance checks

1. Start the transport and confirm the highlighted step advances evenly.
2. Stop the transport and confirm the current step remains held.
3. Reset and confirm the sequence returns to step 1.
4. Disable a step gate and confirm that step becomes a visible and audible rest.
5. Change root or scale and confirm every gold output remains a permitted note.
6. Increase Octave by one and confirm frequency doubles.
7. Change attack and release and confirm separate notes become softer or more connected.
8. Compare the stationary eight-step overview with the live history.
9. Confirm mute and panic/stop silence browser audio.
