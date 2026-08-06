import {
  cycleDurationMs,
  degreesToCycles,
  destinationState,
  formatFrequency,
  lfoVoltage,
  wrapPhase,
  type DestinationAmounts,
  type LfoShape,
} from '../../../packages/lfo-modulation-model/src/index';

const HISTORY_LENGTH = 280;
const HISTORY_INTERVAL_MS = 40;

const lessons = [
  ['An LFO is a repeating control voltage', 'Watch the moving dot on the stationary source wave. Rate changes how quickly the dot completes each cycle.'],
  ['Shape changes the movement', 'Compare sine, triangle, square and saw shapes. The same voltage range can move smoothly, linearly or suddenly.'],
  ['Depth sets the distance', 'Raise and lower amplitude. The waveform grows away from its centre without changing its rate.'],
  ['Offset moves the centre', 'Move DC offset. The entire waveform shifts upward or downward before the safe ±5 V clamp is applied.'],
  ['Phase changes where the cycle begins', 'Move phase or press Reset phase. Phase changes timing without changing shape, depth or rate.'],
  ['An attenuverter scales and reverses', 'Move a destination amount through zero. Positive follows the source, zero removes the route and negative reverses it.'],
  ['One source can control several destinations', 'Choose Multi-route motion. Pitch, cutoff, loudness and pan all follow the same LFO with independent amounts.'],
  ['Modulation becomes sound', 'Start audio and compare Unmodulated, Modulated and Both. The readouts show the voltage reaching each destination.'],
] as const;

type HistoryPoint = {
  sourceVoltage: number;
  pitchCv: number;
  cutoffCv: number;
  gain: number;
  pan: number;
  clipped: boolean;
};

type CurrentValues = {
  source: ReturnType<typeof lfoVoltage>;
  destinations: ReturnType<typeof destinationState>;
  effectivePhase: number;
};

export function mountLfoModulation(root: HTMLElement) {
  root.innerHTML = `<section class="module-header"><div><p class="eyebrow">Module 09 · periodic control voltage</p><h2>LFO & Modulation Lab</h2><p>Shape one repeating voltage, then route it independently to pitch, filter cutoff, loudness and stereo position.</p></div><div><button id="learnTab" class="active">Learn</button> <button id="exploreTab">Explore</button></div></section><section id="lesson" class="lesson panel"><div><span id="lessonCount"></span><h3 id="lessonTitle"></h3><p id="lessonText"></p></div><div><button id="prev">Previous</button> <button id="next">Next experiment</button></div></section><section class="lab-grid lfo-lab-grid"><aside class="controls panel"><h3>LFO source</h3><label>Shape<select id="shape"><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="saw-up">Rising saw</option><option value="saw-down">Falling saw</option><option value="stepped-random">Stepped random</option></select></label><label>Rate<input id="rate" type="range" min=".05" max="20" step=".05" value=".5"><output id="rateOut">0.50 Hz</output></label><label>Cycle duration<output id="durationOut">2.00 s</output></label><label>Amplitude<input id="amplitude" type="range" min="0" max="5" step=".01" value="2.5"><output id="amplitudeOut">2.50 V</output></label><label>DC offset<input id="offset" type="range" min="-5" max="5" step=".01" value="0"><output id="offsetOut">0.00 V</output></label><label>Phase<input id="phase" type="range" min="-180" max="180" step="1" value="0"><output id="phaseOut">0°</output></label><label>Random seed<input id="seed" type="range" min="1" max="32" step="1" value="7"><output id="seedOut">7</output></label><div class="button-row"><button id="phaseReset" class="primary">Reset phase</button><button id="runPause">Pause LFO</button></div><h3>Destination attenuverters</h3><label>Pitch amount<input id="pitchAmount" type="range" min="-1" max="1" step=".005" value=".025"><output id="pitchAmountOut">+2.5%</output></label><label>Filter amount<input id="cutoffAmount" type="range" min="-1" max="1" step=".01" value=".55"><output id="cutoffAmountOut">+55%</output></label><label>VCA amount<input id="gainAmount" type="range" min="-1" max="1" step=".01" value="0"><output id="gainAmountOut">0%</output></label><label>Pan amount<input id="panAmount" type="range" min="-1" max="1" step=".01" value="0"><output id="panAmountOut">0%</output></label><h3>Base patch</h3><label>Oscillator waveform<select id="oscillatorWave"><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sine">Sine</option></select></label><label>Base pitch<input id="basePitch" type="range" min="55" max="880" step="1" value="220"><output id="basePitchOut">220 Hz</output></label><label>Base cutoff<input id="baseCutoff" type="range" min="80" max="8000" step="10" value="1200"><output id="baseCutoffOut">1.20 kHz</output></label><label>Resonance<input id="resonance" type="range" min=".5" max="18" step=".1" value="2"><output id="resonanceOut">Q 2.0</output></label><label>Base gain<input id="baseGain" type="range" min="0" max="1" step=".01" value=".45"><output id="baseGainOut">45%</output></label><label>Base pan<input id="basePan" type="range" min="-1" max="1" step=".01" value="0"><output id="basePanOut">Centre</output></label><h3>Teaching presets</h3><div class="preset-grid"><button id="vibratoPreset">Vibrato</button><button id="tremoloPreset">Tremolo</button><button id="filterPreset">Filter sweep</button><button id="panPreset">Auto-pan</button><button id="multiPreset">Multi-route</button></div><h3>Audio comparison</h3><fieldset><legend>Listen to</legend><label><input type="radio" name="lfoAudioMode" value="dry"> Unmodulated</label><label><input type="radio" name="lfoAudioMode" value="modulated" checked> Modulated</label><label><input type="radio" name="lfoAudioMode" value="both"> Both · dry left, modulated right</label></fieldset><label>Safety volume<input id="volume" type="range" min="0" max=".12" step=".005" value=".045"><output id="volumeOut">38%</output></label><div class="button-row"><button id="audioStart" class="primary">Start audio</button><button id="audioMute">Mute</button><button id="audioStop">Panic / stop</button></div></aside><main class="workbench"><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Stationary LFO view</p><h3>Two cycles of control voltage</h3></div><div class="readouts"><span>Wave value<b id="waveReadout">0.00</b></span><span>Raw voltage<b id="rawVoltageReadout">0.00 V</b></span><span>Output voltage<b id="sourceVoltageReadout">0.00 V</b></span><span id="clampReadout" class="clamp-readout">Safe clamp<b>Inactive</b></span></div></div><canvas id="sourceCanvas" width="1100" height="430"></canvas><p class="scope-legend"><span class="raw-key">Blue: voltage before clamp</span><span class="quantized-key">Gold: safe output</span><span>Moving dot: current phase</span></p></section><section class="panel routing-panel"><div class="scope-heading"><div><p class="eyebrow">Four simultaneous routes</p><h3>One voltage, four independent destinations</h3></div><div class="readouts"><span>Phase position<b id="phaseReadout">0°</b></span><span>Cycle duration<b id="cycleReadout">2.00 s</b></span><span>Audio<b id="audioReadout">Stopped</b></span></div></div><div class="routing-cards"><article class="route-card" id="pitchCard"><small>Oscillator pitch</small><b id="pitchCvReadout">0.00 V</b><strong id="pitchReadout">220 Hz</strong><span id="pitchSemitoneReadout">0.00 semitones</span></article><article class="route-card" id="cutoffCard"><small>Filter cutoff</small><b id="cutoffCvReadout">0.00 V</b><strong id="cutoffReadout">1.20 kHz</strong><span>Exact 1 V/oct</span></article><article class="route-card" id="gainCard"><small>VCA loudness</small><b id="gainCvReadout">0.00 V</b><strong id="gainReadout">45%</strong><span>Clamped 0–100%</span></article><article class="route-card" id="panCard"><small>Stereo pan</small><b id="panCvReadout">0.00 V</b><strong id="panReadout">Centre</strong><span>Clamped left–right</span></article></div></section><section class="panel modulation-path-panel"><p class="eyebrow">Live modulation path</p><h3>The source is copied, then scaled separately</h3><div class="modulation-path"><div class="source-node"><small>LFO source</small><b id="pathSource">0.00 V</b></div><span>↗</span><div><small>Pitch attenuverter</small><b id="pathPitch">+2.5%</b></div><span>→</span><div><small>Pitch</small><b id="pathPitchResult">220 Hz</b></div><span>↗</span><div><small>Filter attenuverter</small><b id="pathFilter">+55%</b></div><span>→</span><div><small>Cutoff</small><b id="pathFilterResult">1.20 kHz</b></div><span>↘</span><div><small>VCA attenuverter</small><b id="pathGain">0%</b></div><span>→</span><div><small>Gain</small><b id="pathGainResult">45%</b></div><span>↘</span><div><small>Pan attenuverter</small><b id="pathPan">0%</b></div><span>→</span><div><small>Pan</small><b id="pathPanResult">Centre</b></div></div></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Live destination history</p><h3>How each route moves over time</h3></div><div class="readouts"><span>Running<b id="runningReadout">Yes</b></span><span>Shape<b id="shapeReadout">Sine</b></span></div></div><canvas id="historyCanvas" width="1100" height="500"></canvas><p class="scope-legend"><span class="raw-key">Blue: source and pitch</span><span class="quantized-key">Gold: cutoff</span><span class="envelope-key">Green: gain</span><span class="pan-key">Purple: pan</span></p></section><section class="explanation panel"><p class="eyebrow">What is happening?</p><h3 id="explainTitle">The LFO is moving pitch and cutoff</h3><p id="explainText">The same source voltage is copied to each attenuverter. Every route can scale, remove or invert that movement without changing the source.</p></section></main></section>`;

  const $ = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  };

  const shape = $<HTMLSelectElement>('#shape');
  const rate = $<HTMLInputElement>('#rate');
  const amplitude = $<HTMLInputElement>('#amplitude');
  const offset = $<HTMLInputElement>('#offset');
  const phase = $<HTMLInputElement>('#phase');
  const seed = $<HTMLInputElement>('#seed');
  const pitchAmount = $<HTMLInputElement>('#pitchAmount');
  const cutoffAmount = $<HTMLInputElement>('#cutoffAmount');
  const gainAmount = $<HTMLInputElement>('#gainAmount');
  const panAmount = $<HTMLInputElement>('#panAmount');
  const oscillatorWave = $<HTMLSelectElement>('#oscillatorWave');
  const basePitch = $<HTMLInputElement>('#basePitch');
  const baseCutoff = $<HTMLInputElement>('#baseCutoff');
  const resonance = $<HTMLInputElement>('#resonance');
  const baseGain = $<HTMLInputElement>('#baseGain');
  const basePan = $<HTMLInputElement>('#basePan');
  const volume = $<HTMLInputElement>('#volume');
  const sourceCanvas = $<HTMLCanvasElement>('#sourceCanvas');
  const historyCanvas = $<HTMLCanvasElement>('#historyCanvas');
  const sourceContext = sourceCanvas.getContext('2d');
  const historyContext = historyCanvas.getContext('2d');
  if (!sourceContext || !historyContext) throw new Error('Canvas unavailable');

  let lessonIndex = 0;
  let animationFrame = 0;
  let phaseCycles = 0;
  let lastFrameAt = performance.now();
  let lastHistoryAt = 0;
  let history: HistoryPoint[] = [];
  let running = true;
  let muted = false;

  let audio: AudioContext | null = null;
  let dryOscillator: OscillatorNode | null = null;
  let modOscillator: OscillatorNode | null = null;
  let dryFilter: BiquadFilterNode | null = null;
  let modFilter: BiquadFilterNode | null = null;
  let dryAmplitude: GainNode | null = null;
  let modAmplitude: GainNode | null = null;
  let dryPanner: StereoPannerNode | null = null;
  let modPanner: StereoPannerNode | null = null;
  let dryOutput: GainNode | null = null;
  let modOutput: GainNode | null = null;
  let masterGain: GainNode | null = null;

  function shapeName(value: LfoShape) {
    return ({
      sine: 'Sine',
      triangle: 'Triangle',
      square: 'Square',
      'saw-up': 'Rising saw',
      'saw-down': 'Falling saw',
      'stepped-random': 'Stepped random',
    })[value];
  }

  function amountText(value: number) {
    if (Math.abs(value) < .0001) return '0%';
    return `${value > 0 ? '+' : ''}${(value * 100).toFixed(Math.abs(value) < .1 ? 1 : 0)}%`;
  }

  function signedVoltage(value: number) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)} V`;
  }

  function panText(value: number) {
    if (Math.abs(value) < .015) return 'Centre';
    return value < 0 ? `${Math.round(Math.abs(value) * 100)}% left` : `${Math.round(value * 100)}% right`;
  }

  function selectedAudioMode() {
    return root.querySelector<HTMLInputElement>('input[name=lfoAudioMode]:checked')?.value ?? 'modulated';
  }

  function amounts(): DestinationAmounts {
    return {
      pitch: Number(pitchAmount.value),
      cutoff: Number(cutoffAmount.value),
      gain: Number(gainAmount.value),
      pan: Number(panAmount.value),
    };
  }

  function currentValues(): CurrentValues {
    const effectivePhase = phaseCycles + degreesToCycles(Number(phase.value));
    const source = lfoVoltage({
      shape: shape.value as LfoShape,
      phaseCycles: effectivePhase,
      amplitudeVoltage: Number(amplitude.value),
      offsetVoltage: Number(offset.value),
      seed: Number(seed.value),
    });
    const destinations = destinationState(source.voltage, amounts(), {
      oscillatorHz: Number(basePitch.value),
      cutoffHz: Number(baseCutoff.value),
      gain: Number(baseGain.value),
      pan: Number(basePan.value),
    });
    return { source, destinations, effectivePhase };
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

  function sourceY(voltage: number) {
    return sourceCanvas.height / 2 - voltage / 5 * sourceCanvas.height * .42;
  }

  function drawSource(values: CurrentValues) {
    const context = sourceContext;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, 8, 10);
    context.strokeStyle = '#6b7b86'; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
    for (const limit of [-5, 5]) {
      context.strokeStyle = '#8f5151'; context.setLineDash([8, 7]);
      context.beginPath(); context.moveTo(0, sourceY(limit)); context.lineTo(width, sourceY(limit)); context.stroke();
    }
    context.setLineDash([]);

    const drawTrace = (raw: boolean, stroke: string, lineWidth: number) => {
      context.strokeStyle = stroke; context.lineWidth = lineWidth; context.beginPath();
      for (let index = 0; index <= 800; index += 1) {
        const xCycles = index / 800 * 2 + degreesToCycles(Number(phase.value));
        const point = lfoVoltage({
          shape: shape.value as LfoShape,
          phaseCycles: xCycles,
          amplitudeVoltage: Number(amplitude.value),
          offsetVoltage: Number(offset.value),
          seed: Number(seed.value),
        });
        const x = index / 800 * width;
        const y = sourceY(raw ? point.rawVoltage : point.voltage);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    };
    drawTrace(true, '#79c8ff', 2);
    drawTrace(false, '#f4c96b', 4);

    const markerCycle = wrapPhase(values.effectivePhase);
    const markerX = markerCycle / 2 * width;
    const markerY = sourceY(values.source.voltage);
    context.strokeStyle = '#dfeaf0'; context.lineWidth = 1.5; context.setLineDash([5, 6]);
    context.beginPath(); context.moveTo(markerX, 0); context.lineTo(markerX, height); context.stroke();
    context.setLineDash([]);
    context.fillStyle = values.source.clipped ? '#ff7777' : '#f4c96b';
    context.beginPath(); context.arc(markerX, markerY, 9, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#dce7ed'; context.font = '17px system-ui';
    context.fillText('+5 V', 12, 24);
    context.fillText('0 V', 12, height / 2 - 10);
    context.fillText('-5 V', 12, height - 12);
    context.fillText('cycle 1', width * .22, height - 12);
    context.fillText('cycle 2', width * .72, height - 12);
  }

  function drawHistory() {
    const context = historyContext;
    const width = historyCanvas.width;
    const height = historyCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821'; context.fillRect(0, 0, width, height);
    drawGrid(context, width, height, 8, 10);
    const laneHeight = height / 5;
    for (let lane = 1; lane < 5; lane += 1) {
      context.strokeStyle = '#40515d'; context.lineWidth = 1.5;
      context.beginPath(); context.moveTo(0, lane * laneHeight); context.lineTo(width, lane * laneHeight); context.stroke();
    }
    const draw = (valueAt: (point: HistoryPoint) => number, lane: number, stroke: string) => {
      const centre = lane * laneHeight + laneHeight / 2;
      const amplitudePx = laneHeight * .38;
      context.strokeStyle = stroke; context.lineWidth = 3; context.beginPath();
      history.forEach((point, index) => {
        const x = history.length <= 1 ? width : index / (HISTORY_LENGTH - 1) * width;
        const y = centre - Math.max(-1, Math.min(1, valueAt(point))) * amplitudePx;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    };
    draw((point) => point.sourceVoltage / 5, 0, '#79c8ff');
    draw((point) => point.pitchCv / 5, 1, '#79c8ff');
    draw((point) => point.cutoffCv / 5, 2, '#f4c96b');
    draw((point) => point.gain * 2 - 1, 3, '#72e0aa');
    draw((point) => point.pan, 4, '#c796ff');
    context.fillStyle = '#d8e3e9'; context.font = '16px system-ui';
    ['SOURCE ±5 V', 'PITCH CV ±5 V', 'CUTOFF CV ±5 V', 'GAIN 0–1', 'PAN L–R'].forEach((label, index) => {
      context.fillText(label, 12, index * laneHeight + 22);
    });
  }

  function updateOutputs(values: CurrentValues) {
    const routeAmounts = amounts();
    const phaseDegrees = wrapPhase(values.effectivePhase) * 360;
    const duration = cycleDurationMs(Number(rate.value));
    const durationText = duration >= 1000 ? `${(duration / 1000).toFixed(2)} s` : `${duration.toFixed(0)} ms`;

    $('#rateOut').textContent = `${Number(rate.value).toFixed(2)} Hz`;
    $('#durationOut').textContent = durationText;
    $('#amplitudeOut').textContent = `${Number(amplitude.value).toFixed(2)} V`;
    $('#offsetOut').textContent = signedVoltage(Number(offset.value));
    $('#phaseOut').textContent = `${Number(phase.value)}°`;
    $('#seedOut').textContent = seed.value;
    $('#pitchAmountOut').textContent = amountText(routeAmounts.pitch);
    $('#cutoffAmountOut').textContent = amountText(routeAmounts.cutoff);
    $('#gainAmountOut').textContent = amountText(routeAmounts.gain);
    $('#panAmountOut').textContent = amountText(routeAmounts.pan);
    $('#basePitchOut').textContent = formatFrequency(Number(basePitch.value));
    $('#baseCutoffOut').textContent = formatFrequency(Number(baseCutoff.value));
    $('#resonanceOut').textContent = `Q ${Number(resonance.value).toFixed(1)}`;
    $('#baseGainOut').textContent = `${Math.round(Number(baseGain.value) * 100)}%`;
    $('#basePanOut').textContent = panText(Number(basePan.value));
    $('#volumeOut').textContent = `${Math.round(Number(volume.value) / .12 * 100)}%`;

    $('#waveReadout').textContent = values.source.waveform.toFixed(2);
    $('#rawVoltageReadout').textContent = signedVoltage(values.source.rawVoltage);
    $('#sourceVoltageReadout').textContent = signedVoltage(values.source.voltage);
    $('#clampReadout b').textContent = values.source.clipped ? 'Active' : 'Inactive';
    $('#clampReadout').classList.toggle('clipping', values.source.clipped);
    $('#phaseReadout').textContent = `${phaseDegrees.toFixed(0)}°`;
    $('#cycleReadout').textContent = durationText;
    $('#runningReadout').textContent = running ? 'Yes' : 'Paused';
    $('#shapeReadout').textContent = shapeName(shape.value as LfoShape);
    $('#audioReadout').textContent = audio ? (muted ? 'Muted' : 'Running') : 'Stopped';

    $('#pitchCvReadout').textContent = signedVoltage(values.destinations.pitchCv);
    $('#pitchReadout').textContent = formatFrequency(values.destinations.oscillatorHz);
    $('#pitchSemitoneReadout').textContent = `${values.destinations.pitchSemitones >= 0 ? '+' : ''}${values.destinations.pitchSemitones.toFixed(2)} semitones`;
    $('#cutoffCvReadout').textContent = signedVoltage(values.destinations.cutoffCv);
    $('#cutoffReadout').textContent = formatFrequency(values.destinations.cutoffHz);
    $('#gainCvReadout').textContent = signedVoltage(values.destinations.gainCv);
    $('#gainReadout').textContent = `${Math.round(values.destinations.gain * 100)}%`;
    $('#panCvReadout').textContent = signedVoltage(values.destinations.panCv);
    $('#panReadout').textContent = panText(values.destinations.pan);

    $('#pathSource').textContent = signedVoltage(values.source.voltage);
    $('#pathPitch').textContent = amountText(routeAmounts.pitch);
    $('#pathPitchResult').textContent = formatFrequency(values.destinations.oscillatorHz);
    $('#pathFilter').textContent = amountText(routeAmounts.cutoff);
    $('#pathFilterResult').textContent = formatFrequency(values.destinations.cutoffHz);
    $('#pathGain').textContent = amountText(routeAmounts.gain);
    $('#pathGainResult').textContent = `${Math.round(values.destinations.gain * 100)}%`;
    $('#pathPan').textContent = amountText(routeAmounts.pan);
    $('#pathPanResult').textContent = panText(values.destinations.pan);

    const activeRoutes = Object.values(routeAmounts).filter((amount) => Math.abs(amount) > .0001).length;
    if (values.source.clipped) {
      $('#explainTitle').textContent = 'The source has reached the safe voltage limit';
      $('#explainText').textContent = `The raw source is ${signedVoltage(values.source.rawVoltage)}, so the output is clamped to ${signedVoltage(values.source.voltage)} before routing.`;
    } else if (activeRoutes === 0) {
      $('#explainTitle').textContent = 'The LFO has no active destinations';
      $('#explainText').textContent = 'The source is still running, but every attenuverter is at zero, so the audio patch remains at its base settings.';
    } else {
      $('#explainTitle').textContent = `${activeRoutes} destination${activeRoutes === 1 ? '' : 's'} following one LFO`;
      $('#explainText').textContent = 'Each attenuverter receives the same source voltage, then independently scales or reverses it before the destination applies its own safe range.';
    }
  }

  function applyAudio(values: CurrentValues) {
    if (!audio || !dryOscillator || !modOscillator || !dryFilter || !modFilter || !dryAmplitude || !modAmplitude || !dryPanner || !modPanner || !dryOutput || !modOutput || !masterGain) return;
    const now = audio.currentTime;
    const mode = selectedAudioMode();
    const waveform = oscillatorWave.value as OscillatorType;
    dryOscillator.type = waveform;
    modOscillator.type = waveform;
    dryOscillator.frequency.setTargetAtTime(Number(basePitch.value), now, .015);
    modOscillator.frequency.setTargetAtTime(values.destinations.oscillatorHz, now, .015);
    dryFilter.frequency.setTargetAtTime(Number(baseCutoff.value), now, .015);
    modFilter.frequency.setTargetAtTime(values.destinations.cutoffHz, now, .015);
    dryFilter.Q.setTargetAtTime(Number(resonance.value), now, .02);
    modFilter.Q.setTargetAtTime(Number(resonance.value), now, .02);
    dryAmplitude.gain.setTargetAtTime(Number(baseGain.value), now, .015);
    modAmplitude.gain.setTargetAtTime(values.destinations.gain, now, .015);
    const both = mode === 'both';
    dryPanner.pan.setTargetAtTime(both ? -.85 : Number(basePan.value), now, .015);
    modPanner.pan.setTargetAtTime(both ? .85 : values.destinations.pan, now, .015);
    dryOutput.gain.setTargetAtTime(mode === 'dry' ? 1 : both ? .72 : 0, now, .015);
    modOutput.gain.setTargetAtTime(mode === 'modulated' ? 1 : both ? .72 : 0, now, .015);
    masterGain.gain.setTargetAtTime(muted ? 0 : Number(volume.value), now, .015);
  }

  async function startAudio() {
    if (audio) {
      await audio.resume();
      muted = false;
      return;
    }
    audio = new AudioContext();
    dryOscillator = audio.createOscillator();
    modOscillator = audio.createOscillator();
    dryFilter = audio.createBiquadFilter();
    modFilter = audio.createBiquadFilter();
    dryAmplitude = audio.createGain();
    modAmplitude = audio.createGain();
    dryPanner = audio.createStereoPanner();
    modPanner = audio.createStereoPanner();
    dryOutput = audio.createGain();
    modOutput = audio.createGain();
    masterGain = audio.createGain();
    dryFilter.type = 'lowpass';
    modFilter.type = 'lowpass';
    dryOscillator.connect(dryFilter).connect(dryAmplitude).connect(dryPanner).connect(dryOutput).connect(masterGain);
    modOscillator.connect(modFilter).connect(modAmplitude).connect(modPanner).connect(modOutput).connect(masterGain);
    masterGain.connect(audio.destination);
    const startAt = audio.currentTime + .03;
    dryOscillator.start(startAt);
    modOscillator.start(startAt);
    muted = false;
    await audio.resume();
  }

  function stopAudio() {
    for (const oscillator of [dryOscillator, modOscillator]) {
      try { oscillator?.stop(); } catch { /* already stopped */ }
    }
    void audio?.close();
    audio = null;
    dryOscillator = null;
    modOscillator = null;
    dryFilter = null;
    modFilter = null;
    dryAmplitude = null;
    modAmplitude = null;
    dryPanner = null;
    modPanner = null;
    dryOutput = null;
    modOutput = null;
    masterGain = null;
    muted = false;
  }

  function setAmounts(next: Partial<DestinationAmounts>) {
    if (next.pitch !== undefined) pitchAmount.value = String(next.pitch);
    if (next.cutoff !== undefined) cutoffAmount.value = String(next.cutoff);
    if (next.gain !== undefined) gainAmount.value = String(next.gain);
    if (next.pan !== undefined) panAmount.value = String(next.pan);
  }

  function vibratoPreset() {
    shape.value = 'sine'; rate.value = '5'; amplitude.value = '2'; offset.value = '0'; phase.value = '0';
    setAmounts({ pitch: .025, cutoff: 0, gain: 0, pan: 0 });
  }

  function tremoloPreset() {
    shape.value = 'sine'; rate.value = '4'; amplitude.value = '2.5'; offset.value = '0'; phase.value = '0'; baseGain.value = '.5';
    setAmounts({ pitch: 0, cutoff: 0, gain: 1, pan: 0 });
  }

  function filterPreset() {
    shape.value = 'triangle'; rate.value = '.35'; amplitude.value = '2'; offset.value = '0'; phase.value = '0'; baseCutoff.value = '1000';
    setAmounts({ pitch: 0, cutoff: 1, gain: 0, pan: 0 });
  }

  function panPreset() {
    shape.value = 'sine'; rate.value = '.25'; amplitude.value = '5'; offset.value = '0'; phase.value = '0'; basePan.value = '0';
    setAmounts({ pitch: 0, cutoff: 0, gain: 0, pan: 1 });
  }

  function multiPreset() {
    shape.value = 'triangle'; rate.value = '.6'; amplitude.value = '2.5'; offset.value = '0'; phase.value = '0'; baseGain.value = '.5'; basePan.value = '0';
    setAmounts({ pitch: .02, cutoff: .65, gain: .45, pan: .7 });
  }

  function renderLesson() {
    const [title, text] = lessons[lessonIndex];
    $('#lessonCount').textContent = `${lessonIndex + 1} of ${lessons.length}`;
    $('#lessonTitle').textContent = title;
    $('#lessonText').textContent = text;
  }

  function animate(now: number) {
    const elapsed = Math.min(100, Math.max(0, now - lastFrameAt));
    if (running) phaseCycles += elapsed / 1000 * Number(rate.value);
    lastFrameAt = now;
    const values = currentValues();
    if (now - lastHistoryAt >= HISTORY_INTERVAL_MS) {
      history.push({
        sourceVoltage: values.source.voltage,
        pitchCv: values.destinations.pitchCv,
        cutoffCv: values.destinations.cutoffCv,
        gain: values.destinations.gain,
        pan: values.destinations.pan,
        clipped: values.source.clipped,
      });
      if (history.length > HISTORY_LENGTH) history.shift();
      lastHistoryAt = now;
    }
    drawSource(values);
    drawHistory();
    updateOutputs(values);
    applyAudio(values);
    animationFrame = requestAnimationFrame(animate);
  }

  $('#phaseReset').addEventListener('click', () => { phaseCycles = 0; lastFrameAt = performance.now(); });
  $('#runPause').addEventListener('click', () => {
    running = !running;
    $('#runPause').textContent = running ? 'Pause LFO' : 'Resume LFO';
    lastFrameAt = performance.now();
  });
  $('#audioStart').addEventListener('click', () => { void startAudio(); });
  $('#audioMute').addEventListener('click', () => { muted = !muted; });
  $('#audioStop').addEventListener('click', stopAudio);
  $('#vibratoPreset').addEventListener('click', vibratoPreset);
  $('#tremoloPreset').addEventListener('click', tremoloPreset);
  $('#filterPreset').addEventListener('click', filterPreset);
  $('#panPreset').addEventListener('click', panPreset);
  $('#multiPreset').addEventListener('click', multiPreset);
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
    stopAudio();
  };
}
