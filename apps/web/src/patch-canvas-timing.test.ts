import { describe, expect, it } from 'vitest';
import { connectPorts, createPatchState } from '../../../packages/connection-engine/src/index';
import {
  PatchCanvasTimingController,
  m02RackControlsMarkup,
  m05RackControlsMarkup,
  timingWorkbenchMarkup,
} from './patch-canvas-timing';

function gatePatch() {
  return connectPorts(createPatchState(), 'clock-and-trigger:gate', 'envelope:gate');
}

function triggerPatch() {
  return connectPorts(createPatchState(), 'clock-and-trigger:trigger', 'envelope:trigger');
}

describe('Patch Canvas M02 → M05 timing integration', () => {
  it('delivers a real M02 Gate edge into the accepted M05 envelope', () => {
    const patch = gatePatch();
    expect(patch.status).toBe('connected');
    const controller = new PatchCanvasTimingController(0);
    controller.updateM05({ attackMs: 100, decayMs: 100, sustainLevel: 0.5, releaseMs: 200 }, 0);
    controller.sample(patch.state, 450);
    const afterRise = controller.sample(patch.state, 550);
    expect(afterRise.gateCableConnected).toBe(true);
    expect(afterRise.m05GateHigh).toBe(true);
    expect(afterRise.m05Stage).toBe('attack');
    expect(afterRise.m05Voltage).toBeCloseTo(2.5);
  });

  it('preserves an M02 Trigger rising edge as an M05 one-shot after the physical pulse ended', () => {
    const patch = triggerPatch();
    expect(patch.status).toBe('connected');
    const controller = new PatchCanvasTimingController(0);
    controller.sample(patch.state, 450);
    const afterPhysicalPulse = controller.sample(patch.state, 600);
    expect(afterPhysicalPulse.triggerCableConnected).toBe(true);
    expect(afterPhysicalPulse.m02Levels.trigger).toBe(false);
    expect(afterPhysicalPulse.m05GateHigh).toBe(true);
    expect(afterPhysicalPulse.m05Voltage).toBeGreaterThan(0);
    expect(afterPhysicalPulse.deliveriesThisWindow).toBeGreaterThanOrEqual(2);
  });

  it('releases a held M05 Gate immediately when the real M02 Gate cable disappears', () => {
    const patch = gatePatch();
    expect(patch.status).toBe('connected');
    const controller = new PatchCanvasTimingController(0);
    controller.sample(patch.state, 450);
    const held = controller.sample(patch.state, 550);
    expect(held.m05GateHigh).toBe(true);

    const disconnected = controller.reconcilePatch(createPatchState(), 560);
    expect(disconnected.gateCableConnected).toBe(false);
    expect(disconnected.m05GateHigh).toBe(false);
    expect(disconnected.m05Stage).toBe('release');
  });

  it('does not retroactively deliver an edge that happened before a cable was connected', () => {
    const controller = new PatchCanvasTimingController(0);
    controller.sample(createPatchState(), 505);
    const patch = triggerPatch();
    expect(patch.status).toBe('connected');
    controller.reconcilePatch(patch.state, 505);
    const shortlyAfterConnection = controller.sample(patch.state, 510);
    expect(shortlyAfterConnection.m05Stage).toBe('idle');
    expect(shortlyAfterConnection.m05Voltage).toBe(0);

    const nextBeat = controller.sample(patch.state, 1001);
    expect(nextBeat.m05GateHigh).toBe(true);
    expect(nextBeat.m05Stage).toBe('attack');
  });

  it('renders the live timing controls and real-cable status without claiming hidden routes', () => {
    const controller = new PatchCanvasTimingController(0);
    const snapshot = controller.snapshot();
    expect(m02RackControlsMarkup(snapshot)).toContain('Live M02 timing source');
    expect(m05RackControlsMarkup(snapshot)).toContain('Live M05 ADSR');
    const workbench = timingWorkbenchMarkup(snapshot);
    expect(workbench).toContain('Connect M02 Gate → M05 Gate');
    expect(workbench).toContain('Connect M02 Trigger → M05 Trigger');
  });
});
