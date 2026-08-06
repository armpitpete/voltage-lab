import { describe, expect, it } from 'vitest';
import {
  createPatchCanvasProposal,
  listPatchCanvasInputs,
  listPatchCanvasOutputs,
} from './index';

describe('Patch Canvas v1.0', () => {
  it('starts by asking for a declared output, then a declared input', () => {
    expect(createPatchCanvasProposal().stage).toBe('choose-output');
    const output = createPatchCanvasProposal({ sourceEndpointId: 'clock-and-trigger:clock' });
    expect(output.stage).toBe('choose-input');
    expect(output.source?.direction).toBe('output');
  });

  it('proposes a directly compatible timing route without creating a connection', () => {
    const proposal = createPatchCanvasProposal({
      sourceEndpointId: 'clock-and-trigger:clock',
      destinationEndpointId: 'sample-and-hold:event',
    });
    expect(proposal.stage).toBe('proposal-ready');
    expect(proposal.compatibility).toMatchObject({ compatible: true, level: 'direct', semantic: 'event-conversion' });
    expect(proposal.route).toMatchObject({ direction: 'output-to-input', style: 'direct' });
    expect(proposal.limitation).toContain('does not create connection state');
  });

  it('keeps required range and representation adaptations visible', () => {
    const range = createPatchCanvasProposal({
      sourceEndpointId: 'lfo-modulation:lfo',
      destinationEndpointId: 'oscillator:pitch',
    });
    expect(range.compatibility).toMatchObject({ compatible: true, level: 'adaptation-required', adaptation: 'range' });

    const representation = createPatchCanvasProposal({
      sourceEndpointId: 'oscillator:waveform',
      destinationEndpointId: 'filter:audio',
    });
    expect(representation.compatibility).toMatchObject({ compatible: true, adaptation: 'representation' });
  });

  it('rejects wrong-direction and wrong-signal plans without hiding the reason', () => {
    const direction = createPatchCanvasProposal({
      sourceEndpointId: 'envelope:gate',
      destinationEndpointId: 'clock-and-trigger:clock',
    });
    expect(direction.stage).toBe('proposal-rejected');
    expect(direction.compatibility?.reason).toContain('output socket');

    const signal = createPatchCanvasProposal({
      sourceEndpointId: 'oscillator:waveform',
      destinationEndpointId: 'envelope:trigger',
    });
    expect(signal.stage).toBe('proposal-rejected');
    expect(signal.compatibility?.reason).toContain('does not satisfy');
  });

  it('offers exactly the declared output and input sockets', () => {
    expect(listPatchCanvasOutputs().every((port) => port.direction === 'output')).toBe(true);
    expect(listPatchCanvasInputs().every((port) => port.direction === 'input')).toBe(true);
    expect(listPatchCanvasOutputs()).toHaveLength(23);
    expect(listPatchCanvasInputs()).toHaveLength(20);
  });
});
