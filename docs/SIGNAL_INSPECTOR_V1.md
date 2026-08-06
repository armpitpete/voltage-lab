# Voltage Lab Signal Inspector v1.0

Signal Inspector v1.0 is the read-only teaching layer for the Modular Playground. Given a declared socket and, when available, one numeric sample, it reports what the signal means before a learner is asked to patch it.

## What it shows

- module and socket identity, including input/output direction
- signal type, rate, polarity and timing meaning
- the socket's declared range, unit and teaching domain
- whether an optional observed value is within, above or below that declared range
- a numeric position within the range, without silently clipping an unsafe value

## Teaching rules

- A signal is explained through its destination and representation, not only its number.
- Audio in conceptual modular volts and browser-normalised audio remain visibly distinct.
- Clock, gate and trigger retain their different time meanings.
- Values beyond a socket's declared range are shown as evidence, never quietly repaired.

## Deliberate boundary

This release inspects declarations plus caller-supplied samples only. It does not sample a live connection, store a patch, draw cables, move signals or route Web Audio. Those belong to the later patch canvas and connection engine.
