import {
  NOTE_NAMES,
  SCALE_LABELS,
  type ScaleName,
} from '../../../packages/quantizer-model/src/index';
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
import {
  clonePreset,
  nextPatchStep,
  patchSnapshotAt,
  patchStepSnapshot,
  type PatchSettings,
  type PatchStep,
  type PatchStepSnapshot,
  type SequencePresetName,
} from '../../../packages/patch-model/src/index';

const HISTORY_LENGTH = 260;
const HISTORY_INTERVAL_MS = 38;

const lessons = [
  ['The first complete patch', 'Start the transport. A clock advances the eight-step sequence, the quantizer chooses permitted notes, the oscillator makes sound and the envelope shapes each note.'],
  ['Clock becomes movement', 'Change tempo and rate. The clock does not create pitch; it decides when the sequencer moves to its next voltage.'],
  ['A sequence is control voltage', 'Move any step CV. The blue point is the raw voltage before musical correction.'],
  ['Quantization makes notes', 'Change the root or scale. The gold output moves to the nearest permitted 1/12 V note.'],
  ['Rests are missing gates', 'Turn a step gate off. Its pitch still exists, but no gate reaches the envelope, so the step becomes silent.'],
  ['The oscillator follows 1 V/oct', 'Change Octave. Adding 1 V doubles frequency while preserving the quantized melody.'],
  ['The envelope makes separate notes', 'Change attack, decay, sustain and release. The envelope opens and closes the VCA for each active step.'],
  ['Read the whole signal path', 'Follow the highlighted nodes from clock to audio. Each stage changes one specific part of the result.'],
] as const;

type HistoryPoint = {
  rawVoltage: number;
  quantizedVoltage: number;
  envelopeVoltage: number;
  gate: boolean;
  step: number;
};

export function mountPatch(root: HTMLElement) {
  const rootOptions = NOTE_NAMES.map((note, index) => `<option value="${index}">${note}</option>`).join('');
  const scaleOptions = (Object.entries(SCALE_LABELS) as [ScaleName, string][])
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');

  root.innerHTML = `<section class="module-header"><div><p class="eyebrow">Module 06 · complete signal chain</p><h2>Patch Lab</h2><p>Build and play the first complete patch: clock → sequence → quantizer → oscillator → envelope → audio.</p></div><div><button id="learnTab" class="active">Learn</button> <button id="exploreTab">Explore</button></div></section><section id="lesson" class="lesson panel"><div><span id="lessonCount"></span><h3 id="lessonTitle"></h3><p id="lessonText"></p></div><div><button id="prev">Previous</button> <button id="next">Next experiment</button></div></section><section class="lab-grid patch-lab-grid"><aside class="controls panel"><h3>Transport</h3><label>Tempo<input id="bpm" type="range" min="30" max="240" step="1" value="100"><output id="bpmOut"></output></label><label>Step rate<select id="rate"><option value="1">Quarter notes</option><option value="2" selected>Eighth notes</option><option value="4">Sixteenth notes</option></select></label><label>Gate length<input id="gatePercent" type="range" min="10" max="95" step="1" value="55"><output id="gatePercentOut"></output></label><div class="button-row"><button id="transport" class="primary">Start transport</button><button id="resetTransport">Reset to step 1</button><button id="manualStep">Next step</button><button id="randomise">Rotate sequence</button></div><h3>Sequence and quantizer</h3><label>Preset<select id="preset"><option value="ascending">Ascending voltage</option><option value="minorPulse">Minor pulse</option><option value="octaveRests">Octaves and rests</option></select></label><label>Root note<select id="rootNote">${rootOptions}</select></label><label>Scale<select id="scale">${scaleOptions}</select></label><h3>Oscillator</h3><label>Waveform<select id="waveform"><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sine">Sine</option></select></label><label>Octave<select id="octave"><option value="-2">−2 octaves</option><option value="-1">−1 octave</option><option value="0" selected>Normal</option><option value="1">+1 octave</option><option value="2">+2 octaves</option></select></label><label>Fine tuning<input id="tuning" type="range" min="-100" max="100" step="1" value="0"><output id="tuningOut"></output></label><h3>Amplitude envelope</h3><label>Attack<input id="attack" type="range" min="0" max="1000" step="10" value="35"><output id="attackOut"></output></label><label>Decay<input id="decay" type="range" min="0" max="1000" step="10" value="180"><output id="decayOut"></output></label><label>Sustain<input id="sustain" type="range" min="0" max="1" step=".01" value=".55"><output id="sustainOut"></output></label><label>Release<input id="release" type="range" min="0" max="2000" step="10" value="240"><output id="releaseOut"></output></label><h3>Audio</h3><label>Volume<input id="volume" type="range" min="0" max=".12" step=".005" value=".04"><output id="volumeOut"></output></label><div class="button-row"><button id="audioStart" class="primary">Start audio</button><button id="audioMute">Mute</button><button id="audioStop">Panic / stop</button></div></aside><main class="workbench"><section class="panel patch-sequence"><div class="scope-heading"><div><p class="eyebrow">Editable eight-step voltage sequence</p><h3>Raw CV, quantized notes and gates</h3></div><div class="readouts"><span>Current step<b id="stepReadout">1</b></span><span>Raw CV<b id="rawReadout">0.00 V</b></span><span>Quantized CV<b id="quantizedReadout">0.00 V</b></span><span>Note<b id="noteReadout">C4</b></span><span>Frequency<b id="frequencyReadout">261.6 Hz</b></span><span>Gate<b id="gateReadout">Low</b></span><span>Envelope<b id="envelopeReadout">0.00 V</b></span></div></div><div id="stepEditors" class="patch-step-editors"></div></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Stationary sequence overview</p><h3>Eight voltages before and after quantization</h3></div><div class="scope-legend"><span class="raw-key">Blue: raw sequence CV</span><span class="quantized-key">Gold: quantized CV</span><span>Cross: rest</span></div></div><canvas id="sequenceCanvas" width="1100" height="330"></canvas></section><section class="panel patch-flow-panel"><p class="eyebrow">Live patch cable path</p><h3>One event moving through six modules</h3><div class="patch-flow" id="patchFlow"><div data-node="clock"><small>1 · Clock</small><b id="flowClock">Stopped</b></div><span>→</span><div data-node="sequence"><small>2 · Sequencer</small><b id="flowSequence">Step 1 · 0.00 V</b></div><span>→</span><div data-node="quantizer"><small>3 · Quantizer</small><b id="flowQuantizer">C4 · 0.00 V</b></div><span>→</span><div data-node="oscillator"><small>4 · Oscillator</small><b id="flowOscillator">261.6 Hz</b></div><span>→</span><div data-node="envelope"><small>5 · Envelope / VCA</small><b id="flowEnvelope">Idle · 0.00 V</b></div><span>→</span><div data-node="audio"><small>6 · Audio</small><b id="flowAudio">Stopped</b></div></div></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Live output history</p><h3>Pitch voltage and amplitude envelope</h3></div><div class="readouts"><span>Transport<b id="transportReadout">Stopped</b></span><span>Audio<b id="audioReadout">Stopped</b></span></div></div><canvas id="historyCanvas" width="1100" height="390"></canvas><p class="scope-legend"><span class="raw-key">Upper blue: raw CV</span><span class="quantized-key">Upper gold: quantized CV</span><span class="envelope-key">Lower green: envelope</span></p></section><section class="explanation panel"><p class="eyebrow">What is happening?</p><h3 id="explainTitle">The patch is stopped</h3><p id="explainText">Start the transport to send the first sequence voltage through the complete patch.</p></section></main></section>`;

  const $ = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  };

  const bpm = $<HTMLInputElement>('#bpm');
  const rate = $<HTMLSelectElement>('#rate');
  const gatePercent = $<HTMLInputElement>('#gatePercent');
  const preset = $<HTMLSelectElement>('#preset');
  const rootNote = $<HTMLSelectElement>('#rootNote');
  const scale = $<HTMLSelectElement>('#scale');
  const waveform = $<HTMLSelectElement>('#waveform');
  const octave = $<HTMLSelectElement>('#octave');
  const tuning = $<HTMLInputElement>('#tuning');
  const attack = $<HTMLInputElement>('#attack');
  const decay = $<HTMLInputElement>('#decay');
  const sustain = $<HTMLInputElement>('#sustain');
  const release = $<HTMLInputElement>('#release');
  const volume = $<HTMLInputElement>('#volume');
  const transportButton = $<HTMLButtonElement>('#transport');
  const sequenceCanvas = $<HTMLCanvasElement>('#sequenceCanvas');
  const historyCanvas = $<HTMLCanvasElement>('#historyCanvas');
  const sequenceContext = sequenceCanvas.getContext('2d');
  const historyContext = historyCanvas.getContext('2d');
  if (!sequenceContext || !historyContext) throw new Error('Canvas unavailable');

  let sequence: PatchStep[] = clonePreset('ascending');
  let running = false;
  let heldIndex = 0;
  let transportStartedAt = performance.now();
  let currentIndex = -1;
  let lessonIndex = 0;
  let animationFrame = 0;
  let lastHistoryAt = 0;
  let history: HistoryPoint[] = [];
  let envelopeState: EnvelopeState = idleEnvelope(performance.now());
  let muted = false;

  let audio: AudioContext | null = null;
  let oscillatorNode: OscillatorNode | null = null;
  let vcaNode: GainNode | null = null;
  let masterNode: GainNode | null = null;

  function patchSettings(): PatchSettings {
    return {
      bpm: Number(bpm.value),
      stepsPerBeat: Number(rate.value),
      gatePercent: Number(gatePercent.value),
      root: Number(rootNote.value),
      scale: scale.value as ScaleName,
      octaveOffset: Number(octave.value),
      tuningCents: Number(tuning.value),
    };
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

  function snapshotAt(now = performance.now()) {
    return patchSnapshotAt(sequence, running, heldIndex, transportStartedAt, now, patchSettings());
  }

  function renderStepEditors() {
    $('#stepEditors').innerHTML = sequence.map((step, index) => {
      const snapshot = patchStepSnapshot(sequence, index, patchSettings());
      return `<article class="patch-step" data-step="${index}"><header><b>Step ${index + 1}</b><span id="stepNote${index}">${snapshot.note}</span></header><label>Control voltage<input data-step-voltage="${index}" type="range" min="-2" max="4" step=".01" value="${step.voltage}"><output id="stepVoltage${index}">${step.voltage.toFixed(2)} V</output></label><label class="toggle-line"><input data-step-gate="${index}" type="checkbox" ${step.gate ? 'checked' : ''}> Gate active</label></article>`;
    }).join('');

    root.querySelectorAll<HTMLInputElement>('[data-step-voltage]').forEach((input) => {
      input.addEventListener('input', () => {
        const index = Number(input.dataset.stepVoltage);
        sequence[index].voltage = Number(input.value);
        updateStepLabels();
        drawSequence();
      });
    });

    root.querySelectorAll<HTMLInputElement>('[data-step-gate]').forEach((input) => {
      input.addEventListener('change', () => {
        const index = Number(input.dataset.stepGate);
        sequence[index].gate = input.checked;
        updateStepLabels();
        drawSequence();
      });
    });
  }

  function updateStepLabels() {
    sequence.forEach((step, index) => {
      const snapshot = patchStepSnapshot(sequence, index, patchSettings());
      const voltageOut = root.querySelector<HTMLOutputElement>(`#stepVoltage${index}`);
      const noteOut = root.querySelector<HTMLElement>(`#stepNote${index}`);
      if (voltageOut) voltageOut.value = `${step.voltage.toFixed(2)} V`;
      if (noteOut) noteOut.textContent = step.gate ? snapshot.note : `${snapshot.note} · rest`;
    });
  }

  function preserveTransportPosition() {
    const now = performance.now();
    const snapshot = snapshotAt(now);
    heldIndex = snapshot.index;
    transportStartedAt = now;
    currentIndex = -1;
  }

  function startTransport() {
    if (running) {
      const now = performance.now();
      heldIndex = snapshotAt(now).index;
      running = false;
      transportStartedAt = now;
      releaseEnvelope(now);
    } else {
      running = true;
      transportStartedAt = performance.now();
      currentIndex = -1;
    }
    updateButtons();
  }

  function resetTransport() {
    heldIndex = 0;
    transportStartedAt = performance.now();
    currentIndex = -1;
    releaseEnvelope(transportStartedAt);
  }

  function manualStep() {
    const now = performance.now();
    heldIndex = nextPatchStep(snapshotAt(now).index, sequence.length);
    transportStartedAt = now;
    currentIndex = -1;
  }

  function rotateSequence() {
    sequence = [sequence[sequence.length - 1], ...sequence.slice(0, -1)].map((step) => ({ ...step }));
    renderStepEditors();
    drawSequence();
    currentIndex = -1;
  }

  function applyPreset(name: SequencePresetName) {
    sequence = clonePreset(name);
    renderStepEditors();
    drawSequence();
    resetTransport();
  }

  function triggerEnvelope(now: number) {
    envelopeState = gateEnvelopeOn(envelopeState, envelopeSettings(), now);
  }

  function releaseEnvelope(now: number) {
    if (envelopeState.gate) envelopeState = gateEnvelopeOff(envelopeState, envelopeSettings(), now);
    releaseAudio(now);
  }

  function handleStepStart(snapshot: PatchStepSnapshot, now: number) {
    currentIndex = snapshot.index;
    if (snapshot.stepActive) {
      triggerEnvelope(now);
      playAudioStep(snapshot);
    } else {
      releaseEnvelope(now);
    }
  }

  function updateEnvelopeGate(snapshot: PatchStepSnapshot, now: number) {
    if (!snapshot.gateHigh && envelopeState.gate) releaseEnvelope(now);
  }

  async function startAudio() {
    if (audio) {
      await audio.resume();
      return;
    }
    audio = new AudioContext();
    oscillatorNode = audio.createOscillator();
    vcaNode = audio.createGain();
    masterNode = audio.createGain();
    oscillatorNode.type = waveform.value as OscillatorType;
    oscillatorNode.frequency.value = snapshotAt().frequencyHz;
    vcaNode.gain.value = 0;
    masterNode.gain.value = muted ? 0 : 1;
    oscillatorNode.connect(vcaNode).connect(masterNode).connect(audio.destination);
    oscillatorNode.start();
  }

  function playAudioStep(snapshot: PatchStepSnapshot) {
    if (!audio || !oscillatorNode || !vcaNode) return;
    const now = audio.currentTime;
    const settings = envelopeSettings();
    const peak = Number(volume.value);
    const sustainGain = peak * settings.sustainLevel;
    const gateOff = now + snapshot.stepDurationMs * patchSettings().gatePercent / 100 / 1000;
    const gain = vcaNode.gain;
    oscillatorNode.type = waveform.value as OscillatorType;
    oscillatorNode.frequency.cancelScheduledValues(now);
    oscillatorNode.frequency.setValueAtTime(snapshot.frequencyHz, now);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0, gain.value), now);
    gain.linearRampToValueAtTime(peak, now + Math.max(.001, settings.attackMs / 1000));
    gain.linearRampToValueAtTime(sustainGain, now + Math.max(.002, (settings.attackMs + settings.decayMs) / 1000));
    gain.cancelAndHoldAtTime(gateOff);
    gain.linearRampToValueAtTime(0, gateOff + Math.max(.001, settings.releaseMs / 1000));
  }

  function releaseAudio(_nowMs: number) {
    if (!audio || !vcaNode) return;
    const now = audio.currentTime;
    const releaseSeconds = Math.max(.001, Number(release.value) / 1000);
    vcaNode.gain.cancelAndHoldAtTime(now);
    vcaNode.gain.linearRampToValueAtTime(0, now + releaseSeconds);
  }

  function toggleMute() {
    muted = !muted;
    if (audio && masterNode) masterNode.gain.setTargetAtTime(muted ? 0 : 1, audio.currentTime, .01);
    updateButtons();
  }

  async function stopAudio() {
    if (audio) await audio.close();
    audio = null;
    oscillatorNode = null;
    vcaNode = null;
    masterNode = null;
  }

  function drawGrid(context: CanvasRenderingContext2D, width: number, height: number) {
    context.strokeStyle = '#263642';
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 8) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let y = 0; y <= height; y += height / 6) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
  }

  function pitchY(voltage: number, top: number, bottom: number) {
    return bottom - (Math.min(4, Math.max(-2, voltage)) + 2) / 6 * (bottom - top);
  }

  function drawSequence() {
    const context = sequenceContext;
    const width = sequenceCanvas.width;
    const height = sequenceCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height);
    const column = width / sequence.length;
    sequence.forEach((step, index) => {
      const snapshot = patchStepSnapshot(sequence, index, patchSettings());
      const centre = column * (index + .5);
      const rawY = pitchY(step.voltage, 25, height - 48);
      const quantizedY = pitchY(snapshot.quantizedVoltage, 25, height - 48);
      context.strokeStyle = '#536773'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(centre, rawY); context.lineTo(centre, quantizedY); context.stroke();
      context.fillStyle = '#79c8ff'; context.beginPath(); context.arc(centre - 9, rawY, 6, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#f4c96b'; context.beginPath(); context.arc(centre + 9, quantizedY, 6, 0, Math.PI * 2); context.fill();
      context.fillStyle = step.gate ? '#dce8ee' : '#e78585';
      context.font = '700 15px system-ui'; context.textAlign = 'center';
      context.fillText(step.gate ? snapshot.note : '× rest', centre, height - 20);
    });
  }

  function drawLine(
    context: CanvasRenderingContext2D,
    points: HistoryPoint[],
    value: (point: HistoryPoint) => number,
    y: (value: number) => number,
    colour: string,
  ) {
    if (!points.length) return;
    context.strokeStyle = colour;
    context.lineWidth = 3;
    context.beginPath();
    points.forEach((point, index) => {
      const x = index / Math.max(1, HISTORY_LENGTH - 1) * historyCanvas.width;
      const py = y(value(point));
      if (index === 0) context.moveTo(x, py); else context.lineTo(x, py);
    });
    context.stroke();
  }

  function drawHistory() {
    const context = historyContext;
    const width = historyCanvas.width;
    const height = historyCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height);
    context.strokeStyle = '#50616c'; context.beginPath(); context.moveTo(0, 245); context.lineTo(width, 245); context.stroke();
    drawLine(context, history, (point) => point.rawVoltage, (value) => pitchY(value, 20, 225), '#79c8ff');
    drawLine(context, history, (point) => point.quantizedVoltage, (value) => pitchY(value, 20, 225), '#f4c96b');
    drawLine(context, history, (point) => point.envelopeVoltage, (value) => 365 - Math.min(5, Math.max(0, value)) / 5 * 95, '#7be0a0');
  }

  function updateLesson() {
    const lesson = lessons[lessonIndex];
    $('#lessonCount').textContent = `${lessonIndex + 1} of ${lessons.length}`;
    $('#lessonTitle').textContent = lesson[0];
    $('#lessonText').textContent = lesson[1];
    ($<HTMLButtonElement>('#prev')).disabled = lessonIndex === 0;
    ($<HTMLButtonElement>('#next')).textContent = lessonIndex === lessons.length - 1 ? 'Start again' : 'Next experiment';
  }

  function updateButtons() {
    transportButton.textContent = running ? 'Stop transport' : 'Start transport';
    transportButton.classList.toggle('on', running);
    $('#audioMute').textContent = muted ? 'Unmute' : 'Mute';
  }

  function updateControlReadouts() {
    $('#bpmOut').textContent = `${bpm.value} BPM`;
    $('#gatePercentOut').textContent = `${gatePercent.value}%`;
    $('#tuningOut').textContent = `${Number(tuning.value) >= 0 ? '+' : ''}${tuning.value} cents`;
    $('#attackOut').textContent = `${attack.value} ms`;
    $('#decayOut').textContent = `${decay.value} ms`;
    $('#sustainOut').textContent = `${Math.round(Number(sustain.value) * 100)}% · ${(Number(sustain.value) * 5).toFixed(2)} V`;
    $('#releaseOut').textContent = `${release.value} ms`;
    $('#volumeOut').textContent = `${Math.round(Number(volume.value) / .12 * 100)}%`;
  }

  function updateFlow(snapshot: PatchStepSnapshot, envelopeVoltage: number) {
    $('#flowClock').textContent = running ? `${bpm.value} BPM · ${rate.options[rate.selectedIndex].text}` : 'Stopped';
    $('#flowSequence').textContent = `Step ${snapshot.index + 1} · ${snapshot.rawVoltage.toFixed(2)} V`;
    $('#flowQuantizer').textContent = `${snapshot.note} · ${snapshot.quantizedVoltage.toFixed(3)} V`;
    $('#flowOscillator').textContent = `${snapshot.frequencyHz.toFixed(1)} Hz · ${waveform.value}`;
    $('#flowEnvelope').textContent = `${stageLabel(advanceEnvelope(envelopeState, envelopeSettings(), performance.now()).stage)} · ${envelopeVoltage.toFixed(2)} V`;
    $('#flowAudio').textContent = audio ? (muted ? 'Muted' : 'Playing') : 'Stopped';
    root.querySelectorAll<HTMLElement>('[data-node]').forEach((node) => node.classList.remove('active'));
    const activeNode = !running ? 'clock' : !snapshot.stepActive ? 'sequence' : snapshot.gateHigh ? 'envelope' : 'audio';
    root.querySelector<HTMLElement>(`[data-node="${activeNode}"]`)?.classList.add('active');
  }

  function render(now: number) {
    const snapshot = snapshotAt(now);
    if (snapshot.index !== currentIndex) handleStepStart(snapshot, now);
    updateEnvelopeGate(snapshot, now);
    const envelope = advanceEnvelope(envelopeState, envelopeSettings(), now);
    envelopeState = {
      stage: envelope.stage,
      gate: envelope.gate,
      stageStartedAtMs: envelope.stageStartedAtMs,
      stageStartVoltage: envelope.stageStartVoltage,
    };

    if (now - lastHistoryAt >= HISTORY_INTERVAL_MS) {
      history.push({
        rawVoltage: snapshot.rawVoltage,
        quantizedVoltage: snapshot.quantizedVoltage,
        envelopeVoltage: envelope.voltage,
        gate: snapshot.gateHigh,
        step: snapshot.index,
      });
      if (history.length > HISTORY_LENGTH) history.shift();
      lastHistoryAt = now;
      drawHistory();
    }

    root.querySelectorAll<HTMLElement>('.patch-step').forEach((cell) => {
      const index = Number(cell.dataset.step);
      cell.classList.toggle('current', index === snapshot.index);
      cell.classList.toggle('rest', !sequence[index].gate);
    });

    $('#stepReadout').textContent = String(snapshot.index + 1);
    $('#rawReadout').textContent = `${snapshot.rawVoltage.toFixed(2)} V`;
    $('#quantizedReadout').textContent = `${snapshot.quantizedVoltage.toFixed(3)} V`;
    $('#noteReadout').textContent = snapshot.note;
    $('#frequencyReadout').textContent = `${snapshot.frequencyHz.toFixed(1)} Hz`;
    $('#gateReadout').textContent = snapshot.gateHigh ? 'High' : snapshot.stepActive ? 'Low' : 'Rest';
    $('#envelopeReadout').textContent = `${envelope.voltage.toFixed(2)} V`;
    $('#transportReadout').textContent = running ? `${bpm.value} BPM` : 'Stopped';
    $('#audioReadout').textContent = audio ? (muted ? 'Muted' : 'Playing') : 'Stopped';
    updateFlow(snapshot, envelope.voltage);

    if (!running) {
      $('#explainTitle').textContent = 'The patch is stopped';
      $('#explainText').textContent = `Step ${snapshot.index + 1} is held. Its ${snapshot.rawVoltage.toFixed(2)} V sequence value quantizes to ${snapshot.note}, but the clock is not advancing.`;
    } else if (!snapshot.stepActive) {
      $('#explainTitle').textContent = `Step ${snapshot.index + 1} is a rest`;
      $('#explainText').textContent = `The sequencer still outputs ${snapshot.rawVoltage.toFixed(2)} V and the quantizer still identifies ${snapshot.note}, but the missing gate leaves the envelope closed.`;
    } else if (snapshot.gateHigh) {
      $('#explainTitle').textContent = `${snapshot.note} is sounding`;
      $('#explainText').textContent = `${snapshot.rawVoltage.toFixed(2)} V became ${snapshot.quantizedVoltage.toFixed(3)} V. The oscillator follows at ${snapshot.frequencyHz.toFixed(1)} Hz while the ${stageLabel(envelope.stage).toLowerCase()} stage controls loudness.`;
    } else {
      $('#explainTitle').textContent = `${snapshot.note} is releasing`;
      $('#explainText').textContent = `The step is still selected, but its gate has ended. The envelope falls smoothly from its current voltage until the next step arrives.`;
    }

    animationFrame = requestAnimationFrame(render);
  }

  [bpm, rate, gatePercent].forEach((control) => control.addEventListener('input', () => {
    preserveTransportPosition();
    updateControlReadouts();
  }));
  [rootNote, scale, octave, tuning].forEach((control) => control.addEventListener('input', () => {
    preserveTransportPosition();
    updateControlReadouts();
    updateStepLabels();
    drawSequence();
  }));
  [attack, decay, sustain, release, volume].forEach((control) => control.addEventListener('input', updateControlReadouts));
  waveform.addEventListener('change', () => { if (oscillatorNode) oscillatorNode.type = waveform.value as OscillatorType; });
  preset.addEventListener('change', () => applyPreset(preset.value as SequencePresetName));
  transportButton.addEventListener('click', startTransport);
  $('#resetTransport').addEventListener('click', resetTransport);
  $('#manualStep').addEventListener('click', manualStep);
  $('#randomise').addEventListener('click', rotateSequence);
  $('#audioStart').addEventListener('click', startAudio);
  $('#audioMute').addEventListener('click', toggleMute);
  $('#audioStop').addEventListener('click', stopAudio);
  $('#prev').addEventListener('click', () => { lessonIndex = Math.max(0, lessonIndex - 1); updateLesson(); });
  $('#next').addEventListener('click', () => { lessonIndex = (lessonIndex + 1) % lessons.length; updateLesson(); });
  $('#learnTab').addEventListener('click', () => { $('#lesson').removeAttribute('hidden'); $('#learnTab').classList.add('active'); $('#exploreTab').classList.remove('active'); });
  $('#exploreTab').addEventListener('click', () => { $('#lesson').setAttribute('hidden', ''); $('#exploreTab').classList.add('active'); $('#learnTab').classList.remove('active'); });

  renderStepEditors();
  updateLesson();
  updateButtons();
  updateControlReadouts();
  drawSequence();
  drawHistory();
  animationFrame = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(animationFrame);
    void stopAudio();
  };
}
