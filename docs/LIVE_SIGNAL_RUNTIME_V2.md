# Live Signal Runtime v2.0

Live Signal Runtime v2 adds an explicit time-varying source layer without weakening the v1 point-sample rules.

## What v2 adds

A module may register a serialisable periodic source containing:

- source endpoint and signal type;
- the accepted M09 periodic waveform family: `sine`, `triangle`, `square`, `saw-up`, `saw-down`, or `stepped-random`;
- frequency;
- amplitude and offset;
- phase;
- deterministic random seed;
- explicit start time;
- an optional **explicit source output clamp**.

The runtime never starts a hidden timer. A caller asks for a value at an explicit observation time, and the runtime evaluates the same source deterministically. Before the source start time, phase does not run backwards.

## M09 semantic compatibility

The periodic evaluator deliberately matches the already accepted LFO & Modulation model for its waveform shapes and deterministic stepped-random sequence.

M09 also has a visible safe ±5 V output clamp. v2 can represent that clamp only when it is explicitly present in the serialised source program. The runtime does not add clipping on its own.

This distinction matters:

- **No explicit source clamp:** the raw possible range (`offset - amplitude` through `offset + amplitude`) must fit the Port Contract or publication is refused.
- **Explicit source clamp:** the named clamp must itself fit the Port Contract. Evaluation applies that declared source behaviour exactly.

An explicit source clamp represents behaviour owned by the source module; it is not a hidden range adapter between modules.

## Cable truth

Time-varying values are delivered to inputs only through current real Connection Engine state.

If a cable is removed, the next sample still exists at the source output but there is no destination delivery. The runtime does not remember a stale destination value as though the cable were still present.

## Compatibility with v1

Point samples remain supported. Publishing an explicit point value on an output replaces any time-varying source registered on that same output, making the active source mode unambiguous.

## First intended integration

The first consumer should be Module 09 LFO & Modulation. Its real output can be represented as a periodic CV source and sampled through actual cables into oscillator, filter, and VCA modulation inputs.

Clock, gate, trigger, ADSR and other event-shaped sources remain later source-program types. v2.0 deliberately does not pretend a periodic source is sufficient for those semantics.

## Exclusions

This foundation does not change any accepted Lab UI, start browser audio, add animation loops, or make currently inactive rack controls appear live.
