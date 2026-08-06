# Connection Engine v1.0

Connection Engine turns a declared, directly compatible route into real patch state. Each connection has a stable ID, source socket, destination socket and Port Contracts evidence.

## What it does

- creates serialisable patch state
- connects a declared output to a declared input only when their contract is directly compatible
- permits one source per input and fan-out from one output to several inputs
- removes a connection by its stable ID
- propagates validated signal frames to connected destinations for inspection

## Teaching truth

A connection is now real: its state can be inspected and direct frames travel from source to destination. This release still does not alter a module model, make sound, or draw a cable. The next visual-cables unit makes the actual state visible; later module integration maps deliveries into each module's teaching model and audio boundary.

## Explicit exclusions

- no automatic voltage-range scaling or browser-audio representation conversion
- no connection when a route needs an adapter
- no browser-audio routing
- no changes to Module 01–09 controls, models, visuals or demonstrations
- no patch save/load format or UI
