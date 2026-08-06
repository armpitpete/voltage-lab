# Visual Patch Cables v1.0

Visual Patch Cables makes Connection Engine's real direct patch state visible in Patch Canvas.

## What it does

- draws a solid, directional SVG cable for every real direct connection
- labels each cable's source, destination and signal type
- exposes a keyboard-labelled control to remove the underlying connection
- keeps output fan-out visible as distinct cables

## Teaching truth

A dashed line remains a proposal. A solid cable with an arrow exists only after Connection Engine has accepted and stored the route. Removing the cable removes that exact connection state.

## Boundary

This unit does not create browser-audio routing, alter module models, add automatic adaptation, save patches, or change accepted Modules 01–09.
