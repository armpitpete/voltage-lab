import {
  effectiveControlVoltage,
  formatDecibels,
  hardClip,
  lfoValue,
  mixerStatus,
  oscillatorSample,
  vcaGain,
  type LfoShape,
  type MixerChannelSample,
  type MixerWaveform,
  type SignalPolarity,
  type VcaResponse,
} from '../../../packages/vca-mixer-model/src/index';
import {
  advanceEnvelope,
  gateEnvelopeOff,
  gateEnvelopeOn,
  idleEnvelope,
  normaliseEnvelopeSettings,
  stageLabel,
  type EnvelopeSettings,
  type EnvelopeState,
} from '../../../packages/envelope-model/src/index';

const HISTORY_LENGTH = 260;
const HISTORY_INTERVAL_MS = 40;

const lessons = [
  ['A VCA is a voltage-controlled level', 'Move Bias CV. At 0 V the first channel closes; at 5 V it reaches full gain.'],
  ['Linear and exponential feel different', 'Set Bias CV near the middle and compare response curves. Exponential control leaves more room for quiet changes.'],
  ['An attenuverter can reverse movement', 'Enable the LFO and move the attenuverter through zero. Positive movement opens the VCA; negative movement closes it.'],
  ['An envelope creates one loudness gesture', 'Press and hold the envelope gate. Attack raises the control voltage, sustain holds it and release lowers it.'],
  ['A mixer adds signals', 'Raise the three channel levels. The clean waveform is the mathematical sum of all active channels.'],
  ['Polarity can cancel a matching signal', 'Choose the Cancellation preset. Two matched sources with opposite polarity subtract to near silence.'],
  ['Headroom is space before clipping', 'Use Safe mix, then raise Master drive. The headroom readout falls toward 0 dB as the sum approaches the limit.'],
  ['Clipping changes the waveform', 'Choose Overdrive. The red trace stops at ±1 while the gold clean sum continues beyond the limit.'],
] as const;

type HistoryPoint = {
  effectiveCv: number;
  gain: number;
  peak: number;
  clipping: boolean;
};

type ChannelElements = {
  waveform: HTMLSelectElement;
  frequency: HTMLInputElement;
  level: HTMLInputElement;
  pan: HTMLInputElement;
  polarity: HTMLSelectElement;
  muted: HTMLInputElement;
};

type CurrentValues = {
  envelopeVoltage: number;
  envelopeStage: string;
  lfoVoltage: number;
  modulationVoltage: number;
  effectiveCv: number;
  gain: number;
};

function channelMarkup(index: number, title: string, waveform: MixerWaveform, frequency: number, level: number, pan: number) {
  return `<article class="mixer-channel" data-channel="${index}"><header><div><small>Channel ${index}</small><h4>${title}</h4></div><label class="toggle-line"><input id="ch${index}Mute" type="checkbox"> Mute</label></header><label>Waveform<select id="ch${index}Wave"><option value="sine" ${waveform === 'sine' ? 'selected' : ''}>Sine</option><option value="sawtooth" ${waveform === 'sawtooth' ? 'selected' : ''}>Saw</option><option value="square" ${waveform === 'square' ? 'selected' : ''}>Square</option><option value="triangle" ${waveform === 'triangle' ? 'selected' : ''}>Triangle</option></select></label><label>Frequency<input id="ch${index}Frequency" type="range" min="55" max="880" step="1" value="${frequency}"><output id="ch${index}FrequencyOut">${frequency} Hz</output></label><label>Level<input id="ch${index}Level" type="range" min="0" max="1.5" step=".01" value="${level}"><output id="ch${index}LevelOut">${Math.round(level * 100)}%</output></label><label>Pan<input id="ch${index}Pan" type="range" min="-1" max="1" step=".01" value="${pan}"><output id="ch${index}PanOut">Centre</output></label><label>Polarity<select id="ch${index}Polarity"><option value="normal">Normal</option><option value="inverted">Inverted</option></select></label><div class="channel-meter"><span id="ch${index}Meter"></span></div></article>`;
}

export function mountVcaMixer(root: HTMLElement) {
  root.innerHTML = `<section class="module-header"><div><p class="eyebrow">Module 08 · amplitude and summing</p><h2>VCA & Mixer Lab</h2><p>Turn control voltage into loudness, combine three sources, preserve headroom and hear what clipping changes.</p></div><div><button id="learnTab" class="active">Learn</button> <button id="exploreTab">Explore</button></div></section><section id="lesson" class="lesson panel"><div><span id="lessonCount"></span><h3 id="lessonTitle"></h3><p id="lessonText"></p></div><div><button id="prev">Previous</button> <button id="next">Next experiment</button></div></section><section class="lab-grid vca-mixer-lab-grid"><aside class="controls panel"><h3>VCA response</h3><label>Response<select id="response"><option value="linear">Linear</option><option value="exponential" selected>Exponential</option></select></label><label>Bias CV<input id="biasCv" type="range" min="0" max="5" step=".01" value="2.5"><output id="biasCvOut">2.50 V</output></label><label>CV attenuverter<input id="attenuverter" type="range" min="-1" max="1" step=".01" value="1"><output id="attenuverterOut">+100%</output></label><h3>LFO modulation</h3><label class="toggle-line"><input id="lfoEnabled" type="checkbox"> Enable LFO</label><label>Shape<select id="lfoShape"><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option></select></label><label>Rate<input id="lfoRate" type="range" min=".05" max="12" step=".05" value=".5"><output id="lfoRateOut">0.50 Hz</output></label><label>Depth<input id="lfoDepth" type="range" min="0" max="5" step=".01" value="2"><output id="lfoDepthOut">2.00 V</output></label><h3>Envelope modulation</h3><button id="gate" class="gate-button">Press and hold envelope gate</button><label>Envelope depth<input id="envelopeDepth" type="range" min="0" max="5" step=".01" value="2.5"><output id="envelopeDepthOut">2.50 V</output></label><label>Attack<input id="attack" type="range" min="0" max="2000" step="10" value="180"><output id="attackOut">180 ms</output></label><label>Decay<input id="decay" type="range" min="0" max="2000" step="10" value="260"><output id="decayOut">260 ms</output></label><label>Sustain<input id="sustain" type="range" min="0" max="1" step=".01" value=".35"><output id="sustainOut">35%</output></label><label>Release<input id="release" type="range" min="0" max="3000" step="10" value="500"><output id="releaseOut">500 ms</output></label><h3>Mixer output</h3><label>Master drive<input id="masterDrive" type="range" min="0" max="4" step=".01" value="1"><output id="masterDriveOut">1.00×</output></label><label>Master level<input id="masterLevel" type="range" min="0" max="1.5" step=".01" value=".8"><output id="masterLevelOut">80%</output></label><div class="preset-grid"><button id="safePreset">Safe mix</button><button id="drivePreset">Overdrive</button><button id="cancelPreset">Cancellation</button></div><h3>Audio comparison</h3><fieldset><legend>Listen to</legend><label><input type="radio" name="mixerAudioMode" value="vca"> VCA channel only</label><label><input type="radio" name="mixerAudioMode" value="clean" checked> Clean mixer</label><label><input type="radio" name="mixerAudioMode" value="clipped"> Clipped mixer</label><label><input type="radio" name="mixerAudioMode" value="both"> Both · clean left, clipped right</label></fieldset><label>Safety volume<input id="volume" type="range" min="0" max=".12" step=".005" value=".04"><output id="volumeOut">33%</output></label><div class="button-row"><button id="audioStart" class="primary">Start audio</button><button id="audioMute">Mute</button><button id="audioStop">Panic / stop</button></div></aside><main class="workbench"><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Stationary VCA response</p><h3>Control voltage becomes gain</h3></div><div class="readouts"><span>Modulation<b id="modulationReadout">0.00 V</b></span><span>Effective CV<b id="effectiveCvReadout">2.50 V</b></span><span>VCA gain<b id="gainReadout">12%</b></span><span>Envelope<b id="envelopeReadout">Idle · 0.00 V</b></span></div></div><canvas id="responseCanvas" width="1100" height="400"></canvas><p class="scope-legend"><span class="raw-key">Blue: linear reference</span><span class="quantized-key">Gold: selected response</span><span>Dot: current effective CV</span></p></section><section class="panel mixer-panel"><div class="scope-heading"><div><p class="eyebrow">Three-channel voltage mixer</p><h3>Level, pan, polarity and mute</h3></div><div class="readouts"><span>Clean peak<b id="peakReadout">0.00</b></span><span>Headroom<b id="headroomReadout">∞ dB</b></span><span id="clipReadout" class="clip-readout">Clipping<b>No</b></span><span>Audio<b id="audioReadout">Stopped</b></span></div></div><div class="mixer-channels">${channelMarkup(1, 'VCA-controlled source', 'sawtooth', 110, .55, -.35)}${channelMarkup(2, 'Second oscillator', 'square', 165, .35, .35)}${channelMarkup(3, 'Third oscillator', 'triangle', 220, .25, 0)}</div></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Stationary mixed waveform</p><h3>Clean sum compared with hard clipping</h3></div><div class="readouts"><span>Clip limit<b>±1.00</b></span><span>Master drive<b id="driveReadout">1.00×</b></span></div></div><canvas id="mixCanvas" width="1100" height="430"></canvas><p class="scope-legend"><span class="raw-key">Blue: VCA channel</span><span class="quantized-key">Gold: clean sum</span><span class="clip-key">Red: clipped sum</span></p></section><section class="panel mixer-path-panel"><p class="eyebrow">Live signal path</p><h3>Voltage changes one channel before all channels are summed</h3><div class="mixer-path"><div><small>Bias + modulation</small><b id="pathCv">2.50 V</b></div><span>→</span><div><small>VCA gain</small><b id="pathGain">12%</b></div><span>→</span><div><small>Channel 1</small><b id="pathChannel">Saw · 110 Hz</b></div><span>+</span><div><small>Channels 2 and 3</small><b id="pathOthers">2 active</b></div><span>→</span><div><small>Mixer sum</small><b id="pathPeak">Peak 0.00</b></div><span>→</span><div id="pathClipNode"><small>Output</small><b id="pathOutput">Clean</b></div></div></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Live amplitude history</p><h3>Control voltage, gain and mixer peak</h3></div><div class="readouts"><span>LFO output<b id="lfoReadout">0.00 V</b></span><span>VCA output<b id="vcaOutputReadout">0%</b></span></div></div><canvas id="historyCanvas" width="1100" height="390"></canvas><p class="scope-legend"><span class="raw-key">Upper blue: effective CV</span><span class="envelope-key">Middle green: VCA gain</span><span class="quantized-key">Lower gold: mixer peak</span></p></section><section class="explanation panel"><p class="eyebrow">What is happening?</p><h3 id="explainTitle">The VCA is partly open</h3><p id="explainText">The first oscillator is reduced by the current VCA gain before it enters the mixer.</p></section></main></section>`;

  const $ = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  };

  const response = $<HTMLSelectElement>('#response');
  const biasCv = $<HTMLInputElement>('#biasCv');
  const attenuverter = $<HTMLInputElement>('#attenuverter');
  const lfoEnabled = $<HTMLInputElement>('#lfoEnabled');
  const lfoShape = $<HTMLSelectElement>('#lfoShape');
  const lfoRate = $<HTMLInputElement>('#lfoRate');
  const lfoDepth = $<HTMLInputElement>('#lfoDepth');
  const envelopeDepth = $<HTMLInputElement>('#envelopeDepth');
  const attack = $<HTMLInputElement>('#attack');
  const decay = $<HTMLInputElement>('#decay');
  const sustain = $<HTMLInputElement>('#sustain');
  const release = $<HTMLInputElement>('#release');
  const masterDrive = $<HTMLInputElement>('#masterDrive');
  const masterLevel = $<HTMLInputElement>('#masterLevel');
  const volume = $<HTMLInputElement>('#volume');
  const gate = $<HTMLButtonElement>('#gate');
  const responseCanvas = $<HTMLCanvasElement>('#responseCanvas');
  const mixCanvas = $<HTMLCanvasElement>('#mixCanvas');
  const historyCanvas = $<HTMLCanvasElement>('#historyCanvas');
  const responseContext = responseCanvas.getContext('2d');
  const mixContext = mixCanvas.getContext('2d');
  const historyContext = historyCanvas.getContext('2d');
  if (!responseContext || !mixContext || !historyContext) throw new Error('Canvas unavailable');

  const channels: ChannelElements[] = [1, 2, 3].map((index) => ({
    waveform: $<HTMLSelectElement>(`#ch${index}Wave`),
    frequency: $<HTMLInputElement>(`#ch${index}Frequency`),
    level: $<HTMLInputElement>(`#ch${index}Level`),
    pan: $<HTMLInputElement>(`#ch${index}Pan`),
    polarity: $<HTMLSelectElement>(`#ch${index}Polarity`),
    muted: $<HTMLInputElement>(`#ch${index}Mute`),
  }));

  let lessonIndex = 0;
  let animationFrame = 0;
  let lastHistoryAt = 0;
  let history: HistoryPoint[] = [];
  let envelopeState: EnvelopeState = idleEnvelope(performance.now());
  let gateHeld = false;
  let muted = false;

  let audio: AudioContext | null = null;
  let oscillatorNodes: OscillatorNode[] = [];
  let channelGainNodes: GainNode[] = [];
  let channelPanners: StereoPannerNode[] = [];
  let cleanDriveNode: GainNode | null = null;
  let clipDriveNode: GainNode | null = null;
  let cleanOutputNode: GainNode | null = null;
  let clippedOutputNode: GainNode | null = null;
  let cleanPannerNode: StereoPannerNode | null = null;
  let clippedPannerNode: StereoPannerNode | null = null;
  let masterGainNode: GainNode | null = null;

  function envelopeSettings(): EnvelopeSettings {
    return normaliseEnvelopeSettings({
      attackMs: Number(attack.value),
      decayMs: Number(decay.value),
      sustainLevel: Number(sustain.value),
      releaseMs: Number(release.value),
      peakVoltage: 5,
    });
  }

  function selectedAudioMode() {
    return root.querySelector<HTMLInputElement>('input[name=mixerAudioMode]:checked')?.value ?? 'clean';
  }

  function currentValues(now: number): CurrentValues {
    const envelope = advanceEnvelope(envelopeState, envelopeSettings(), now);
    envelopeState = {
      stage: envelope.stage,
      gate: envelope.gate,
      stageStartedAtMs: envelope.stageStartedAtMs,
      stageStartVoltage: envelope.stageStartVoltage,
    };
    const lfoVoltage = lfoEnabled.checked
      ? lfoValue(lfoShape.value as LfoShape, now / 1000 * Number(lfoRate.value)) * Number(lfoDepth.value)
      : 0;
    const envelopeVoltage = envelope.voltage / 5 * Number(envelopeDepth.value);
    const modulationVoltage = lfoVoltage + envelopeVoltage;
    const effectiveCv = effectiveControlVoltage({
      biasVoltage: Number(biasCv.value),
      modulationVoltage,
      attenuverter: Number(attenuverter.value),
    });
    return {
      envelopeVoltage: envelope.voltage,
      envelopeStage: stageLabel(envelope.stage),
      lfoVoltage,
      modulationVoltage,
      effectiveCv,
      gain: vcaGain(effectiveCv, response.value as VcaResponse),
    };
  }

  function channelSamplesAt(timeSeconds: number, gain: number): MixerChannelSample[] {
    return channels.map((channel, index) => ({
      sample: oscillatorSample(channel.waveform.value as MixerWaveform, timeSeconds * Number(channel.frequency.value)),
      level: Number(channel.level.value),
      pan: Number(channel.pan.value),
      polarity: channel.polarity.value as SignalPolarity,
      muted: channel.muted.checked,
      gain: index === 0 ? gain : 1,
    }));
  }

  function scanPeak(gain: number) {
    let peak = 0;
    for (let index = 0; index < 720; index += 1) {
      const time = index / 719 * 0.04;
      const status = mixerStatus(channelSamplesAt(time, gain), Number(masterDrive.value));
      peak = Math.max(peak, status.peak);
    }
    return peak;
  }

  function drawGrid(context: CanvasRenderingContext2D, width: number, height: number, columns: number, rows: number) {
    context.strokeStyle = '#263642';
    context.lineWidth = 1;
    for (let column = 0; column <= columns; column += 1) {
      const x = column / columns * width;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let row = 0; row <= rows; row += 1) {
      const y = row / rows * height;
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
  }

  function drawResponse(values: CurrentValues) {
    const context = responseContext;
    const width = responseCanvas.width;
    const height = responseCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, 5, 5);
    const drawCurve = (curve: VcaResponse, stroke: string, lineWidth: number) => {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.beginPath();
      for (let index = 0; index <= 500; index += 1) {
        const cv = index / 500 * 5;
        const x = index / 500 * width;
        const y = height - vcaGain(cv, curve) * height;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    };
    drawCurve('linear', '#79c8ff', response.value === 'linear' ? 4 : 2);
    if (response.value === 'exponential') drawCurve('exponential', '#f4c96b', 4);
    const x = values.effectiveCv / 5 * width;
    const y = height - values.gain * height;
    context.fillStyle = '#f4c96b';
    context.beginPath(); context.arc(x, y, 9, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#dce7ed'; context.font = '18px system-ui';
    context.fillText('0 V', 10, height - 12);
    context.fillText('5 V', width - 45, height - 12);
    context.fillText('unity', 10, 22);
  }

  function drawMix(values: CurrentValues) {
    const context = mixContext;
    const width = mixCanvas.width;
    const height = mixCanvas.height;
    const centre = height / 2;
    const scale = height * 0.18;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, 8, 6);
    context.strokeStyle = '#657785'; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(0, centre); context.lineTo(width, centre); context.stroke();
    for (const limit of [-1, 1]) {
      context.strokeStyle = '#9a4e4e'; context.setLineDash([9, 8]);
      context.beginPath(); context.moveTo(0, centre - limit * scale); context.lineTo(width, centre - limit * scale); context.stroke();
    }
    context.setLineDash([]);

    const drawTrace = (valueAt: (time: number) => number, stroke: string, lineWidth: number) => {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.beginPath();
      for (let index = 0; index < 720; index += 1) {
        const time = index / 719 * 0.04;
        const x = index / 719 * width;
        const y = centre - valueAt(time) * scale;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    };

    drawTrace((time) => {
      const channel = channelSamplesAt(time, values.gain)[0];
      const polarity = channel.polarity === 'inverted' ? -1 : 1;
      return channel.muted ? 0 : channel.sample * channel.level * (channel.gain ?? 1) * polarity;
    }, '#79c8ff', 2);
    drawTrace((time) => {
      const status = mixerStatus(channelSamplesAt(time, values.gain), Number(masterDrive.value));
      return (status.clean.left + status.clean.right) / 2;
    }, '#f4c96b', 3.5);
    drawTrace((time) => {
      const status = mixerStatus(channelSamplesAt(time, values.gain), Number(masterDrive.value));
      return (status.clipped.left + status.clipped.right) / 2;
    }, '#ff7777', 2.5);
  }

  function drawHistory() {
    const context = historyContext;
    const width = historyCanvas.width;
    const height = historyCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, 8, 6);
    const lanes = [height * .17, height * .5, height * .83];
    const draw = (valueAt: (point: HistoryPoint) => number, lane: number, amplitude: number, stroke: string) => {
      context.strokeStyle = stroke; context.lineWidth = 3; context.beginPath();
      history.forEach((point, index) => {
        const x = history.length <= 1 ? width : index / (HISTORY_LENGTH - 1) * width;
        const y = lane - valueAt(point) * amplitude;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    };
    draw((point) => point.effectiveCv / 5, lanes[0] + height * .08, height * .16, '#79c8ff');
    draw((point) => point.gain, lanes[1] + height * .08, height * .16, '#72e0aa');
    draw((point) => Math.min(2, point.peak) / 2, lanes[2] + height * .08, height * .16, '#f4c96b');
    context.fillStyle = '#d8e3e9'; context.font = '17px system-ui';
    context.fillText('CV 0–5 V', 12, 24);
    context.fillText('GAIN 0–1', 12, height * .36);
    context.fillText('PEAK 0–2', 12, height * .69);
  }

  function formatPan(value: number) {
    if (Math.abs(value) < .02) return 'Centre';
    return value < 0 ? `${Math.round(Math.abs(value) * 100)}% left` : `${Math.round(value * 100)}% right`;
  }

  function updateOutputs(values: CurrentValues, peak: number) {
    $('#biasCvOut').textContent = `${Number(biasCv.value).toFixed(2)} V`;
    const amount = Number(attenuverter.value);
    $('#attenuverterOut').textContent = `${amount >= 0 ? '+' : ''}${Math.round(amount * 100)}%`;
    $('#lfoRateOut').textContent = `${Number(lfoRate.value).toFixed(2)} Hz`;
    $('#lfoDepthOut').textContent = `${Number(lfoDepth.value).toFixed(2)} V`;
    $('#envelopeDepthOut').textContent = `${Number(envelopeDepth.value).toFixed(2)} V`;
    $('#attackOut').textContent = `${attack.value} ms`;
    $('#decayOut').textContent = `${decay.value} ms`;
    $('#sustainOut').textContent = `${Math.round(Number(sustain.value) * 100)}%`;
    $('#releaseOut').textContent = `${release.value} ms`;
    $('#masterDriveOut').textContent = `${Number(masterDrive.value).toFixed(2)}×`;
    $('#masterLevelOut').textContent = `${Math.round(Number(masterLevel.value) * 100)}%`;
    $('#volumeOut').textContent = `${Math.round(Number(volume.value) / .12 * 100)}%`;

    channels.forEach((channel, index) => {
      $(`#ch${index + 1}FrequencyOut`).textContent = `${channel.frequency.value} Hz`;
      $(`#ch${index + 1}LevelOut`).textContent = `${Math.round(Number(channel.level.value) * 100)}%`;
      $(`#ch${index + 1}PanOut`).textContent = formatPan(Number(channel.pan.value));
      const meterGain = index === 0 ? values.gain : 1;
      const meter = channel.muted.checked ? 0 : Math.min(1, Number(channel.level.value) * meterGain);
      ($(`#ch${index + 1}Meter`) as HTMLElement).style.width = `${meter * 100}%`;
      root.querySelector(`[data-channel="${index + 1}"]`)?.classList.toggle('muted', channel.muted.checked);
    });

    const headroom = peak <= 0 ? Number.POSITIVE_INFINITY : 20 * Math.log10(1 / peak);
    const clipping = peak > 1;
    $('#modulationReadout').textContent = `${values.modulationVoltage >= 0 ? '+' : ''}${values.modulationVoltage.toFixed(2)} V`;
    $('#effectiveCvReadout').textContent = `${values.effectiveCv.toFixed(2)} V`;
    $('#gainReadout').textContent = `${Math.round(values.gain * 100)}%`;
    $('#envelopeReadout').textContent = `${values.envelopeStage} · ${values.envelopeVoltage.toFixed(2)} V`;
    $('#peakReadout').textContent = peak.toFixed(2);
    $('#headroomReadout').textContent = formatDecibels(headroom);
    $('#clipReadout b').textContent = clipping ? 'Yes' : 'No';
    $('#clipReadout').classList.toggle('clipping', clipping);
    $('#driveReadout').textContent = `${Number(masterDrive.value).toFixed(2)}×`;
    $('#lfoReadout').textContent = `${values.lfoVoltage >= 0 ? '+' : ''}${values.lfoVoltage.toFixed(2)} V`;
    $('#vcaOutputReadout').textContent = `${Math.round(values.gain * Number(channels[0].level.value) * 100)}%`;
    $('#pathCv').textContent = `${values.effectiveCv.toFixed(2)} V`;
    $('#pathGain').textContent = `${Math.round(values.gain * 100)}%`;
    $('#pathChannel').textContent = `${channels[0].waveform.options[channels[0].waveform.selectedIndex].text} · ${channels[0].frequency.value} Hz`;
    $('#pathOthers').textContent = `${channels.slice(1).filter((channel) => !channel.muted.checked).length} active`;
    $('#pathPeak').textContent = `Peak ${peak.toFixed(2)}`;
    $('#pathOutput').textContent = clipping ? 'Hard clipping' : 'Clean headroom';
    $('#pathClipNode').classList.toggle('active', clipping);
    $('#audioReadout').textContent = audio ? (muted ? 'Muted' : 'Running') : 'Stopped';

    if (clipping) {
      $('#explainTitle').textContent = 'The mixer is clipping';
      $('#explainText').textContent = `The clean peak reaches ${peak.toFixed(2)}, above the ±1.00 limit. The clipped output flattens every excess peak.`;
    } else if (peak < .04 && !channels[0].muted.checked && !channels[1].muted.checked) {
      $('#explainTitle').textContent = 'The signals are cancelling';
      $('#explainText').textContent = 'Matched waveforms at equal level can subtract when one channel has inverted polarity.';
    } else if (values.effectiveCv <= .01) {
      $('#explainTitle').textContent = 'The VCA is closed';
      $('#explainText').textContent = 'Channel 1 still has an oscillator, but 0 V produces zero gain before it reaches the mixer.';
    } else {
      $('#explainTitle').textContent = `${response.value === 'linear' ? 'Linear' : 'Exponential'} VCA at ${Math.round(values.gain * 100)}% gain`;
      $('#explainText').textContent = `The first channel is scaled before mixing. The current clean peak leaves ${formatDecibels(headroom)} of headroom.`;
    }
  }

  function makeClipCurve() {
    const curve = new Float32Array(new ArrayBuffer(2048 * Float32Array.BYTES_PER_ELEMENT));
    for (let index = 0; index < curve.length; index += 1) {
      const x = index / (curve.length - 1) * 2 - 1;
      curve[index] = hardClip(x);
    }
    return curve;
  }

  function applyAudio(values: CurrentValues) {
    if (!audio || !masterGainNode || !cleanDriveNode || !clipDriveNode || !cleanOutputNode || !clippedOutputNode || !cleanPannerNode || !clippedPannerNode) return;
    const now = audio.currentTime;
    const mode = selectedAudioMode();
    oscillatorNodes.forEach((oscillator, index) => {
      oscillator.type = channels[index].waveform.value as OscillatorType;
      oscillator.frequency.setTargetAtTime(Number(channels[index].frequency.value), now, .015);
      const polarity = channels[index].polarity.value === 'inverted' ? -1 : 1;
      const active = !channels[index].muted.checked && !(mode === 'vca' && index > 0);
      const channelGain = active
        ? Number(channels[index].level.value) * (index === 0 ? values.gain : 1) * polarity
        : 0;
      channelGainNodes[index].gain.setTargetAtTime(channelGain, now, .012);
      channelPanners[index].pan.setTargetAtTime(Number(channels[index].pan.value), now, .012);
    });
    const drive = Number(masterDrive.value);
    cleanDriveNode.gain.setTargetAtTime(drive, now, .012);
    clipDriveNode.gain.setTargetAtTime(drive, now, .012);
    const both = mode === 'both';
    cleanOutputNode.gain.setTargetAtTime(mode === 'clipped' ? 0 : both ? .72 : 1, now, .012);
    clippedOutputNode.gain.setTargetAtTime(mode === 'clipped' ? 1 : both ? .72 : 0, now, .012);
    cleanPannerNode.pan.setTargetAtTime(both ? -1 : 0, now, .012);
    clippedPannerNode.pan.setTargetAtTime(both ? 1 : 0, now, .012);
    masterGainNode.gain.setTargetAtTime(muted ? 0 : Number(volume.value) * Number(masterLevel.value), now, .012);
  }

  async function startAudio() {
    if (audio) {
      await audio.resume();
      muted = false;
      return;
    }
    audio = new AudioContext();
    const cleanBus = audio.createGain();
    cleanDriveNode = audio.createGain();
    clipDriveNode = audio.createGain();
    const shaper = audio.createWaveShaper();
    shaper.curve = makeClipCurve();
    shaper.oversample = '4x';
    cleanOutputNode = audio.createGain();
    clippedOutputNode = audio.createGain();
    cleanPannerNode = audio.createStereoPanner();
    clippedPannerNode = audio.createStereoPanner();
    masterGainNode = audio.createGain();

    cleanBus.connect(cleanDriveNode).connect(cleanOutputNode).connect(cleanPannerNode).connect(masterGainNode);
    cleanBus.connect(clipDriveNode).connect(shaper).connect(clippedOutputNode).connect(clippedPannerNode).connect(masterGainNode);
    masterGainNode.connect(audio.destination);

    const startAt = audio.currentTime + .03;
    channels.forEach(() => {
      const oscillator = audio!.createOscillator();
      const gainNode = audio!.createGain();
      const panner = audio!.createStereoPanner();
      oscillator.connect(gainNode).connect(panner).connect(cleanBus);
      oscillator.start(startAt);
      oscillatorNodes.push(oscillator);
      channelGainNodes.push(gainNode);
      channelPanners.push(panner);
    });
    muted = false;
    await audio.resume();
  }

  function stopAudio() {
    oscillatorNodes.forEach((oscillator) => {
      try { oscillator.stop(); } catch { /* already stopped */ }
    });
    oscillatorNodes = [];
    channelGainNodes = [];
    channelPanners = [];
    void audio?.close();
    audio = null;
    cleanDriveNode = null;
    clipDriveNode = null;
    cleanOutputNode = null;
    clippedOutputNode = null;
    cleanPannerNode = null;
    clippedPannerNode = null;
    masterGainNode = null;
    muted = false;
  }

  function setGate(active: boolean) {
    if (active === gateHeld) return;
    gateHeld = active;
    const now = performance.now();
    envelopeState = active
      ? gateEnvelopeOn(envelopeState, envelopeSettings(), now)
      : gateEnvelopeOff(envelopeState, envelopeSettings(), now);
    gate.classList.toggle('on', active);
    gate.textContent = active ? 'Envelope gate high' : 'Press and hold envelope gate';
  }

  function setChannel(index: number, settings: Partial<{ waveform: MixerWaveform; frequency: number; level: number; pan: number; polarity: SignalPolarity; muted: boolean }>) {
    const channel = channels[index];
    if (settings.waveform !== undefined) channel.waveform.value = settings.waveform;
    if (settings.frequency !== undefined) channel.frequency.value = String(settings.frequency);
    if (settings.level !== undefined) channel.level.value = String(settings.level);
    if (settings.pan !== undefined) channel.pan.value = String(settings.pan);
    if (settings.polarity !== undefined) channel.polarity.value = settings.polarity;
    if (settings.muted !== undefined) channel.muted.checked = settings.muted;
  }

  function safePreset() {
    response.value = 'exponential'; biasCv.value = '2.5'; attenuverter.value = '1'; lfoEnabled.checked = false;
    masterDrive.value = '1'; masterLevel.value = '.8';
    setChannel(0, { waveform: 'sawtooth', frequency: 110, level: .55, pan: -.35, polarity: 'normal', muted: false });
    setChannel(1, { waveform: 'square', frequency: 165, level: .35, pan: .35, polarity: 'normal', muted: false });
    setChannel(2, { waveform: 'triangle', frequency: 220, level: .25, pan: 0, polarity: 'normal', muted: false });
  }

  function drivePreset() {
    response.value = 'linear'; biasCv.value = '5'; attenuverter.value = '0'; lfoEnabled.checked = false;
    masterDrive.value = '2.4'; masterLevel.value = '.55';
    setChannel(0, { waveform: 'sawtooth', frequency: 110, level: 1.15, pan: 0, polarity: 'normal', muted: false });
    setChannel(1, { waveform: 'square', frequency: 165, level: 1.05, pan: 0, polarity: 'normal', muted: false });
    setChannel(2, { waveform: 'triangle', frequency: 220, level: .95, pan: 0, polarity: 'normal', muted: false });
  }

  function cancellationPreset() {
    response.value = 'linear'; biasCv.value = '5'; attenuverter.value = '0'; lfoEnabled.checked = false;
    masterDrive.value = '1'; masterLevel.value = '.8';
    setChannel(0, { waveform: 'sine', frequency: 220, level: .8, pan: 0, polarity: 'normal', muted: false });
    setChannel(1, { waveform: 'sine', frequency: 220, level: .8, pan: 0, polarity: 'inverted', muted: false });
    setChannel(2, { waveform: 'triangle', frequency: 330, level: .3, pan: 0, polarity: 'normal', muted: true });
  }

  function renderLesson() {
    const [title, text] = lessons[lessonIndex];
    $('#lessonCount').textContent = `${lessonIndex + 1} of ${lessons.length}`;
    $('#lessonTitle').textContent = title;
    $('#lessonText').textContent = text;
  }

  function animate(now: number) {
    const values = currentValues(now);
    const peak = scanPeak(values.gain);
    if (now - lastHistoryAt >= HISTORY_INTERVAL_MS) {
      history.push({ effectiveCv: values.effectiveCv, gain: values.gain, peak, clipping: peak > 1 });
      if (history.length > HISTORY_LENGTH) history.shift();
      lastHistoryAt = now;
    }
    drawResponse(values);
    drawMix(values);
    drawHistory();
    updateOutputs(values, peak);
    applyAudio(values);
    animationFrame = requestAnimationFrame(animate);
  }

  gate.addEventListener('pointerdown', (event) => { event.preventDefault(); gate.setPointerCapture(event.pointerId); setGate(true); });
  gate.addEventListener('pointerup', () => setGate(false));
  gate.addEventListener('pointercancel', () => setGate(false));
  const keyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (event.code === 'Space' && !event.repeat && !target?.matches('input, select, button')) {
      event.preventDefault(); setGate(true);
    }
  };
  const keyUp = (event: KeyboardEvent) => {
    if (event.code === 'Space') { event.preventDefault(); setGate(false); }
  };
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  $('#audioStart').addEventListener('click', () => { void startAudio(); });
  $('#audioMute').addEventListener('click', () => { muted = !muted; });
  $('#audioStop').addEventListener('click', stopAudio);
  $('#safePreset').addEventListener('click', safePreset);
  $('#drivePreset').addEventListener('click', drivePreset);
  $('#cancelPreset').addEventListener('click', cancellationPreset);
  $('#prev').addEventListener('click', () => { lessonIndex = (lessonIndex + lessons.length - 1) % lessons.length; renderLesson(); });
  $('#next').addEventListener('click', () => { lessonIndex = (lessonIndex + 1) % lessons.length; renderLesson(); });
  $('#learnTab').addEventListener('click', () => {
    $('#lesson').removeAttribute('hidden'); $('#learnTab').classList.add('active'); $('#exploreTab').classList.remove('active');
  });
  $('#exploreTab').addEventListener('click', () => {
    $('#lesson').setAttribute('hidden', ''); $('#learnTab').classList.remove('active'); $('#exploreTab').classList.add('active');
  });

  renderLesson();
  animationFrame = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    stopAudio();
  };
}
