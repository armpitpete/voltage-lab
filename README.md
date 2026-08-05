# Voltage Lab

Voltage Lab is a suite of focused, interactive laboratories for learning modular synthesis and control voltage.

Each lab teaches one concept through visible signals, audible behaviour, guided experiments and plain-language explanations.

## Product principles

- One concept per laboratory.
- Voltage and timing remain visible.
- Audio demonstrates the same signal being shown.
- Controls must work with mouse, touch and keyboard.
- No lesson depends on hover, right-click, tiny handles or precision dragging.
- Shared tools and terminology stay consistent across every module.
- The suite is educational software, not a general-purpose modular synthesiser.

## Planned laboratories

1. Sample & Hold
2. Clock
3. Quantizer
4. LFO
5. Envelope
6. Attenuverter and offset
7. Comparator
8. Logic
9. Sequencer
10. Oscillator
11. VCA
12. Filter

## Intended repository structure

```text
apps/
  web/                 Suite shell, navigation and curriculum
  sample-hold/         First migrated laboratory
  clock/
  quantizer/
  lfo/
  envelope/

packages/
  ui/                  Shared accessible controls and layout
  cv-model/            Voltage, pitch and quantization functions
  audio/               Safe Web Audio helpers
  scope/               Oscilloscope and measurement tools
  timeline/            Clock, gate and trigger displays
  lessons/             Guided experiment contracts

curriculum/             Learning order and terminology
docs/                   Architecture, design and contribution rules
```

## Current protected boundary

The existing `armpitpete/sample-hold-lab` repository remains the live production source until its behaviour is reproduced and independently validated inside this monorepo.

No redirect, archive or shutdown of the existing app is authorised by this foundation commit.
