import {
  NOTE_NAMES,
  SCALE_LABELS,
  allowedPitchClasses,
  clamp,
  correctionCents,
  noteNameFromVoltage,
  quantizeVoltage,
  semitoneVoltage,
  sweepVoltage,
  triggerHeldVoltage,
  voltageToFrequency,
  type ScaleName,
} from '../../../packages/quantizer-model/src/index';

const HISTORY_LENGTH = 240;
const HISTORY_INTERVAL_MS = 40;

const lessons = [
  ['Continuous voltage becomes steps', 'Turn on Automatic CV sweep. The blue input moves smoothly while the gold quantized output jumps between permitted notes.'],
  ['One semitone', 'In 1 V/octave pitch control, one semitone is exactly 1/12 V: about 0.08333 V.'],
  ['One volt per octave', 'Move the input by exactly 1 V. Both raw and quantized pitches rise by one octave while retaining their note relationship.'],
  ['Choose a scale', 'Change the scale. Gold output steps can only land on notes permitted by that scale.'],
  ['Move the root', 'Change the root note. The permitted pitch classes move together while the voltage system remains 1 V/octave.'],
  ['Nearest permitted note', 'Move the input slowly. The correction readout shows how far the quantizer moves the voltage to reach the nearest allowed note.'],
  ['Trigger and hold', 'Choose Triggered update. The input continues moving, but output changes only when a manual or clock trigger arrives.'],
  ['Compare by ear', 'Start audio and switch between Unquantized, Quantized and Both. Listen for smooth motion versus musical steps.'],
] as const;

type HistoryPoint = {
  input: number;
  output: number;
  triggered: boolean;
};

export function mountQuantizer(root: HTMLElement) {
  const rootOptions = NOTE_NAMES.map((name, index) => `<option value="${index}">${name}</option>`).join('');
  const scaleOptions = (Object.keys(SCALE_LABELS) as ScaleName[])
    .map((name) => `<option value="${name}">${SCALE_LABELS[name]}</option>`)
    .join('');

  root.innerHTML = `<section class="module-header"><div><p class="eyebrow">Module 04 · pitch selection</p><h2>Quantizer Lab</h2><p>Turn continuous control voltage into exact notes, scales and trigger-held melodic steps.</p></div><div><button id="learnTab" class="active">Learn</button> <button id="exploreTab">Explore</button></div></section><section id="lesson" class="lesson panel"><div><span id="lessonCount"></span><h3 id="lessonTitle"></h3><p id="lessonText"></p></div><div><button id="prev">Previous</button> <button id="next">Next experiment</button></div></section><section class="lab-grid"><aside class="controls panel"><h3>Quantizer</h3><label>Input CV<input id="inputCv" type="range" min="-2" max="4" step=".01" value=".37"><output id="inputCvOut"></output></label><label class="toggle-line"><input id="autoSweep" type="checkbox"> Automatic CV sweep</label><label>Sweep rate<input id="sweepRate" type="range" min=".02" max=".5" step=".01" value=".08"><output id="sweepRateOut"></output></label><label>Root note<select id="rootNote">${rootOptions}</select></label><label>Scale<select id="scale">${scaleOptions}</select></label><label>Update mode<select id="updateMode"><option value="live">Live — update immediately</option><option value="triggered">Triggered — sample and hold</option></select></label><label>Teaching clock<input id="clockBpm" type="range" min="30" max="240" step="1" value="90"><output id="clockBpmOut"></output></label><div class="button-row"><button id="clockStart">Start clock</button><button id="triggerNow">Trigger now</button></div><label>Audio comparison<select id="audioCompare"><option value="quantized">Quantized only</option><option value="raw">Unquantized only</option><option value="both">Both · raw left / quantized right</option></select></label><label>Volume<input id="volume" type="range" min="0" max=".12" step=".005" value=".035"><output id="volumeOut"></output></label><div class="button-row"><button id="audioStart" class="primary">Start audio</button><button id="audioMute">Mute</button><button id="audioStop">Panic / stop</button><button id="reset">Reset</button></div></aside><main class="workbench"><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Continuous input · stepped output</p><h3>Voltage history</h3></div><div class="readouts"><span>Input voltage<b id="inputReadout"></b></span><span>Quantized voltage<b id="outputReadout"></b></span><span>Correction<b id="correctionReadout"></b></span><span>Step size<b>0.08333 V</b></span></div></div><canvas id="historyCanvas" width="1100" height="390"></canvas><p class="scope-legend"><span class="raw-key">Blue: continuous input</span><span class="quantized-key">Gold: quantized output</span><span>Vertical marks: triggers</span></p></section><section class="panel quantizer-notes"><div class="scope-heading"><div><p class="eyebrow">Permitted pitch classes</p><h3 id="scaleHeading"></h3></div><div class="readouts"><span>Input pitch<b id="inputPitch"></b></span><span>Output pitch<b id="outputPitch"></b></span><span>Update status<b id="updateStatus"></b></span><span>Audio status<b id="audioStatus">Stopped</b></span></div></div><div id="noteGrid" class="note-grid" aria-label="Notes allowed by the selected scale"></div></section><section class="panel quantizer-path"><p class="eyebrow">Signal path</p><div class="path-flow"><div><small>Continuous CV</small><b id="pathInput"></b></div><span>→</span><div><small>Nearest scale note</small><b id="pathRule"></b></div><span>→</span><div><small>1 V/oct output</small><b id="pathOutput"></b></div></div><div class="clock-indicator"><span id="clockLamp" aria-hidden="true"></span><b id="clockStatus">Clock stopped</b></div></section><section class="explanation panel"><p class="eyebrow">What changed?</p><h3 id="explainTitle">Continuous becomes musical</h3><p id="explainText"></p></section></main></section>`;

  const $ = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  };

  const inputCv = $<HTMLInputElement>('#inputCv');
  const autoSweep = $<HTMLInputElement>('#autoSweep');
  const sweepRate = $<HTMLInputElement>('#sweepRate');
  const rootNote = $<HTMLSelectElement>('#rootNote');
  const scale = $<HTMLSelectElement>('#scale');
  const updateMode = $<HTMLSelectElement>('#updateMode');
  const clockBpm = $<HTMLInputElement>('#clockBpm');
  const audioCompare = $<HTMLSelectElement>('#audioCompare');
  const volume = $<HTMLInputElement>('#volume');
  const historyCanvas = $<HTMLCanvasElement>('#historyCanvas');
  const historyContext = historyCanvas.getContext('2d');
  if (!historyContext) throw new Error('Canvas unavailable');

  let lessonIndex = 0;
  let animationFrame = 0;
  let startedAt = performance.now();
  let lastHistoryAt = 0;
  let lastClockAt = 0;
  let clockRunning = false;
  let triggerFlashUntil = 0;
  let triggerPending = false;
  let history: HistoryPoint[] = [];
  let heldOutput = quantizeVoltage(Number(inputCv.value), Number(rootNote.value), scale.value as ScaleName);
  let muted = false;

  let audio: AudioContext | null = null;
  let rawOscillator: OscillatorNode | null = null;
  let quantizedOscillator: OscillatorNode | null = null;
  let rawGain: GainNode | null = null;
  let quantizedGain: GainNode | null = null;
  let masterGain: GainNode | null = null;

  const elapsed = () => Math.max(0, (performance.now() - startedAt) / 1000);
  const currentRoot = () => Number(rootNote.value);
  const currentScale = () => scale.value as ScaleName;
  const isTriggeredMode = () => updateMode.value === 'triggered';

  function currentInputVoltage() {
    if (!autoSweep.checked) return Number(inputCv.value);
    const value = sweepVoltage(elapsed(), -2, 4, Number(sweepRate.value));
    inputCv.value = value.toFixed(3);
    return value;
  }

  function currentOutputVoltage(input = currentInputVoltage()) {
    if (isTriggeredMode()) return heldOutput;
    return quantizeVoltage(input, currentRoot(), currentScale());
  }

  function trigger() {
    const input = currentInputVoltage();
    heldOutput = triggerHeldVoltage(input, heldOutput, true, currentRoot(), currentScale());
    triggerPending = true;
    triggerFlashUntil = performance.now() + 140;
    applyAudio();
  }

  function updateAllowedNotes() {
    const allowed = new Set(allowedPitchClasses(currentRoot(), currentScale()));
    const rootClass = currentRoot();
    $<HTMLElement>('#noteGrid').innerHTML = NOTE_NAMES.map((name, index) => {
      const classes = ['note-cell'];
      if (allowed.has(index)) classes.push('allowed');
      if (index === rootClass) classes.push('root-note');
      return `<span class="${classes.join(' ')}"><b>${name}</b><small>${allowed.has(index) ? 'allowed' : 'blocked'}</small></span>`;
    }).join('');
    $<HTMLElement>('#scaleHeading').textContent = `${NOTE_NAMES[rootClass]} ${SCALE_LABELS[currentScale()]}`;
  }

  function sampleHistory(now: number, input: number, output: number) {
    if (now - lastHistoryAt < HISTORY_INTERVAL_MS) return;
    lastHistoryAt = now;
    history.push({ input, output, triggered: triggerPending });
    triggerPending = false;
    if (history.length > HISTORY_LENGTH) history = history.slice(history.length - HISTORY_LENGTH);
  }

  function voltageY(voltage: number) {
    const top = 24;
    const bottom = historyCanvas.height - 38;
    return bottom - ((clamp(voltage, -2, 4) + 2) / 6) * (bottom - top);
  }

  function drawHistory() {
    const context = historyContext;
    const width = historyCanvas.width;
    const height = historyCanvas.height;
    const left = 55;
    const right = width - 20;
    const top = 24;
    const bottom = height - 38;
    const plotWidth = right - left;

    context.fillStyle = '#101821';
    context.fillRect(0, 0, width, height);
    context.font = '12px system-ui';

    for (let volts = -2; volts <= 4; volts += 1) {
      const y = voltageY(volts);
      context.strokeStyle = volts === 0 ? '#526371' : '#263944';
      context.lineWidth = volts === 0 ? 1.5 : 1;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
      context.fillStyle = '#9aacb7';
      context.fillText(`${volts >= 0 ? '+' : ''}${volts} V`, 7, y + 4);
    }

    for (let tick = 0; tick <= 4; tick += 1) {
      const x = left + (tick / 4) * plotWidth;
      context.strokeStyle = '#21313b';
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, bottom);
      context.stroke();
      context.fillStyle = '#82939e';
      const seconds = ((HISTORY_LENGTH * HISTORY_INTERVAL_MS) / 1000) * (1 - tick / 4);
      context.fillText(tick === 4 ? 'now' : `−${seconds.toFixed(1)} s`, x - 17, height - 12);
    }

    if (history.length < 2) return;
    const pointX = (index: number) => left + (index / (HISTORY_LENGTH - 1)) * plotWidth;
    const padding = HISTORY_LENGTH - history.length;

    history.forEach((point, index) => {
      if (!point.triggered) return;
      const x = pointX(index + padding);
      context.strokeStyle = 'rgba(244, 201, 107, .35)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, bottom);
      context.stroke();
    });

    context.strokeStyle = '#79c8ff';
    context.lineWidth = 2.5;
    context.beginPath();
    history.forEach((point, index) => {
      const x = pointX(index + padding);
      const y = voltageY(point.input);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();

    context.strokeStyle = '#f4c96b';
    context.lineWidth = 3;
    context.beginPath();
    history.forEach((point, index) => {
      const x = pointX(index + padding);
      const y = voltageY(point.output);
      if (index === 0) {
        context.moveTo(x, y);
        return;
      }
      const previousY = voltageY(history[index - 1].output);
      context.lineTo(x, previousY);
      context.lineTo(x, y);
    });
    context.stroke();
  }

  function renderReadouts(input: number, output: number) {
    const correction = correctionCents(input, output);
    const inputFrequency = voltageToFrequency(input);
    const outputFrequency = voltageToFrequency(output);
    const signedCorrection = `${correction >= 0 ? '+' : ''}${correction.toFixed(1)} cents`;

    $<HTMLOutputElement>('#inputCvOut').value = `${input >= 0 ? '+' : ''}${input.toFixed(3)} V`;
    $<HTMLOutputElement>('#sweepRateOut').value = `${Number(sweepRate.value).toFixed(2)} cycles/s`;
    $<HTMLOutputElement>('#clockBpmOut').value = `${clockBpm.value} BPM`;
    $<HTMLOutputElement>('#volumeOut').value = `${Math.round(Number(volume.value) / 0.12 * 100)}%`;
    $<HTMLElement>('#inputReadout').textContent = `${input >= 0 ? '+' : ''}${input.toFixed(3)} V`;
    $<HTMLElement>('#outputReadout').textContent = `${output >= 0 ? '+' : ''}${output.toFixed(3)} V`;
    $<HTMLElement>('#correctionReadout').textContent = signedCorrection;
    $<HTMLElement>('#inputPitch').textContent = `${noteNameFromVoltage(input)} · ${inputFrequency.toFixed(1)} Hz`;
    $<HTMLElement>('#outputPitch').textContent = `${noteNameFromVoltage(output)} · ${outputFrequency.toFixed(1)} Hz`;
    $<HTMLElement>('#updateStatus').textContent = isTriggeredMode() ? 'Waiting for triggers' : 'Live tracking';
    $<HTMLElement>('#pathInput').textContent = `${input.toFixed(3)} V`;
    $<HTMLElement>('#pathRule').textContent = `${NOTE_NAMES[currentRoot()]} ${SCALE_LABELS[currentScale()]}`;
    $<HTMLElement>('#pathOutput').textContent = `${noteNameFromVoltage(output)} · ${output.toFixed(3)} V`;
    $<HTMLElement>('#clockStatus').textContent = clockRunning ? `${clockBpm.value} BPM · running` : 'Clock stopped';
    $<HTMLElement>('#clockLamp').classList.toggle('on', performance.now() < triggerFlashUntil);

    $<HTMLElement>('#explainTitle').textContent = isTriggeredMode() ? 'The quantizer is also holding' : 'The nearest permitted note';
    $<HTMLElement>('#explainText').textContent = isTriggeredMode()
      ? `The continuous input is ${input.toFixed(3)} V, but the output remains at ${output.toFixed(3)} V until a trigger samples the input. Every held output still belongs to ${NOTE_NAMES[currentRoot()]} ${SCALE_LABELS[currentScale()]}.`
      : `The input is moved ${Math.abs(correction).toFixed(1)} cents ${correction < 0 ? 'down' : correction > 0 ? 'up' : ''} to ${noteNameFromVoltage(output)}. The output remains exact 1 V/octave control voltage.`;
  }

  function applyAudio(input = currentInputVoltage(), output = currentOutputVoltage(input)) {
    if (!audio || !rawOscillator || !quantizedOscillator || !rawGain || !quantizedGain || !masterGain) return;
    const now = audio.currentTime;
    rawOscillator.frequency.setTargetAtTime(clamp(voltageToFrequency(input), 20, 18000), now, 0.015);
    quantizedOscillator.frequency.setTargetAtTime(clamp(voltageToFrequency(output), 20, 18000), now, 0.015);

    const level = Number(volume.value);
    const comparison = audioCompare.value;
    rawGain.gain.setTargetAtTime(comparison === 'raw' ? level : comparison === 'both' ? level * 0.48 : 0, now, 0.02);
    quantizedGain.gain.setTargetAtTime(comparison === 'quantized' ? level : comparison === 'both' ? level * 0.48 : 0, now, 0.02);
    masterGain.gain.setTargetAtTime(muted ? 0 : 1, now, 0.02);
  }

  function processClock(now: number) {
    if (!clockRunning || !isTriggeredMode()) return;
    const periodMs = 60000 / Number(clockBpm.value);
    if (lastClockAt === 0) lastClockAt = now;
    if (now - lastClockAt >= periodMs) {
      lastClockAt = now;
      trigger();
    }
  }

  function animate(now: number) {
    const input = currentInputVoltage();
    processClock(now);
    const output = currentOutputVoltage(input);
    sampleHistory(now, input, output);
    renderReadouts(input, output);
    drawHistory();
    applyAudio(input, output);
    animationFrame = requestAnimationFrame(animate);
  }

  async function startAudio() {
    if (!audio) {
      audio = new AudioContext();
      rawOscillator = audio.createOscillator();
      quantizedOscillator = audio.createOscillator();
      rawGain = audio.createGain();
      quantizedGain = audio.createGain();
      masterGain = audio.createGain();
      const rawPan = audio.createStereoPanner();
      const quantizedPan = audio.createStereoPanner();
      rawOscillator.type = 'sine';
      quantizedOscillator.type = 'triangle';
      rawPan.pan.value = -0.65;
      quantizedPan.pan.value = 0.65;
      rawGain.gain.value = 0;
      quantizedGain.gain.value = 0;
      masterGain.gain.value = 0;
      rawOscillator.connect(rawGain).connect(rawPan).connect(masterGain);
      quantizedOscillator.connect(quantizedGain).connect(quantizedPan).connect(masterGain);
      masterGain.connect(audio.destination);
      rawOscillator.start();
      quantizedOscillator.start();
    }
    if (audio.state === 'suspended') await audio.resume();
    applyAudio();
    $<HTMLElement>('#audioStatus').textContent = 'Running';
  }

  async function stopAudio() {
    for (const oscillator of [rawOscillator, quantizedOscillator]) {
      if (!oscillator) continue;
      try {
        oscillator.stop();
      } catch {
        // The oscillator may already have stopped.
      }
      oscillator.disconnect();
    }
    rawGain?.disconnect();
    quantizedGain?.disconnect();
    masterGain?.disconnect();
    if (audio) await audio.close();
    audio = null;
    rawOscillator = null;
    quantizedOscillator = null;
    rawGain = null;
    quantizedGain = null;
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
    inputCv.value = '.37';
    autoSweep.checked = false;
    sweepRate.value = '.08';
    rootNote.value = '0';
    scale.value = 'major';
    updateMode.value = 'live';
    clockBpm.value = '90';
    audioCompare.value = 'quantized';
    volume.value = '.035';
    clockRunning = false;
    lastClockAt = 0;
    heldOutput = quantizeVoltage(Number(inputCv.value), currentRoot(), currentScale());
    history = [];
    muted = false;
    startedAt = performance.now();
    $<HTMLButtonElement>('#clockStart').textContent = 'Start clock';
    $<HTMLButtonElement>('#audioMute').textContent = 'Mute';
    updateAllowedNotes();
    applyAudio();
  }

  inputCv.addEventListener('input', () => {
    autoSweep.checked = false;
    if (!isTriggeredMode()) heldOutput = quantizeVoltage(Number(inputCv.value), currentRoot(), currentScale());
  });
  autoSweep.addEventListener('change', () => {
    startedAt = performance.now();
  });
  rootNote.addEventListener('change', updateAllowedNotes);
  scale.addEventListener('change', updateAllowedNotes);
  updateMode.addEventListener('change', () => {
    heldOutput = quantizeVoltage(currentInputVoltage(), currentRoot(), currentScale());
    if (!isTriggeredMode()) {
      clockRunning = false;
      $<HTMLButtonElement>('#clockStart').textContent = 'Start clock';
    }
  });
  $<HTMLButtonElement>('#clockStart').onclick = () => {
    if (!isTriggeredMode()) {
      updateMode.value = 'triggered';
      heldOutput = quantizeVoltage(currentInputVoltage(), currentRoot(), currentScale());
    }
    clockRunning = !clockRunning;
    lastClockAt = performance.now();
    $<HTMLButtonElement>('#clockStart').textContent = clockRunning ? 'Stop clock' : 'Start clock';
  };
  $<HTMLButtonElement>('#triggerNow').onclick = () => {
    if (!isTriggeredMode()) updateMode.value = 'triggered';
    trigger();
  };
  audioCompare.addEventListener('change', () => applyAudio());
  volume.addEventListener('input', () => applyAudio());
  $<HTMLButtonElement>('#audioStart').onclick = startAudio;
  $<HTMLButtonElement>('#audioStop').onclick = stopAudio;
  $<HTMLButtonElement>('#audioMute').onclick = () => {
    muted = !muted;
    $<HTMLButtonElement>('#audioMute').textContent = muted ? 'Unmute' : 'Mute';
    applyAudio();
  };
  $<HTMLButtonElement>('#reset').onclick = reset;
  $<HTMLButtonElement>('#prev').onclick = () => lesson(lessonIndex - 1);
  $<HTMLButtonElement>('#next').onclick = () => lesson(lessonIndex + 1);
  $<HTMLButtonElement>('#learnTab').onclick = () => {
    $<HTMLElement>('#lesson').hidden = false;
    $<HTMLButtonElement>('#learnTab').classList.add('active');
    $<HTMLButtonElement>('#exploreTab').classList.remove('active');
  };
  $<HTMLButtonElement>('#exploreTab').onclick = () => {
    $<HTMLElement>('#lesson').hidden = true;
    $<HTMLButtonElement>('#exploreTab').classList.add('active');
    $<HTMLButtonElement>('#learnTab').classList.remove('active');
  };

  updateAllowedNotes();
  lesson(0);
  history.push({ input: Number(inputCv.value), output: heldOutput, triggered: false });
  animationFrame = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(animationFrame);
    void stopAudio();
  };
}
