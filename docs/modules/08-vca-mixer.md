# Module 08 — VCA & Mixer Lab

## Governing question

How does control voltage become loudness, and what happens when several audio signals are added together?

## Core model

The first mixer channel passes through a voltage-controlled amplifier before summing:

```text
bias CV + (modulation CV × attenuverter)
                ↓ clamp to 0–5 V
          linear or exponential gain
                ↓
          channel 1 audio level
```

The three mixer channels then apply:

```text
source sample × level × VCA gain × polarity × pan
```

Muted channels contribute zero. The stereo channels are summed, multiplied by master drive and compared with a fixed ±1.00 clipping limit.

## Learning sequence

1. Confirm that 0 V closes the VCA and 5 V produces unity gain.
2. Compare linear and exponential response at the same intermediate CV.
3. Use the attenuverter to reverse LFO or envelope movement.
4. Hold and release the ADSR gate to create one amplitude gesture.
5. Raise three channel levels and inspect the clean mathematical sum.
6. Use matched sources with opposite polarity to demonstrate cancellation.
7. Reduce headroom with master drive.
8. Compare the clean waveform with the hard-clipped waveform.

## Audio comparison modes

- **VCA channel only** — isolates the voltage-controlled first channel.
- **Clean mixer** — plays the unclipped three-channel sum.
- **Clipped mixer** — routes the same sum through a hard-clipping transfer.
- **Both** — clean mix on the left and clipped mix on the right.

Browser audio starts only after an explicit user action. Mute and panic/stop remain available at all times.

## Acceptance contract

- 0 V produces zero VCA gain.
- 5 V produces unity VCA gain.
- Exponential response is below linear response between the endpoints.
- Bipolar attenuation can reverse modulation direction.
- Effective VCA CV never leaves 0–5 V.
- Muted channels do not enter the sum.
- Equal, phase-aligned opposite-polarity channels cancel.
- Equal-power pan reaches full left, centre and full right predictably.
- Headroom is positive below the clipping limit and negative above it.
- Hard-clipped output never exceeds ±1.00.
- Visual and audible controls update without restarting audio.
- Tests and the production build pass.
