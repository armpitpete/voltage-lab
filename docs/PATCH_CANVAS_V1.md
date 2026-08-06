# Patch Canvas v1.0

Patch Canvas is the first visual planning surface for Voltage Lab's Modular Playground. It lets a learner select one declared output and one declared input, see their signal contracts and inspect the proposed direction.

## What it does

- lists only the ports declared by Module Interface and Module Port Contracts
- starts with an output, then asks for an input
- evaluates the selected route through the shared compatibility rules
- shows direct compatibility, required range/representation adaptation, or a clear rejection reason
- draws a dashed proposed direction labelled **not connected**

## Teaching truth

A visual route is not a patch. The canvas calls out signal direction, type, range and the browser-audio representation boundary so learners do not infer that similarly named sockets are automatically interchangeable.

## Boundary

This release creates no connection state, cable, signal movement, audio routing, saved patch or module-side effect. The Connection Engine is the next unit that may turn a compatible proposal into an actual patch.

Existing Module 01–09 controls, models, visuals and audio remain unchanged.
