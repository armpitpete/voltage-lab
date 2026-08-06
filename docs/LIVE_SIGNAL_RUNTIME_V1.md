# Live Signal Runtime v1.0

Live Signal Runtime turns declared output values into inspectable, routed signal evidence.

## What it does

1. Accepts a finite value only from a declared output socket with the matching signal type and declared range.
2. Retains the latest value per output socket.
3. Uses Connection Engine's existing real direct connections to derive delivered input values.
4. Produces Inspector-compatible observations for either the source output or destination input.

## First audible vertical slice

Patch Canvas publishes the declared `Envelope CV` output. Only when the real `Envelope CV → VCA CV` cable exists does the runtime deliver that value to the VCA input. The bounded Full Synth Voice uses this delivered input value for its gain; removing the cable returns it to silence.

## Safety and teaching boundaries

- Values outside declared ranges are rejected; they are never clipped or adapted silently.
- The runtime does not change Modules 01–09 or read their independent accepted controls.
- This is not general browser-audio routing, persistent patch state, or a claim that every module runtime has been connected.
- Audio still requires explicit user start and retains panic stop.
