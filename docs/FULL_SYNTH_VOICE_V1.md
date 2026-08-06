# Full Synth Voice v1.0

Full Synth Voice adds a safe browser-audio reference voice to Patch Canvas only when its actual Connection Engine state contains all three direct cables:

1. `Patch audio` → `Filter audio`
2. `Filtered audio` → `VCA channel 1`
3. `Envelope CV` → `VCA CV`

The rendered monitor is deliberately bounded: audio starts only from its explicit control, its output level is capped, and panic stop closes the browser audio context. Removing a required cable stops the monitor.

## Teaching truth

The monitor represents the declared `Patch audio` socket with a safe reference oscillator. It demonstrates the live patched signal structure and does **not** read or modify Module 06's independently accepted controls. The original Module 01–09 labs remain independent demonstrations.

## Boundary

This does not add automatic range or representation adaptation, patch persistence, audio inputs/outputs for every declared socket, or module-runtime state sharing. Those are later integration units.
