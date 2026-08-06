import {
  cutoffFromSources,
  cutoffVoltageFromFrequency,
  filterMagnitude,
  filterResponseDb,
  filteredHarmonicAmplitude,
  formatFrequency,
  harmonicAmplitude,
  lfoValue,
  logarithmicFrequency,
  logarithmicPosition,
  type FilterType,
  type LfoShape,
  type SourceWaveform,
} from '../../../packages/filter-model/src/index';
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
  ['A filter changes frequency content', 'Start audio, choose Saw and move cutoff. The oscillator keeps producing harmonics while the filter decides which ones reach the output.'],
  ['Cutoff is the boundary', 'Use Low-pass. Harmonics below cutoff mostly remain while harmonics above it fall away.'],
  ['Four different responses', 'Compare low-pass, high-pass, band-pass and notch. Each type keeps or removes a different region.'],
  ['Resonance emphasises the edge', 'Raise resonance. The response graph grows around cutoff, making the boundary more audible.'],
  ['Cutoff can follow 1 V/oct', 'Move Cutoff CV from 0 V to +1 V. The cutoff frequency doubles exactly.'],
  ['An attenuverter can reverse movement', 'Set Modulation CV positive, then move Modulation amount through zero. Positive opens the filter; negative closes it.'],
  ['An LFO repeats the sweep', 'Enable the LFO and compare sine, triangle and square. The live history shows the different movement shapes.'],
  ['An envelope creates one filter gesture', 'Press and hold the envelope gate. Attack opens the filter, sustain holds it and release closes it smoothly.'],
] as const;

type HistoryPoint = {
  cutoffHz: number;
  lfoCv: number;
  envelopeVoltage: number;
};

export function mountFilter(root: HTMLElement) {
  root.innerHTML = `<section class="module-header"><div><p class="eyebrow">Module 07 · voltage-controlled filtering</p><h2>Filter Lab</h2><p>See and hear how cutoff, resonance and control voltage reshape an oscillator's harmonics.</p></div><div><button id="learnTab" class="active">Learn</button> <button id="exploreTab">Explore</button></div></section><section id="lesson" class="lesson panel"><div><span id="lessonCount"></span><h3 id="lessonTitle"></h3><p id="lessonText"></p></div><div><button id="prev">Previous</button> <button id="next">Next experiment</button></div></section><section class="lab-grid filter-lab-grid"><aside class="controls panel"><h3>Filter</h3><label>Type<select id="filterType"><option value="lowpass">Low-pass</option><option value="highpass">High-pass</option><option value="bandpass">Band-pass</option><option value="notch">Notch</option></select></label><label>Base cutoff<input id="cutoff" type="range" min="0" max="1" step=".001" value=".566"><output id="cutoffOut"></output></label><label>Resonance / Q<input id="resonance" type="range" min=".5" max="20" step=".05" value=".707"><output id="resonanceOut"></output></label><h3>Cutoff control voltage</h3><label>Cutoff CV<input id="cutoffCv" type="range" min="-5" max="5" step=".01" value="0"><output id="cutoffCvOut"></output></label><label>Modulation CV<input id="modCv" type="range" min="-5" max="5" step=".01" value="0"><output id="modCvOut"></output></label><label>Modulation amount<input id="modAmount" type="range" min="-1" max="1" step=".01" value="1"><output id="modAmountOut"></output></label><h3>LFO modulation</h3><label class="toggle-line"><input id="lfoEnabled" type="checkbox"> Enable LFO</label><label>Shape<select id="lfoShape"><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option></select></label><label>Rate<input id="lfoRate" type="range" min=".05" max="12" step=".05" value=".5"><output id="lfoRateOut"></output></label><label>Depth<input id="lfoDepth" type="range" min="0" max="5" step=".01" value="1"><output id="lfoDepthOut"></output></label><h3>Envelope modulation</h3><button id="gate" class="gate-button">Press and hold envelope gate</button><label>Envelope depth<input id="envelopeDepth" type="range" min="-5" max="5" step=".01" value="2"><output id="envelopeDepthOut"></output></label><label>Attack<input id="attack" type="range" min="0" max="2000" step="10" value="350"><output id="attackOut"></output></label><label>Decay<input id="decay" type="range" min="0" max="2000" step="10" value="400"><output id="decayOut"></output></label><label>Sustain<input id="sustain" type="range" min="0" max="1" step=".01" value=".45"><output id="sustainOut"></output></label><label>Release<input id="release" type="range" min="0" max="3000" step="10" value="700"><output id="releaseOut"></output></label><h3>Source oscillator</h3><label>Waveform<select id="waveform"><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sine">Sine</option></select></label><label>Frequency<input id="sourceFrequency" type="range" min="55" max="880" step="1" value="110"><output id="sourceFrequencyOut"></output></label><h3>Audio comparison</h3><fieldset><legend>Listen to</legend><label><input type="radio" name="filterAudioMode" value="dry"> Dry</label><label><input type="radio" name="filterAudioMode" value="filtered" checked> Filtered</label><label><input type="radio" name="filterAudioMode" value="both"> Both · dry left, filtered right</label></fieldset><label>Volume<input id="volume" type="range" min="0" max=".16" step=".005" value=".055"><output id="volumeOut"></output></label><div class="button-row"><button id="audioStart" class="primary">Start audio</button><button id="audioMute">Mute</button><button id="audioStop">Panic / stop</button></div></aside><main class="workbench"><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Stationary frequency response</p><h3>What the filter keeps and removes</h3></div><div class="readouts"><span>Effective cutoff<b id="effectiveCutoff">1.00 kHz</b></span><span>Change from base<b id="cutoffOctaves">+0.00 oct</b></span><span>Resonance<b id="qReadout">Q 0.71</b></span><span>Envelope<b id="envelopeReadout">Idle · 0.00 V</b></span></div></div><canvas id="responseCanvas" width="1100" height="430"></canvas><p class="scope-legend"><span class="quantized-key">Gold: filter response</span><span class="raw-key">Blue line: cutoff</span><span>0 dB means unchanged</span></p></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Harmonic spectrum</p><h3>Source oscillator before and after filtering</h3></div><div class="readouts"><span>Fundamental<b id="fundamentalReadout">110 Hz</b></span><span>Filter type<b id="typeReadout">Low-pass</b></span></div></div><canvas id="spectrumCanvas" width="1100" height="360"></canvas><p class="scope-legend"><span class="raw-key">Blue: source harmonic</span><span class="quantized-key">Gold: filtered harmonic</span></p></section><section class="panel filter-path-panel"><p class="eyebrow">Live control path</p><h3>Voltage becomes a moving frequency boundary</h3><div class="filter-path"><div><small>Base cutoff</small><b id="pathBase">1.00 kHz</b></div><span>+</span><div><small>Cutoff CV</small><b id="pathCutoffCv">0.00 V</b></div><span>+</span><div><small>Modulation</small><b id="pathModulation">0.00 V</b></div><span>→</span><div class="active"><small>Effective cutoff</small><b id="pathEffective">1.00 kHz</b></div><span>→</span><div><small>Audio filter</small><b id="pathAudio">Stopped</b></div></div></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Live cutoff history</p><h3>LFO and envelope movement over time</h3></div><div class="readouts"><span>LFO output<b id="lfoReadout">0.00 V</b></span><span>Envelope output<b id="envelopeVoltageReadout">0.00 V</b></span><span>Audio<b id="audioReadout">Stopped</b></span></div></div><canvas id="historyCanvas" width="1100" height="390"></canvas><p class="scope-legend"><span class="quantized-key">Upper gold: cutoff frequency</span><span class="raw-key">Lower blue: LFO CV</span><span class="envelope-key">Lower green: envelope</span></p></section><section class="explanation panel"><p class="eyebrow">What is happening?</p><h3 id="explainTitle">The filter is waiting</h3><p id="explainText">Start audio or move a control. The response and spectrum are already showing the current filter settings.</p></section></main></section>`;

  const $ = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  };

  const filterType = $<HTMLSelectElement>('#filterType');
  const cutoff = $<HTMLInputElement>('#cutoff');
  const resonance = $<HTMLInputElement>('#resonance');
  const cutoffCv = $<HTMLInputElement>('#cutoffCv');
  const modCv = $<HTMLInputElement>('#modCv');
  const modAmount = $<HTMLInputElement>('#modAmount');
  const lfoEnabled = $<HTMLInputElement>('#lfoEnabled');
  const lfoShape = $<HTMLSelectElement>('#lfoShape');
  const lfoRate = $<HTMLInputElement>('#lfoRate');
  const lfoDepth = $<HTMLInputElement>('#lfoDepth');
  const envelopeDepth = $<HTMLInputElement>('#envelopeDepth');
  const attack = $<HTMLInputElement>('#attack');
  const decay = $<HTMLInputElement>('#decay');
  const sustain = $<HTMLInputElement>('#sustain');
  const release = $<HTMLInputElement>('#release');
  const waveform = $<HTMLSelectElement>('#waveform');
  const sourceFrequency = $<HTMLInputElement>('#sourceFrequency');
  const volume = $<HTMLInputElement>('#volume');
  const gate = $<HTMLButtonElement>('#gate');
  const responseCanvas = $<HTMLCanvasElement>('#responseCanvas');
  const spectrumCanvas = $<HTMLCanvasElement>('#spectrumCanvas');
  const historyCanvas = $<HTMLCanvasElement>('#historyCanvas');
  const responseContext = responseCanvas.getContext('2d');
  const spectrumContext = spectrumCanvas.getContext('2d');
  const historyContext = historyCanvas.getContext('2d');
  if (!responseContext || !spectrumContext || !historyContext) throw new Error('Canvas unavailable');

  let lessonIndex = 0;
  let animationFrame = 0;
  let lastHistoryAt = 0;
  let history: HistoryPoint[] = [];
  let envelopeState: EnvelopeState = idleEnvelope(performance.now());
  let gateHeld = false;
  let muted = false;
  let lastEffectiveCutoff = -1;

  let audio: AudioContext | null = null;
  let oscillatorNode: OscillatorNode | null = null;
  let filterNode: BiquadFilterNode | null = null;
  let dryGain: GainNode | null = null;
  let filteredGain: GainNode | null = null;
  let dryPanner: StereoPannerNode | null = null;
  let filteredPanner: StereoPannerNode | null = null;
  let masterGain: GainNode | null = null;

  function baseCutoff() {
    return logarithmicFrequency(Number(cutoff.value));
  }

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
    return root.querySelector<HTMLInputElement>('input[name=filterAudioMode]:checked')?.value ?? 'filtered';
  }

  function currentValues(now: number) {
    const envelope = advanceEnvelope(envelopeState, envelopeSettings(), now);
    envelopeState = {
      stage: envelope.stage,
      gate: envelope.gate,
      stageStartedAtMs: envelope.stageStartedAtMs,
      stageStartVoltage: envelope.stageStartVoltage,
    };
    const lfo = lfoEnabled.checked
      ? lfoValue(lfoShape.value as LfoShape, now / 1000 * Number(lfoRate.value)) * Number(lfoDepth.value)
      : 0;
    const envelopeCv = envelope.voltage / 5 * Number(envelopeDepth.value);
    const effective = cutoffFromSources({
      baseCutoffHz: baseCutoff(),
      cutoffCv: Number(cutoffCv.value),
      modulationCv: Number(modCv.value),
      modulationAmount: Number(modAmount.value),
      lfoCv: lfo,
      envelopeCv,
    });
    return { envelope, lfo, envelopeCv, effective };
  }

  function filterLabel(type: FilterType) {
    return ({ lowpass: 'Low-pass', highpass: 'High-pass', bandpass: 'Band-pass', notch: 'Notch' })[type];
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

  function responseX(frequencyHz: number) {
    return logarithmicPosition(frequencyHz) * responseCanvas.width;
  }

  function responseY(db: number) {
    const topDb = 18;
    const bottomDb = -54;
    return (topDb - Math.max(bottomDb, Math.min(topDb, db))) / (topDb - bottomDb) * responseCanvas.height;
  }

  function drawResponse(effectiveCutoff: number) {
    const context = responseContext;
    const width = responseCanvas.width;
    const height = responseCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, 6, 6);

    const zeroY = responseY(0);
    context.strokeStyle = '#70808a'; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(0, zeroY); context.lineTo(width, zeroY); context.stroke();

    context.strokeStyle = '#f4c96b'; context.lineWidth = 4;
    context.beginPath();
    for (let point = 0; point <= 600; point += 1) {
      const position = point / 600;
      const frequency = logarithmicFrequency(position);
      const db = filterResponseDb(filterType.value as FilterType, frequency, effectiveCutoff, Number(resonance.value), -54);
      const x = position * width;
      const y = responseY(db);
      if (point === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();

    const cutoffX = responseX(effectiveCutoff);
    context.strokeStyle = '#79c8ff'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(cutoffX, 0); context.lineTo(cutoffX, height); context.stroke();
    context.fillStyle = '#79c8ff'; context.font = '700 16px system-ui'; context.textAlign = 'center';
    context.fillText(formatFrequency(effectiveCutoff), Math.max(70, Math.min(width - 70, cutoffX)), 24);

    context.fillStyle = '#9badb8'; context.font = '14px system-ui';
    for (const frequency of [20, 100, 1000, 10000, 20000]) {
      context.textAlign = frequency === 20 ? 'left' : frequency === 20000 ? 'right' : 'center';
      context.fillText(formatFrequency(frequency), responseX(frequency), height - 12);
    }
    for (const db of [12, 0, -12, -24, -36, -48]) {
      context.textAlign = 'left';
      context.fillText(`${db} dB`, 8, responseY(db) - 5);
    }
  }

  function drawSpectrum(effectiveCutoff: number) {
    const context = spectrumContext;
    const width = spectrumCanvas.width;
    const height = spectrumCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, 16, 5);
    const fundamental = Number(sourceFrequency.value);
    const column = width / 16;
    for (let harmonic = 1; harmonic <= 16; harmonic += 1) {
      const source = harmonicAmplitude(waveform.value as SourceWaveform, harmonic);
      const filtered = filteredHarmonicAmplitude(
        waveform.value as SourceWaveform,
        harmonic,
        fundamental,
        filterType.value as FilterType,
        effectiveCutoff,
        Number(resonance.value),
      );
      const sourceHeight = Math.min(1, source) * (height - 55);
      const filteredHeight = Math.min(1, filtered) * (height - 55);
      const centre = column * (harmonic - 0.5);
      context.fillStyle = '#79c8ff';
      context.fillRect(centre - column * 0.28, height - 32 - sourceHeight, column * 0.22, sourceHeight);
      context.fillStyle = '#f4c96b';
      context.fillRect(centre + column * 0.05, height - 32 - filteredHeight, column * 0.22, filteredHeight);
      context.fillStyle = '#9badb8'; context.font = '12px system-ui'; context.textAlign = 'center';
      context.fillText(String(harmonic), centre, height - 10);
    }
  }

  function drawHistory() {
    const context = historyContext;
    const width = historyCanvas.width;
    const height = historyCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, 8, 6);
    context.strokeStyle = '#50616c'; context.beginPath(); context.moveTo(0, 235); context.lineTo(width, 235); context.stroke();

    const line = (value: (point: HistoryPoint) => number, y: (value: number) => number, colour: string) => {
      if (!history.length) return;
      context.strokeStyle = colour; context.lineWidth = 3; context.beginPath();
      history.forEach((point, index) => {
        const x = index / Math.max(1, HISTORY_LENGTH - 1) * width;
        const py = y(value(point));
        if (index === 0) context.moveTo(x, py); else context.lineTo(x, py);
      });
      context.stroke();
    };
    line((point) => point.cutoffHz, (value) => 215 - logarithmicPosition(value) * 185, '#f4c96b');
    line((point) => point.lfoCv, (value) => 305 - Math.max(-5, Math.min(5, value)) / 5 * 55, '#79c8ff');
    line((point) => point.envelopeVoltage, (value) => 370 - Math.max(0, Math.min(5, value)) / 5 * 55, '#7be0a0');
  }

  function updateAudioMode() {
    if (!audio || !dryGain || !filteredGain || !dryPanner || !filteredPanner) return;
    const now = audio.currentTime;
    const mode = selectedAudioMode();
    dryGain.gain.setTargetAtTime(mode === 'dry' || mode === 'both' ? 1 : 0, now, .015);
    filteredGain.gain.setTargetAtTime(mode === 'filtered' || mode === 'both' ? 1 : 0, now, .015);
    dryPanner.pan.setTargetAtTime(mode === 'both' ? -0.8 : 0, now, .015);
    filteredPanner.pan.setTargetAtTime(mode === 'both' ? 0.8 : 0, now, .015);
  }

  async function startAudio() {
    if (audio) {
      await audio.resume();
      return;
    }
    audio = new AudioContext();
    oscillatorNode = audio.createOscillator();
    filterNode = audio.createBiquadFilter();
    dryGain = audio.createGain();
    filteredGain = audio.createGain();
    dryPanner = audio.createStereoPanner();
    filteredPanner = audio.createStereoPanner();
    masterGain = audio.createGain();

    oscillatorNode.type = waveform.value as OscillatorType;
    oscillatorNode.frequency.value = Number(sourceFrequency.value);
    filterNode.type = filterType.value as BiquadFilterType;
    filterNode.frequency.value = currentValues(performance.now()).effective;
    filterNode.Q.value = Number(resonance.value);
    masterGain.gain.value = muted ? 0 : Number(volume.value);

    oscillatorNode.connect(dryGain).connect(dryPanner).connect(masterGain);
    oscillatorNode.connect(filterNode).connect(filteredGain).connect(filteredPanner).connect(masterGain);
    masterGain.connect(audio.destination);
    oscillatorNode.start();
    updateAudioMode();
  }

  function toggleMute() {
    muted = !muted;
    if (audio && masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : Number(volume.value), audio.currentTime, .015);
    $('#audioMute').textContent = muted ? 'Unmute' : 'Mute';
  }

  async function stopAudio() {
    if (audio) await audio.close();
    audio = null;
    oscillatorNode = null;
    filterNode = null;
    dryGain = null;
    filteredGain = null;
    dryPanner = null;
    filteredPanner = null;
    masterGain = null;
  }

  function gateOn() {
    if (gateHeld) return;
    gateHeld = true;
    const now = performance.now();
    envelopeState = gateEnvelopeOn(envelopeState, envelopeSettings(), now);
    gate.classList.add('on');
    gate.textContent = 'Envelope gate high';
  }

  function gateOff() {
    if (!gateHeld) return;
    gateHeld = false;
    const now = performance.now();
    envelopeState = gateEnvelopeOff(envelopeState, envelopeSettings(), now);
    gate.classList.remove('on');
    gate.textContent = 'Press and hold envelope gate';
  }

  function updateLesson() {
    const lesson = lessons[lessonIndex];
    $('#lessonCount').textContent = `${lessonIndex + 1} of ${lessons.length}`;
    $('#lessonTitle').textContent = lesson[0];
    $('#lessonText').textContent = lesson[1];
    $<HTMLButtonElement>('#prev').disabled = lessonIndex === 0;
    $<HTMLButtonElement>('#next').textContent = lessonIndex === lessons.length - 1 ? 'Start again' : 'Next experiment';
  }

  function updateControlReadouts() {
    $('#cutoffOut').textContent = formatFrequency(baseCutoff());
    $('#resonanceOut').textContent = `Q ${Number(resonance.value).toFixed(2)}`;
    $('#cutoffCvOut').textContent = `${Number(cutoffCv.value) >= 0 ? '+' : ''}${Number(cutoffCv.value).toFixed(2)} V`;
    $('#modCvOut').textContent = `${Number(modCv.value) >= 0 ? '+' : ''}${Number(modCv.value).toFixed(2)} V`;
    $('#modAmountOut').textContent = `${Number(modAmount.value) >= 0 ? '+' : ''}${Number(modAmount.value).toFixed(2)}`;
    $('#lfoRateOut').textContent = `${Number(lfoRate.value).toFixed(2)} Hz`;
    $('#lfoDepthOut').textContent = `${Number(lfoDepth.value).toFixed(2)} V`;
    $('#envelopeDepthOut').textContent = `${Number(envelopeDepth.value) >= 0 ? '+' : ''}${Number(envelopeDepth.value).toFixed(2)} V`;
    $('#attackOut').textContent = `${attack.value} ms`;
    $('#decayOut').textContent = `${decay.value} ms`;
    $('#sustainOut').textContent = `${Math.round(Number(sustain.value) * 100)}%`;
    $('#releaseOut').textContent = `${release.value} ms`;
    $('#sourceFrequencyOut').textContent = formatFrequency(Number(sourceFrequency.value));
    $('#volumeOut').textContent = `${Math.round(Number(volume.value) / .16 * 100)}%`;
  }

  function render(now: number) {
    const values = currentValues(now);
    if (audio && oscillatorNode && filterNode && masterGain) {
      const audioNow = audio.currentTime;
      oscillatorNode.type = waveform.value as OscillatorType;
      oscillatorNode.frequency.setTargetAtTime(Number(sourceFrequency.value), audioNow, .01);
      filterNode.type = filterType.value as BiquadFilterType;
      filterNode.frequency.setTargetAtTime(values.effective, audioNow, .01);
      filterNode.Q.setTargetAtTime(Number(resonance.value), audioNow, .01);
      if (!muted) masterGain.gain.setTargetAtTime(Number(volume.value), audioNow, .015);
    }

    if (Math.abs(values.effective - lastEffectiveCutoff) > 0.1) {
      drawResponse(values.effective);
      drawSpectrum(values.effective);
      lastEffectiveCutoff = values.effective;
    }

    if (now - lastHistoryAt >= HISTORY_INTERVAL_MS) {
      history.push({ cutoffHz: values.effective, lfoCv: values.lfo, envelopeVoltage: values.envelope.voltage });
      if (history.length > HISTORY_LENGTH) history.shift();
      lastHistoryAt = now;
      drawHistory();
    }

    const base = baseCutoff();
    const octaveChange = cutoffVoltageFromFrequency(values.effective, base);
    const modulation = Number(modAmount.value) * (Number(modCv.value) + values.lfo + values.envelopeCv);
    $('#effectiveCutoff').textContent = formatFrequency(values.effective);
    $('#cutoffOctaves').textContent = `${octaveChange >= 0 ? '+' : ''}${octaveChange.toFixed(2)} oct`;
    $('#qReadout').textContent = `Q ${Number(resonance.value).toFixed(2)}`;
    $('#envelopeReadout').textContent = `${stageLabel(values.envelope.stage)} · ${values.envelope.voltage.toFixed(2)} V`;
    $('#fundamentalReadout').textContent = formatFrequency(Number(sourceFrequency.value));
    $('#typeReadout').textContent = filterLabel(filterType.value as FilterType);
    $('#pathBase').textContent = formatFrequency(base);
    $('#pathCutoffCv').textContent = `${Number(cutoffCv.value).toFixed(2)} V`;
    $('#pathModulation').textContent = `${modulation >= 0 ? '+' : ''}${modulation.toFixed(2)} V`;
    $('#pathEffective').textContent = formatFrequency(values.effective);
    $('#pathAudio').textContent = audio ? (muted ? 'Muted' : selectedAudioMode()) : 'Stopped';
    $('#lfoReadout').textContent = `${values.lfo >= 0 ? '+' : ''}${values.lfo.toFixed(2)} V`;
    $('#envelopeVoltageReadout').textContent = `${values.envelope.voltage.toFixed(2)} V`;
    $('#audioReadout').textContent = audio ? (muted ? 'Muted' : 'Playing') : 'Stopped';

    const type = filterType.value as FilterType;
    const source = Number(sourceFrequency.value);
    const fundamentalGain = filterMagnitude(type, source, values.effective, Number(resonance.value));
    $('#explainTitle').textContent = `${filterLabel(type)} at ${formatFrequency(values.effective)}`;
    if (type === 'lowpass') $('#explainText').textContent = `Frequencies below cutoff pass most easily. The ${formatFrequency(source)} fundamental is currently ${fundamentalGain >= 1 ? 'emphasised' : 'attenuated'}, while higher harmonics fall away progressively.`;
    else if (type === 'highpass') $('#explainText').textContent = `Frequencies above cutoff pass most easily. Low harmonics are reduced until their frequencies move above ${formatFrequency(values.effective)}.`;
    else if (type === 'bandpass') $('#explainText').textContent = `A band around ${formatFrequency(values.effective)} passes. Frequencies far below and far above that centre are both reduced.`;
    else $('#explainText').textContent = `A narrow region around ${formatFrequency(values.effective)} is rejected. Frequencies on either side continue through.`;

    animationFrame = requestAnimationFrame(render);
  }

  root.querySelectorAll<HTMLInputElement>('input[name=filterAudioMode]').forEach((input) => input.addEventListener('change', updateAudioMode));
  [cutoff, resonance, cutoffCv, modCv, modAmount, lfoRate, lfoDepth, envelopeDepth, attack, decay, sustain, release, sourceFrequency, volume]
    .forEach((control) => control.addEventListener('input', () => { updateControlReadouts(); lastEffectiveCutoff = -1; }));
  [filterType, lfoShape, waveform].forEach((control) => control.addEventListener('change', () => { lastEffectiveCutoff = -1; }));
  lfoEnabled.addEventListener('change', () => { lastEffectiveCutoff = -1; });
  $('#audioStart').addEventListener('click', startAudio);
  $('#audioMute').addEventListener('click', toggleMute);
  $('#audioStop').addEventListener('click', stopAudio);
  gate.addEventListener('pointerdown', (event) => { event.preventDefault(); gate.setPointerCapture(event.pointerId); gateOn(); });
  gate.addEventListener('pointerup', gateOff);
  gate.addEventListener('pointercancel', gateOff);
  gate.addEventListener('lostpointercapture', gateOff);
  gate.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); gateOn(); }
  });
  gate.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); gateOff(); }
  });
  $('#prev').addEventListener('click', () => { lessonIndex = Math.max(0, lessonIndex - 1); updateLesson(); });
  $('#next').addEventListener('click', () => { lessonIndex = (lessonIndex + 1) % lessons.length; updateLesson(); });
  $('#learnTab').addEventListener('click', () => { $('#lesson').removeAttribute('hidden'); $('#learnTab').classList.add('active'); $('#exploreTab').classList.remove('active'); });
  $('#exploreTab').addEventListener('click', () => { $('#lesson').setAttribute('hidden', ''); $('#exploreTab').classList.add('active'); $('#learnTab').classList.remove('active'); });

  updateLesson();
  updateControlReadouts();
  const initial = currentValues(performance.now());
  drawResponse(initial.effective);
  drawSpectrum(initial.effective);
  drawHistory();
  animationFrame = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(animationFrame);
    void stopAudio();
  };
}
