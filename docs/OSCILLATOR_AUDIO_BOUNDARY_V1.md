# Oscillator Audio Boundary v1.0

Module 03 remains the owner of its accepted oscillator lesson, controls, scope and standalone Web Audio demonstration. It additionally publishes the current waveform, frequency, pulse width and peak amplitude as a finite source record.

Patch Canvas has no hidden default or substitute oscillator. Its M03 rack card can explicitly publish the visible waveform, pitch, amplitude and pulse-width settings as the source record; Oscillator Lab can still publish its own record. Patch Canvas cannot start until one of those explicit records exists.

The explicit patch route is:

1. `Oscillator waveform (±10 V)` → `Browser Audio Boundary input (±10 V)`
2. `Browser Audio Boundary normalised output (-1…1)` → `Filter audio`
3. `Filter audio` → `VCA channel 1`
4. `Envelope CV` → `VCA CV`

The boundary converts a known conceptual peak voltage to browser normalisation by dividing it by 10. It does not silently clip, scale arbitrary signals or imply a general adapter system. Patch Canvas re-renders the published Module 03 configuration because an AudioNode is route-local and is not transported between labs.

Audio remains explicitly started, peak-limited and panic-stoppable. Removing any required cable stops the monitor.
