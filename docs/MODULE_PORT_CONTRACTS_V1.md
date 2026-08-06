# Voltage Lab Module Port Contracts v1.0

Module Port Contracts v1.0 turns every input and output declared by Module Interface v1.0 into a stable socket contract for the Modular Playground.

Each endpoint is named `module-id:port-id` and carries its direction, signal type, declared range and teaching purpose. The accepted Modules 01–09 remain unchanged.

## Compatibility outcomes

| Outcome | Meaning |
| --- | --- |
| Direct | Output and input meanings are compatible and the source fits the destination range. |
| Event conversion | Clock, gate and trigger remain different meanings, but one timing/event pulse may deliberately drive another timing/event input. |
| Range adaptation required | The signal meaning is compatible, but the source can exceed the input's declared range. |
| Representation adaptation required | The signal meaning is compatible, but conceptual voltage and browser-normalised audio meet at an explicit boundary. |
| Incompatible | Direction is wrong or the signal meanings are not compatible in v1.0. |

## Teaching rules

- Patches always travel output to input.
- Audio, CV, clock, gate and trigger keep the meanings defined by Signal Specification v1.0.
- Clock, gate and trigger may interact, but the compatibility result names the semantic conversion instead of pretending they are synonyms.
- A wider source range is never silently treated as safe for a narrower destination.
- Conceptual modular audio voltage and browser-normalised audio are never silently treated as the same representation.

## Deliberate boundary

This layer answers whether two declared sockets can form a meaningful relationship and what adaptation that relationship will need. It does not create or store connections, move signal values, draw cables, route Web Audio nodes, inspect signals, save patches or implement missions. Those remain later Modular Playground units.
