# Voltage Lab architecture

## Rules

1. Every laboratory teaches one bounded concept.
2. Shared signal mathematics belongs in `packages/cv-model`.
3. Browser audio creation and shutdown belong in `packages/audio-safety`.
4. Guided experiments use the shared lesson contract.
5. No action depends on hover, right-click, tiny handles or precision dragging.
6. Every audible module provides an immediate panic/stop control.
7. Tests must cover deterministic mathematics before deployment.

## Module route

The first route is `#/sample-and-hold`. Future modules must reuse the suite shell and shared packages rather than duplicating their own app infrastructure.
