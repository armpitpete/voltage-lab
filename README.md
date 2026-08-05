# Voltage Lab

Voltage Lab is a suite of small visual and audible laboratories for learning control voltage and modular synthesis one concept at a time.

## Current module

- **Sample & Hold Lab** — migrated as the first module with Sample & Hold, Track & Hold, Companion Hold, exact 1 V/octave audio, selectable references, semitone quantization, three-voice mute/solo, slow motion, stepping and oscilloscope cursors.

## Architecture

```text
apps/web/                 suite shell and routed modules
packages/cv-model/        deterministic voltage and pitch behaviour
packages/audio-safety/    shared browser-audio lifecycle and shutdown
packages/lessons/         reusable guided lesson contracts
packages/ui/              shared visual tokens
```

No second module begins until Sample & Hold parity is validated in this shared architecture.

## Development

```bash
npm install
npm run dev
npm run check
```

## Migration safety

The standalone `armpitpete/sample-hold-lab` deployment remains available until this suite deployment receives visual and audio acceptance. It is not deleted or redirected by this foundation release.
