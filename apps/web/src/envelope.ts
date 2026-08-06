import {
  advanceEnvelope,
  clamp,
  envelopeDestinationValue,
  gateEnvelopeOff,
  gateEnvelopeOn,
  idleEnvelope,
  normaliseEnvelopeSettings,
  repeatingGateState,
  stageLabel,
  sustainVoltage,
  type EnvelopeDestination,
  type EnvelopeSettings,
  type EnvelopeStage,
  type EnvelopeState,
} from '../../../packages/envelope-model/src/index';

const HISTORY_LENGTH = 240;
const HISTORY_INTERVAL_MS = 34;
const PREVIEW_HOLD_MS = 700;

const lessons = [
  ['A voltage shaped over time', 'Press and hold Gate. The envelope rises, falls to sustain, remains there, then releases when you let go.'],
  ['Attack', 'Attack is the time taken to rise from the current voltage to the 5 V peak. Increase it to hear and see a slower beginning.'],
  ['Decay', 'Decay is the time taken to fall from the peak to the sustain level while the gate remains high.'],
  ['Sustain is a level', 'Sustain is not a time. It is the voltage held for as long as the gate remains high.'],
  ['Release', 'Release begins from the voltage present when the gate ends and falls smoothly to 0 V.'],
  ['Trigger and gate', 'Trigger once creates a short gate automatically. Holding Gate keeps sustain active until you release it.'],
  ['Retrigger', 'Trigger again before the envelope finishes. It starts a new attack from the current voltage without jumping.'],
  ['One shape, several destinations', 'Route the same envelope to loudness, filter brightness or pitch and compare what the voltage controls.'],
] as const;

type HistoryPoint = {
  voltage: number;
  gate: boolean;
  stage: EnvelopeStage;
};

export function mountEnvelope(root: HTMLElement) {
  root.innerHTML = `<section class="module-header"><div><p class="eyebrow">Module 05 · voltage over time</p><h2>Envelope Lab</h2><p>Shape a 0–5 V control signal with attack, decay, sustain and release, then route it to sound.</p></div><div><button id="learnTab" class="active">Learn</button> <button id="exploreTab">Explore</button></div></section><section id="lesson" class="lesson panel"><div><span id="lessonCount"></span><h3 id="lessonTitle"></h3><p id="lessonText"></p></div><div><button id="prev">Previous</button> <button id="next">Next experiment</button></div></section><section class="lab-grid"><aside class="controls panel"><h3>ADSR envelope</h3><label>Attack<input id="attack" type="range" min="0" max="3000" step="10" value="250"><output id="attackOut"></output></label><label>Decay<input id="decay" type="range" min="0" max="3000" step="10" value="350"><output id="decayOut"></output></label><label>Sustain<input id="sustain" type="range" min="0" max="1" step=".01" value=".55"><output id="sustainOut"></output></label><label>Release<input id="release" type="range" min="0" max="5000" step="10" value="700"><output id="releaseOut"></output></label><button id="gateButton" class="gate-button primary">Press and hold gate</button><label>Trigger gate length<input id="triggerLength" type="range" min="20" max="1200" step="10" value="220"><output id="triggerLengthOut"></output></label><button id="triggerButton">Trigger once</button><fieldset><legend>Repeating gate</legend><label>Tempo<input id="bpm" type="range" min="30" max="240" step="1" value="90"><output id="bpmOut"></output></label><label>Gate length<input id="gatePercent" type="range" min="5" max="95" step="1" value="45"><output id="gatePercentOut"></output></label><button id="repeatButton">Start repeating gate</button></fieldset><h3>Hear the voltage</h3><label>Destination<select id="destination"><option value="amplitude">VCA loudness</option><option value="filter">Filter brightness</option><option value="pitch">Oscillator pitch</option></select></label><label>Pitch depth<input id="pitchDepth" type="range" min=".1" max="2" step=".1" value="1"><output id="pitchDepthOut"></output></label><label>Oscillator waveform<select id="waveform"><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sine">Sine</option></select></label><label>Base frequency<input id="frequency" type="range" min="55" max="880" step="1" value="165"><output id="frequencyOut"></output></label><label>Audio comparison<select id="comparison"><option value="enveloped">Enveloped only</option><option value="dry">Dry only</option><option value="both">Both · dry left / envelope right</option></select></label><label>Volume<input id="volume" type="range" min="0" max=".12" step=".005" value=".035"><output id="volumeOut"></output></label><div class="button-row"><button id="audioStart" class="primary">Start audio</button><button id="audioMute">Mute</button><button id="audioStop">Panic / stop</button><button id="reset">Reset</button></div></aside><main class="workbench"><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Stationary shape preview</p><h3>Attack · decay · sustain · release</h3></div><div class="readouts"><span>Peak<b>5.00 V</b></span><span>Sustain voltage<b id="sustainVoltage"></b></span><span>Total preview<b id="previewDuration"></b></span></div></div><canvas id="previewCanvas" width="1100" height="340"></canvas><div class="stage-strip" aria-label="Envelope stages"><span data-stage="attack">A · Attack</span><span data-stage="decay">D · Decay</span><span data-stage="sustain">S · Sustain</span><span data-stage="release">R · Release</span></div></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Live control voltage · eight-second history</p><h3>Envelope output</h3></div><div class="readouts"><span>Voltage<b id="voltageReadout"></b></span><span>Stage<b id="stageReadout"></b></span><span>Gate<b id="gateReadout"></b></span><span>Stage time<b id="stageTimeReadout"></b></span></div></div><canvas id="historyCanvas" width="1100" height="360"></canvas><p class="scope-legend"><span class="envelope-key">Gold: envelope voltage</span><span>Top band: gate high</span><span>Stage changes remain continuous</span></p></section><section class="panel envelope-path"><div class="scope-heading"><div><p class="eyebrow">Control destination</p><h3 id="destinationHeading"></h3></div><div class="readouts"><span>Destination value<b id="destinationReadout"></b></span><span>Audio status<b id="audioStatus">Stopped</b></span></div></div><div class="path-flow"><div><small>Gate or trigger</small><b id="pathGate">Low</b></div><span>→</span><div><small>ADSR generator</small><b id="pathEnvelope">0.00 V</b></div><span>→</span><div><small id="pathDestinationLabel">VCA gain</small><b id="pathDestination">0%</b></div></div><div class="destination-meter"><span id="destinationMeter"></span></div></section><section class="explanation panel"><p class="eyebrow">What is happening?</p><h3 id="explainTitle"></h3><p id="explainText"></p></section></main></section>`;

  const $ = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  };

  const attack = $<HTMLInputElement>('#attack');
  const decay = $<HTMLInputElement>('#decay');
  const sustain = $<HTMLInputElement>('#sustain');
  const release = $<HTMLInputElement>('#release');
  const gateButton = $<HTMLButtonElement>('#gateButton');
  const triggerLength = $<HTMLInputElement>('#triggerLength');
  const bpm = $<HTMLInputElement>('#bpm');
  const gatePercent = $<HTMLInputElement>('#gatePercent');
  const destination = $<HTMLSelectElement>('#destination');
  const pitchDepth = $<HTMLInputElement>('#pitchDepth');
  const waveform = $<HTMLSelectElement>('#waveform');
  const frequency = $<HTMLInputElement>('#frequency');
  const comparison = $<HTMLSelectElement>('#comparison');
  const volume = $<HTMLInputElement>('#volume');
  const previewCanvas = $<HTMLCanvasElement>('#previewCanvas');
  const historyCanvas = $<HTMLCanvasElement>('#historyCanvas');
  const previewContext = previewCanvas.getContext('2d');
  const historyContext = historyCanvas.getContext('2d');
  if (!previewContext || !historyContext) throw new Error('Canvas unavailable');

  let lessonIndex = 0;
  let animationFrame = 0;
  let history: HistoryPoint[] = [];
  let lastHistoryAt = 0;
  let manualGate = false;
  let oneShotEndsAt = 0;
  let repeatRunning = false;
  let repeatStartedAt = performance.now();
  let repeatGateWasHigh = false;
  let state: EnvelopeState = idleEnvelope(performance.now());
  let activeSettings = readSettings();
  let muted = false;

  let audio: AudioContext | null = null;
  let dryOscillator: OscillatorNode | null = null;
  let envelopeOscillator: OscillatorNode | null = null;
  let dryGain: GainNode | null = null;
  let envelopeGain: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let dryPan: StereoPannerNode | null = null;
  let envelopePan: StereoPannerNode | null = null;
  let masterGain: GainNode | null = null;

  function readSettings(): EnvelopeSettings {
    return normaliseEnvelopeSettings({
      attackMs: Number(attack.value),
      decayMs: Number(decay.value),
      sustainLevel: Number(sustain.value),
      releaseMs: Number(release.value),
      peakVoltage: 5,
    });
  }

  function currentDestination() {
    return destination.value as EnvelopeDestination;
  }

  function desiredGate(now: number) {
    const repeatHigh = repeatRunning
      ? repeatingGateState(now - repeatStartedAt, Number(bpm.value), Number(gatePercent.value))
      : false;
    repeatGateWasHigh = repeatHigh;
    return manualGate || now < oneShotEndsAt || repeatHigh;
  }

  function updateGate(now: number) {
    const high = desiredGate(now);
    if (high && !state.gate) state = gateEnvelopeOn(state, activeSettings, now);
    else if (!high && state.gate) state = gateEnvelopeOff(state, activeSettings, now);
  }

  function pressGate() {
    if (manualGate) return;
    manualGate = true;
    const now = performance.now();
    state = gateEnvelopeOn(state, activeSettings, now);
  }

  function releaseGate() {
    if (!manualGate) return;
    manualGate = false;
    const now = performance.now();
    if (!desiredGate(now)) state = gateEnvelopeOff(state, activeSettings, now);
  }

  function triggerOnce() {
    const now = performance.now();
    state = gateEnvelopeOn(state, activeSettings, now);
    oneShotEndsAt = now + Number(triggerLength.value);
  }

  function rebaseSettings() {
    const now = performance.now();
    const current = advanceEnvelope(state, activeSettings, now);
    activeSettings = readSettings();
    if (current.stage === 'idle') state = idleEnvelope(now);
    else if (current.stage === 'sustain') {
      state = {
        stage: 'sustain',
        gate: current.gate,
        stageStartedAtMs: now,
        stageStartVoltage: sustainVoltage(activeSettings),
      };
    } else {
      state = {
        stage: current.stage,
        gate: current.gate,
        stageStartedAtMs: now,
        stageStartVoltage: current.voltage,
      };
    }
    drawPreview();
  }

  function previewVoltageAt(timeMs: number, gateOffAt: number) {
    const high = gateEnvelopeOn(idleEnvelope(0), activeSettings, 0);
    if (timeMs <= gateOffAt) return advanceEnvelope(high, activeSettings, timeMs).voltage;
    const released = gateEnvelopeOff(high, activeSettings, gateOffAt);
    return advanceEnvelope(released, activeSettings, timeMs).voltage;
  }

  function drawPreview() {
    const context = previewContext;
    const width = previewCanvas.width;
    const height = previewCanvas.height;
    const left = 58;
    const right = width - 24;
    const top = 24;
    const bottom = height - 42;
    const settings = normaliseEnvelopeSettings(activeSettings);
    const gateOffAt = settings.attackMs + settings.decayMs + PREVIEW_HOLD_MS;
    const totalMs = gateOffAt + settings.releaseMs;
    const safeTotal = Math.max(1, totalMs);
    const xFor = (time: number) => left + time / safeTotal * (right - left);
    const yFor = (voltage: number) => bottom - voltage / settings.peakVoltage * (bottom - top);

    context.fillStyle = '#101821';
    context.fillRect(0, 0, width, height);
    context.font = '12px system-ui';

    for (let volts = 0; volts <= 5; volts += 1) {
      const y = yFor(volts);
      context.strokeStyle = volts === 0 ? '#526371' : '#263944';
      context.lineWidth = volts === 0 ? 1.5 : 1;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
      context.fillStyle = '#9aacb7';
      context.fillText(`${volts} V`, 15, y + 4);
    }

    const boundaries = [
      { time: settings.attackMs, label: 'Peak' },
      { time: settings.attackMs + settings.decayMs, label: 'Sustain' },
      { time: gateOffAt, label: 'Gate off' },
    ];
    boundaries.forEach(({ time, label }) => {
      const x = xFor(time);
      context.strokeStyle = '#40515d';
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, bottom);
      context.stroke();
      context.fillStyle = '#9aacb7';
      context.fillText(label, x + 5, top + 14);
    });

    context.strokeStyle = '#79c8ff';
    context.lineWidth = 4;
    context.beginPath();
    for (let index = 0; index < 900; index += 1) {
      const progress = index / 899;
      const time = progress * safeTotal;
      const x = xFor(time);
      const y = yFor(previewVoltageAt(time, gateOffAt));
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();

    context.fillStyle = '#b9c5ce';
    context.fillText('Gate high', left + 8, height - 14);
    context.strokeStyle = '#f4c96b';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(left, height - 27);
    context.lineTo(xFor(gateOffAt), height - 27);
    context.stroke();
  }

  function historyY(voltage: number) {
    const top = 42;
    const bottom = historyCanvas.height - 36;
    return bottom - clamp(voltage / 5, 0, 1) * (bottom - top);
  }

  function sampleHistory(now: number, voltageNow: number, stage: EnvelopeStage, gate: boolean) {
    if (now - lastHistoryAt < HISTORY_INTERVAL_MS) return;
    lastHistoryAt = now;
    history.push({ voltage: voltageNow, stage, gate });
    if (history.length > HISTORY_LENGTH) history = history.slice(history.length - HISTORY_LENGTH);
  }

  function drawHistory() {
    const context = historyContext;
    const width = historyCanvas.width;
    const height = historyCanvas.height;
    const left = 58;
    const right = width - 24;
    const top = 42;
    const bottom = height - 36;
    const plotWidth = right - left;

    context.fillStyle = '#101821';
    context.fillRect(0, 0, width, height);
    context.font = '12px system-ui';

    for (let volts = 0; volts <= 5; volts += 1) {
      const y = historyY(volts);
      context.strokeStyle = volts === 0 ? '#526371' : '#263944';
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
      context.fillStyle = '#9aacb7';
      context.fillText(`${volts} V`, 15, y + 4);
    }

    for (let tick = 0; tick <= 4; tick += 1) {
      const x = left + tick / 4 * plotWidth;
      context.strokeStyle = '#21313b';
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, bottom);
      context.stroke();
      const seconds = HISTORY_LENGTH * HISTORY_INTERVAL_MS / 1000 * (1 - tick / 4);
      context.fillStyle = '#82939e';
      context.fillText(tick === 4 ? 'now' : `−${seconds.toFixed(1)} s`, x - 17, height - 10);
    }

    if (history.length < 2) return;
    const padding = HISTORY_LENGTH - history.length;
    const pointX = (index: number) => left + index / (HISTORY_LENGTH - 1) * plotWidth;

    history.forEach((point, index) => {
      if (!point.gate) return;
      const x = pointX(index + padding);
      context.strokeStyle = 'rgba(121, 200, 255, .28)';
      context.lineWidth = Math.max(2, plotWidth / HISTORY_LENGTH + 1);
      context.beginPath();
      context.moveTo(x, 15);
      context.lineTo(x, 31);
      context.stroke();
    });

    context.strokeStyle = '#f4c96b';
    context.lineWidth = 3.5;
    context.beginPath();
    history.forEach((point, index) => {
      const x = pointX(index + padding);
      const y = historyY(point.voltage);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  function destinationDescription(voltageNow: number) {
    const selected = currentDestination();
    const value = envelopeDestinationValue(voltageNow, selected, Number(pitchDepth.value));
    if (selected === 'amplitude') {
      return {
        heading: 'Envelope → VCA loudness',
        label: 'VCA gain',
        value,
        text: `${Math.round(value * 100)}% gain`,
        explanation: 'The envelope voltage opens and closes a virtual amplifier. At 0 V the enveloped voice is silent; at 5 V it reaches full level.',
      };
    }
    if (selected === 'filter') {
      return {
        heading: 'Envelope → filter brightness',
        label: 'Low-pass cutoff',
        value: clamp((value - 120) / 7880, 0, 1),
        text: `${Math.round(value)} Hz`,
        explanation: 'The envelope voltage moves a low-pass filter from dark to bright while the oscillator pitch stays fixed.',
      };
    }
    const ratio = value;
    return {
      heading: 'Envelope → oscillator pitch',
      label: 'Pitch multiplier',
      value: clamp((ratio - 1) / (2 ** Number(pitchDepth.value) - 1 || 1), 0, 1),
      text: `×${ratio.toFixed(2)}`,
      explanation: `The envelope voltage raises pitch by up to ${Number(pitchDepth.value).toFixed(1)} octave${Number(pitchDepth.value) === 1 ? '' : 's'}.`,
    };
  }

  function renderReadouts(snapshot: ReturnType<typeof advanceEnvelope>) {
    const settings = normaliseEnvelopeSettings(activeSettings);
    const destinationInfo = destinationDescription(snapshot.voltage);
    const totalPreview = settings.attackMs + settings.decayMs + PREVIEW_HOLD_MS + settings.releaseMs;

    $<HTMLOutputElement>('#attackOut').value = `${settings.attackMs} ms`;
    $<HTMLOutputElement>('#decayOut').value = `${settings.decayMs} ms`;
    $<HTMLOutputElement>('#sustainOut').value = `${Math.round(settings.sustainLevel * 100)}% · ${sustainVoltage(settings).toFixed(2)} V`;
    $<HTMLOutputElement>('#releaseOut').value = `${settings.releaseMs} ms`;
    $<HTMLOutputElement>('#triggerLengthOut').value = `${triggerLength.value} ms`;
    $<HTMLOutputElement>('#bpmOut').value = `${bpm.value} BPM`;
    $<HTMLOutputElement>('#gatePercentOut').value = `${gatePercent.value}%`;
    $<HTMLOutputElement>('#pitchDepthOut').value = `${Number(pitchDepth.value).toFixed(1)} oct`;
    $<HTMLOutputElement>('#frequencyOut').value = `${frequency.value} Hz`;
    $<HTMLOutputElement>('#volumeOut').value = `${Math.round(Number(volume.value) / .12 * 100)}%`;
    $<HTMLElement>('#sustainVoltage').textContent = `${sustainVoltage(settings).toFixed(2)} V`;
    $<HTMLElement>('#previewDuration').textContent = `${(totalPreview / 1000).toFixed(2)} s`;
    $<HTMLElement>('#voltageReadout').textContent = `${snapshot.voltage.toFixed(2)} V`;
    $<HTMLElement>('#stageReadout').textContent = stageLabel(snapshot.stage);
    $<HTMLElement>('#gateReadout').textContent = snapshot.gate ? 'High' : 'Low';
    $<HTMLElement>('#stageTimeReadout').textContent = `${Math.round(snapshot.stageElapsedMs)} ms`;
    $<HTMLElement>('#destinationHeading').textContent = destinationInfo.heading;
    $<HTMLElement>('#destinationReadout').textContent = destinationInfo.text;
    $<HTMLElement>('#pathGate').textContent = snapshot.gate ? 'High' : 'Low';
    $<HTMLElement>('#pathEnvelope').textContent = `${snapshot.voltage.toFixed(2)} V`;
    $<HTMLElement>('#pathDestinationLabel').textContent = destinationInfo.label;
    $<HTMLElement>('#pathDestination').textContent = destinationInfo.text;
    $<HTMLElement>('#destinationMeter').style.width = `${destinationInfo.value * 100}%`;
    $<HTMLElement>('#explainTitle').textContent = snapshot.stage === 'idle' ? 'Waiting for a gate' : `${stageLabel(snapshot.stage)} stage`;
    $<HTMLElement>('#explainText').textContent = snapshot.stage === 'idle'
      ? 'Press Gate, trigger once, or start the repeating gate to create an envelope.'
      : destinationInfo.explanation;

    gateButton.classList.toggle('on', manualGate);
    gateButton.textContent = manualGate ? 'Gate held high · release to end' : 'Press and hold gate';
    $<HTMLButtonElement>('#repeatButton').textContent = repeatRunning ? 'Stop repeating gate' : 'Start repeating gate';
    $<HTMLInputElement>('#pitchDepth').disabled = currentDestination() !== 'pitch';
    root.querySelectorAll<HTMLElement>('.stage-strip [data-stage]').forEach((element) => {
      element.classList.toggle('on', element.dataset.stage === snapshot.stage);
    });
  }

  function applyAudio(snapshot: ReturnType<typeof advanceEnvelope>) {
    if (!audio || !dryOscillator || !envelopeOscillator || !dryGain || !envelopeGain || !filter || !dryPan || !envelopePan || !masterGain) return;
    const now = audio.currentTime;
    const baseFrequency = Number(frequency.value);
    const selectedDestination = currentDestination();
    const destinationValue = envelopeDestinationValue(snapshot.voltage, selectedDestination, Number(pitchDepth.value));
    const level = Number(volume.value);
    const mode = comparison.value;
    const bothScale = mode === 'both' ? .65 : 1;

    dryOscillator.type = waveform.value as OscillatorType;
    envelopeOscillator.type = waveform.value as OscillatorType;
    dryOscillator.frequency.setTargetAtTime(baseFrequency, now, .01);
    envelopeOscillator.frequency.setTargetAtTime(
      selectedDestination === 'pitch' ? baseFrequency * destinationValue : baseFrequency,
      now,
      .012,
    );
    filter.frequency.setTargetAtTime(
      selectedDestination === 'filter' ? destinationValue : 12000,
      now,
      .015,
    );
    filter.Q.setTargetAtTime(1.2, now, .02);

    const envelopeLevel = selectedDestination === 'amplitude' ? level * destinationValue : level;
    dryGain.gain.setTargetAtTime(mode === 'enveloped' ? 0 : level * bothScale, now, .015);
    envelopeGain.gain.setTargetAtTime(mode === 'dry' ? 0 : envelopeLevel * bothScale, now, .015);
    dryPan.pan.setTargetAtTime(mode === 'both' ? -.65 : 0, now, .02);
    envelopePan.pan.setTargetAtTime(mode === 'both' ? .65 : 0, now, .02);
    masterGain.gain.setTargetAtTime(muted ? 0 : 1, now, .015);
  }

  async function startAudio() {
    if (!audio) {
      audio = new AudioContext();
      dryOscillator = audio.createOscillator();
      envelopeOscillator = audio.createOscillator();
      dryGain = audio.createGain();
      envelopeGain = audio.createGain();
      filter = audio.createBiquadFilter();
      dryPan = audio.createStereoPanner();
      envelopePan = audio.createStereoPanner();
      masterGain = audio.createGain();
      dryGain.gain.value = 0;
      envelopeGain.gain.value = 0;
      masterGain.gain.value = 0;
      filter.type = 'lowpass';
      dryOscillator.connect(dryGain).connect(dryPan).connect(masterGain);
      envelopeOscillator.connect(filter).connect(envelopeGain).connect(envelopePan).connect(masterGain);
      masterGain.connect(audio.destination);
      dryOscillator.start();
      envelopeOscillator.start();
    }
    if (audio.state === 'suspended') await audio.resume();
    muted = false;
    $<HTMLButtonElement>('#audioMute').textContent = 'Mute';
    $<HTMLElement>('#audioStatus').textContent = 'Running';
  }

  async function stopAudio() {
    [dryOscillator, envelopeOscillator].forEach((oscillator) => {
      if (!oscillator) return;
      try { oscillator.stop(); } catch {}
      oscillator.disconnect();
    });
    [dryGain, envelopeGain, filter, dryPan, envelopePan, masterGain].forEach((node) => node?.disconnect());
    if (audio) await audio.close();
    audio = null;
    dryOscillator = null;
    envelopeOscillator = null;
    dryGain = null;
    envelopeGain = null;
    filter = null;
    dryPan = null;
    envelopePan = null;
    masterGain = null;
    $<HTMLElement>('#audioStatus').textContent = 'Stopped';
  }

  function lesson(index: number) {
    lessonIndex = (index + lessons.length) % lessons.length;
    const current = lessons[lessonIndex];
    $<HTMLElement>('#lessonCount').textContent = `Experiment ${lessonIndex + 1} of ${lessons.length}`;
    $<HTMLElement>('#lessonTitle').textContent = current[0];
    $<HTMLElement>('#lessonText').textContent = current[1];
  }

  function reset() {
    attack.value = '250';
    decay.value = '350';
    sustain.value = '.55';
    release.value = '700';
    triggerLength.value = '220';
    bpm.value = '90';
    gatePercent.value = '45';
    destination.value = 'amplitude';
    pitchDepth.value = '1';
    waveform.value = 'sawtooth';
    frequency.value = '165';
    comparison.value = 'enveloped';
    volume.value = '.035';
    manualGate = false;
    oneShotEndsAt = 0;
    repeatRunning = false;
    repeatGateWasHigh = false;
    history = [];
    activeSettings = readSettings();
    state = idleEnvelope(performance.now());
    drawPreview();
  }

  function animate() {
    const now = performance.now();
    updateGate(now);
    const snapshot = advanceEnvelope(state, activeSettings, now);
    state = {
      stage: snapshot.stage,
      gate: snapshot.gate,
      stageStartedAtMs: snapshot.stageStartedAtMs,
      stageStartVoltage: snapshot.stageStartVoltage,
    };
    sampleHistory(now, snapshot.voltage, snapshot.stage, snapshot.gate);
    drawHistory();
    renderReadouts(snapshot);
    applyAudio(snapshot);
    animationFrame = requestAnimationFrame(animate);
  }

  [attack, decay, sustain, release].forEach((control) => control.addEventListener('input', rebaseSettings));
  [triggerLength, bpm, gatePercent, destination, pitchDepth, waveform, frequency, comparison, volume].forEach((control) => control.addEventListener('input', () => {}));

  gateButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    gateButton.setPointerCapture(event.pointerId);
    pressGate();
  });
  gateButton.addEventListener('pointerup', releaseGate);
  gateButton.addEventListener('pointercancel', releaseGate);
  gateButton.addEventListener('lostpointercapture', releaseGate);
  gateButton.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) pressGate();
  });
  gateButton.addEventListener('keyup', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    releaseGate();
  });

  $<HTMLButtonElement>('#triggerButton').onclick = triggerOnce;
  $<HTMLButtonElement>('#repeatButton').onclick = () => {
    repeatRunning = !repeatRunning;
    repeatStartedAt = performance.now();
    repeatGateWasHigh = false;
    if (!repeatRunning && !manualGate && performance.now() >= oneShotEndsAt && state.gate) {
      state = gateEnvelopeOff(state, activeSettings, performance.now());
    }
  };
  $<HTMLButtonElement>('#audioStart').onclick = startAudio;
  $<HTMLButtonElement>('#audioStop').onclick = stopAudio;
  $<HTMLButtonElement>('#audioMute').onclick = () => {
    muted = !muted;
    $<HTMLButtonElement>('#audioMute').textContent = muted ? 'Unmute' : 'Mute';
  };
  $<HTMLButtonElement>('#reset').onclick = reset;
  $<HTMLButtonElement>('#prev').onclick = () => lesson(lessonIndex - 1);
  $<HTMLButtonElement>('#next').onclick = () => lesson(lessonIndex + 1);
  $<HTMLButtonElement>('#learnTab').onclick = () => { $<HTMLElement>('#lesson').hidden = false; };
  $<HTMLButtonElement>('#exploreTab').onclick = () => { $<HTMLElement>('#lesson').hidden = true; };

  lesson(0);
  drawPreview();
  animate();

  return () => {
    cancelAnimationFrame(animationFrame);
    void stopAudio();
  };
}
