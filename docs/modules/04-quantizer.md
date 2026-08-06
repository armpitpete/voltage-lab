# Module 04: Quantizer Lab

The Quantizer Lab teaches how continuous 1 V/octave control voltage is moved to the nearest permitted musical note.

## Learn mode

Eight guided experiments cover continuous and stepped voltage, the exact 1/12 V semitone, one volt per octave, scale selection, root movement, correction distance, trigger-held quantization and audible comparison.

## Explore mode

Explore exposes the complete teaching surface:

- −2 V to +4 V continuous input;
- automatic triangle-wave CV sweep;
- chromatic, major, natural minor, major pentatonic and minor pentatonic scales;
- all twelve root notes;
- live and trigger-held update modes;
- manual trigger and 30–240 BPM internal teaching clock;
- unquantized, quantized and combined audio comparison;
- safe volume, mute and panic/stop.

## Evidence

The voltage-history display uses blue for continuous input and gold for quantized output. The gold trace is drawn as a true staircase. In triggered mode it holds its previous value until a manual or clock trigger arrives. Vertical marks identify trigger events.

Readouts report input voltage, quantized voltage, correction in cents, input and output notes, frequency and update state. The permitted-note grid makes the selected root and scale inspectable rather than implicit.

## Mathematical contract

- one octave = exactly 1 V;
- one semitone = exactly 1/12 V;
- frequency = C4 × 2^volts;
- quantized output is the nearest integer semitone whose pitch class belongs to the selected root and scale;
- exact midpoint ties resolve downward for deterministic behaviour.

## Audio boundary

Audio begins only after explicit user action. The unquantized voice is a sine wave panned left and the quantized voice is a triangle wave panned right when Both is selected. This separation is for comparison, not a claim that quantizers alter waveform shape. Panic/stop closes the audio context.
