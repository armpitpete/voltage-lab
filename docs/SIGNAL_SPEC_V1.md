# Voltage Lab Signal Specification v1.0

Signal Specification v1.0 gives the Modular Playground one shared meaning for each signal type already named by Module Interface v1.0.

It defines **semantics**, not patch permissions. Module Port Contracts will decide whether a particular output may connect to a particular input.

## Shared signal types

| Type | What the value means | Timing meaning | Teaching domain |
| --- | --- | --- | --- |
| Audio | Continuously changing waveform | Continuous | Conceptual -10 to +10 V; browser audio -1 to +1 normalised |
| CV | Continuously changing control value | Continuous | -10 to +10 V envelope; individual ports may use narrower ranges |
| Clock | Repeating timing pulse | Rising edges provide the timebase | 0 to 5 V |
| Gate | Held active/inactive state | High duration matters | 0 to 5 V |
| Trigger | One short event | Rising edge is the event | 0 to 5 V |

## Rules carried forward

- `audio`, `cv`, `clock`, `gate` and `trigger` are the complete v1 signal vocabulary.
- Audio and CV are not interchangeable merely because both can vary continuously.
- Clock, gate and trigger are not synonyms: repetition, held duration and one-shot event meaning stay distinct.
- A browser audio value from -1 to +1 is explicitly normalised and must not be labelled as volts.
- The ranges here are the supported teaching domains. A module port may deliberately declare a narrower range.
- Accepted Modules 01–09 keep their existing behaviour and UI.

## Deliberate boundary

This layer does not define socket compatibility, range adaptation, connection state, cable direction, inspector behaviour, patch persistence or audio routing. Those belong to later Modular Playground units.
