# Voltage Lab

Voltage Lab is a suite of small visual and audible laboratories for learning control voltage and modular synthesis one concept at a time.

## Current modules

- **Sample & Hold Lab** — compare Sample & Hold, Track & Hold and Companion Hold with exact 1 V/octave audio, quantization and oscilloscope inspection.
- **Clock & Trigger Lab** — learn clocks, triggers, gates, divisions and timing relationships through visible and audible events.
- **Oscillator Lab** — see and hear waveform, frequency, harmonics and control-voltage modulation with a triggered stationary oscilloscope.
- **Quantizer Lab** — turn continuous CV into exact notes and scales using live or trigger-held quantization, stepped voltage history and audible comparison.
- **Envelope Lab** — shape a 0–5 V ADSR signal from gates and triggers, then route it to loudness, filter brightness or pitch.
- **Patch Lab** — combine clock, sequencer CV, scale quantization, oscillator and ADSR-controlled loudness into the first complete playable patch.

## Architecture

```text
apps/web/                    suite shell and routed modules
packages/cv-model/           deterministic Sample & Hold voltage behaviour
packages/clock-model/        deterministic clock, trigger and gate behaviour
packages/oscillator-model/   deterministic oscillator and modulation behaviour
packages/quantizer-model/    deterministic notes, scales and quantization behaviour
packages/envelope-model/     deterministic ADSR stage and retrigger behaviour
packages/patch-model/        deterministic sequencer transport and complete patch routing
packages/audio-safety/       shared browser-audio lifecycle and shutdown
packages/lessons/            reusable guided lesson contracts
packages/ui/                 shared visual tokens
```

## Development

```bash
npm install
npm run dev
npm run check
```

Every module must keep its mathematical behaviour in a tested model package and treat browser audio as an explicit, user-started demonstration layer.
