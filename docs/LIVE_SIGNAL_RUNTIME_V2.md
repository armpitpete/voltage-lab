# Live Signal Runtime v2.0

Live Signal Runtime v2 adds an explicit time-varying source layer without weakening the v1 point-sample rules.

## What v2 adds

A module may register a serialisable periodic source containing:

- source endpoint and signal type;
- waveform (`sine`, `triangle`, `saw`, or `square`);
- frequency;
- amplitude and offset;
- phase;
- explicit start time.

The runtime never starts a hidden timer. A caller asks for a value at an explicit observation time, and the runtime evaluates the same source deterministically.

## Cable truth

Time-varying values are delivered to inputs only through current real Connection Engine state.

If a cable is removed, the next sample still exists at the source output but there is no destination delivery. The runtime does not remember a stale destination value as though the cable were still present.

## Range boundary

The whole possible periodic range (`offset - amplitude` through `offset + amplitude`) must fit inside the declared source Port Contract before the source is accepted.

The runtime does not:

- clip an oversized source;
- scale it to fit;
- convert signal types;
- add a hidden adapter.

## Compatibility with v1

Point samples remain supported. Publishing an explicit point value on an output replaces any time-varying source registered on that same output, making the active source mode unambiguous.

## First intended integration

The first consumer should be Module 09 LFO & Modulation. Its real output can be represented as a periodic CV source and sampled through actual cables into oscillator, filter, and VCA modulation inputs.

Clock, gate, trigger, ADSR and other event-shaped sources remain later source-program types. v2.0 deliberately does not pretend a periodic source is sufficient for those semantics.

## Exclusions

This foundation does not change any accepted Lab UI, start browser audio, add animation loops, or make currently inactive rack controls appear live.
