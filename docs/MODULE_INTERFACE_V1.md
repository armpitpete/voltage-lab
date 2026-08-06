# Voltage Lab Module Interface v1.0

Module Interface v1.0 is the descriptive boundary between the nine accepted teaching laboratories and the future Modular Playground.

It does **not** rewire or replace an accepted module. It records what each module already teaches and exposes so later shared systems can reason about modules without reaching into their UI code.

## Required declaration

Every module declares:

- stable module number, id, title and route;
- conceptual inputs and outputs;
- a signal type for every port;
- a range for every port, using volts where the model represents voltage and an explicit normalised-audio range at the browser-audio boundary;
- the visualisations that make its behaviour inspectable;
- browser-audio behaviour and safety controls;
- one teaching purpose with concrete learning outcomes;
- `accepted-behaviour-preserved` status.

## Important boundary

The v1 ports are **declarations**, not live patch sockets. Their signal names and ranges describe today's accepted models.

The next Signal Specification layer will define shared signal semantics. Module Port Contracts will then turn compatible declarations into enforceable connection rules. The interface deliberately does not implement signal compatibility, connection state, cables, inspectors or patch persistence yet.

## Validation

`validateModuleInterface()` rejects duplicate module identities, duplicate routes, duplicate per-module port ids, invalid ranges, missing teaching/visualisation declarations, wrong port directions, and audible modules without both explicit start and panic/stop.

The registry in `packages/module-interface/src/modules.ts` contains Modules 01–09 only. Adding a new accepted module requires adding a declaration and keeping the interface tests green.
