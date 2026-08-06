import {
  cutoffCvToFrequency,
  normaliseFullSynthVoiceControls,
  pitchCvToFrequency,
  vcaCvToGain,
  type FullSynthVoiceControls,
} from './index';

function hold(param: AudioParam, at: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(at);
    return;
  }
  const current = param.value;
  param.cancelScheduledValues(at);
  param.setValueAtTime(current, at);
}

/** A bounded browser-audio monitor for an already-complete Full Synth Voice plan. */
export class BrowserFullSynthVoice {
  private readonly oscillator: OscillatorNode;
  private readonly filter: BiquadFilterNode;
  private readonly vca: GainNode;
  private readonly master: GainNode;
  private controls: FullSynthVoiceControls;
  private disposed = false;
  private gateOpen = false;

  private constructor(private readonly context: AudioContext, controls: FullSynthVoiceControls) {
    this.controls = controls;
    this.oscillator = context.createOscillator();
    this.filter = context.createBiquadFilter();
    this.vca = context.createGain();
    this.master = context.createGain();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 1.1;
    this.vca.gain.value = 0;
    this.master.gain.value = 1;
    this.oscillator.connect(this.filter).connect(this.vca).connect(this.master).connect(context.destination);
    this.applyControls();
    this.oscillator.start();
  }

  static async start(controls: Partial<FullSynthVoiceControls> = {}): Promise<BrowserFullSynthVoice> {
    const context = new AudioContext();
    await context.resume();
    return new BrowserFullSynthVoice(context, normaliseFullSynthVoiceControls(controls));
  }

  setControls(next: Partial<FullSynthVoiceControls>): FullSynthVoiceControls {
    this.controls = normaliseFullSynthVoiceControls({ ...this.controls, ...next });
    this.applyControls();
    return this.controls;
  }

  gate(open: boolean): void {
    if (this.disposed) return;
    this.gateOpen = open;
    const now = this.context.currentTime;
    hold(this.vca.gain, now);
    if (open) {
      this.vca.gain.linearRampToValueAtTime(vcaCvToGain(this.controls.vcaCv, this.controls.level), now + 0.025);
    } else {
      this.vca.gain.linearRampToValueAtTime(0, now + 0.18);
    }
  }

  async stop(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const now = this.context.currentTime;
    this.master.gain.setValueAtTime(0, now);
    try { this.oscillator.stop(now); } catch { /* already stopped */ }
    this.oscillator.disconnect();
    this.filter.disconnect();
    this.vca.disconnect();
    this.master.disconnect();
    await this.context.close();
  }

  private applyControls(): void {
    if (this.disposed) return;
    const now = this.context.currentTime;
    this.oscillator.type = this.controls.waveform;
    this.oscillator.frequency.setTargetAtTime(pitchCvToFrequency(this.controls.pitchCv), now, 0.012);
    this.filter.frequency.setTargetAtTime(cutoffCvToFrequency(this.controls.cutoffCv), now, 0.012);
    if (this.gateOpen) this.vca.gain.setTargetAtTime(vcaCvToGain(this.controls.vcaCv, this.controls.level), now, 0.012);
  }
}
