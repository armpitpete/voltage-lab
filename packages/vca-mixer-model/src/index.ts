export type VcaResponse = 'linear' | 'exponential';
export type SignalPolarity = 'normal' | 'inverted';
export type MixerWaveform = 'sine' | 'sawtooth' | 'square' | 'triangle';
export type LfoShape = 'sine' | 'triangle' | 'square';

export type ControlVoltageSources = {
  biasVoltage: number;
  modulationVoltage: number;
  attenuverter: number;
  minimumVoltage?: number;
  maximumVoltage?: number;
};

export type MixerChannelSample = {
  sample: number;
  level: number;
  pan: number;
  polarity: SignalPolarity;
  muted?: boolean;
  gain?: number;
};

export type StereoSample = {
  left: number;
  right: number;
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function effectiveControlVoltage(sources: ControlVoltageSources) {
  const minimum = sources.minimumVoltage ?? 0;
  const maximum = sources.maximumVoltage ?? 5;
  const amount = clamp(sources.attenuverter, -1, 1);
  return clamp(
    sources.biasVoltage + sources.modulationVoltage * amount,
    minimum,
    maximum,
  );
}

export function vcaGain(
  controlVoltage: number,
  response: VcaResponse,
  minimumVoltage = 0,
  maximumVoltage = 5,
) {
  const range = Math.max(0.000001, maximumVoltage - minimumVoltage);
  const normalised = clamp((controlVoltage - minimumVoltage) / range, 0, 1);
  if (response === 'linear') return normalised;
  const curve = 4;
  return (Math.exp(normalised * curve) - 1) / (Math.exp(curve) - 1);
}

export function oscillatorSample(waveform: MixerWaveform, phaseCycles: number) {
  const phase = ((phaseCycles % 1) + 1) % 1;
  if (waveform === 'sine') return Math.sin(phase * Math.PI * 2);
  if (waveform === 'sawtooth') return phase * 2 - 1;
  if (waveform === 'square') return phase < 0.5 ? 1 : -1;
  return 1 - 4 * Math.abs(phase - 0.5);
}

export function lfoValue(shape: LfoShape, phaseCycles: number) {
  const phase = ((phaseCycles % 1) + 1) % 1;
  if (shape === 'sine') return Math.sin(phase * Math.PI * 2);
  if (shape === 'triangle') return 1 - 4 * Math.abs(phase - 0.5);
  return phase < 0.5 ? 1 : -1;
}

export function channelContribution(channel: MixerChannelSample) {
  if (channel.muted) return 0;
  const level = clamp(channel.level, 0, 2);
  const gain = clamp(channel.gain ?? 1, 0, 1);
  const polarity = channel.polarity === 'inverted' ? -1 : 1;
  return channel.sample * level * gain * polarity;
}

export function equalPowerPan(pan: number) {
  const position = (clamp(pan, -1, 1) + 1) * Math.PI / 4;
  return {
    left: Math.cos(position),
    right: Math.sin(position),
  };
}

export function stereoChannelSample(channel: MixerChannelSample): StereoSample {
  const contribution = channelContribution(channel);
  const pan = equalPowerPan(channel.pan);
  return {
    left: contribution * pan.left,
    right: contribution * pan.right,
  };
}

export function mixStereo(
  channels: readonly MixerChannelSample[],
  masterDrive = 1,
): StereoSample {
  const drive = clamp(masterDrive, 0, 4);
  return channels.reduce<StereoSample>((sum, channel) => {
    const sample = stereoChannelSample(channel);
    return {
      left: sum.left + sample.left * drive,
      right: sum.right + sample.right * drive,
    };
  }, { left: 0, right: 0 });
}

export function hardClip(value: number, limit = 1) {
  const safeLimit = Math.max(0.000001, Math.abs(limit));
  return clamp(value, -safeLimit, safeLimit);
}

export function clipStereo(sample: StereoSample, limit = 1): StereoSample {
  return {
    left: hardClip(sample.left, limit),
    right: hardClip(sample.right, limit),
  };
}

export function stereoPeak(sample: StereoSample) {
  return Math.max(Math.abs(sample.left), Math.abs(sample.right));
}

export function headroomDb(peak: number, limit = 1) {
  const safeLimit = Math.max(0.000001, Math.abs(limit));
  if (peak <= 0) return Number.POSITIVE_INFINITY;
  return 20 * Math.log10(safeLimit / peak);
}

export function mixerStatus(
  channels: readonly MixerChannelSample[],
  masterDrive = 1,
  clipLimit = 1,
) {
  const clean = mixStereo(channels, masterDrive);
  const clipped = clipStereo(clean, clipLimit);
  const peak = stereoPeak(clean);
  return {
    clean,
    clipped,
    peak,
    headroomDb: headroomDb(peak, clipLimit),
    isClipping: peak > Math.abs(clipLimit),
  };
}

export function conservativePeakEstimate(
  channels: readonly MixerChannelSample[],
  masterDrive = 1,
) {
  const drive = clamp(masterDrive, 0, 4);
  return channels.reduce<StereoSample>((sum, channel) => {
    if (channel.muted) return sum;
    const contribution = Math.abs(channelContribution({ ...channel, sample: 1 }));
    const pan = equalPowerPan(channel.pan);
    return {
      left: sum.left + contribution * pan.left * drive,
      right: sum.right + contribution * pan.right * drive,
    };
  }, { left: 0, right: 0 });
}

export function formatDecibels(value: number) {
  if (!Number.isFinite(value)) return '∞ dB';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} dB`;
}
