import {
  clamp,
  frequencyFromCv,
  frequencyToNoteName,
  harmonicAmplitudes,
  outputVoltage,
  peakToPeak,
  periodMs,
  phaseAt,
  pulseWaveCoefficients,
  waveformSample,
  webAudioWaveform,
  type Waveform,
} from '../../../packages/oscillator-model/src/index';

const lessons = [
  ['What is an oscillator?', 'A repeating voltage moves through the same cycle again and again. Change frequency and watch the live playhead speed up or slow down.'],
  ['Frequency and pitch', 'Double frequency to hear one octave upward. Halve it to hear one octave downward.'],
  ['One volt per octave', 'Raise CV by exactly 1 V. Frequency doubles while the waveform shape stays the same.'],
  ['Compare waveforms', 'Sine has one harmonic. Triangle, saw and square add different harmonic patterns.'],
  ['Pulse width', 'Choose Pulse and move width. The high and low parts change length and the harmonic balance changes.'],
  ['Phase', 'Move phase. Timing position changes, but pitch and harmonic strength do not.'],
  ['Amplitude and offset', 'Amplitude changes peak-to-peak size. DC offset moves the entire waveform above or below zero.'],
  ['Harmonics', 'Compare the spectrum bars. A waveform is heard partly through the strengths of its harmonics.'],
] as const;

export function mountOscillator(root: HTMLElement) {
  root.innerHTML = `<section class="module-header"><div><p class="eyebrow">Module 03 · sound source</p><h2>Oscillator Lab</h2><p>See, measure and hear a repeating voltage become pitch, waveform and harmonics.</p></div><div><button id="learnTab" class="active">Learn</button> <button id="exploreTab">Explore</button></div></section><section id="lesson" class="lesson panel"><div><span id="lessonCount"></span><h3 id="lessonTitle"></h3><p id="lessonText"></p></div><div><button id="prev">Previous</button> <button id="next">Next experiment</button></div></section><section class="lab-grid"><aside class="controls panel"><h3>Oscillator</h3><label>Waveform<select id="wave"><option>sine</option><option>triangle</option><option>saw</option><option>square</option><option>pulse</option></select></label><label>Base frequency<input id="frequency" type="range" min="20" max="1000" step="1" value="220"><output id="frequencyOut"></output></label><label>1 V/oct CV<input id="cv" type="range" min="-3" max="3" step=".01" value="0"><output id="cvOut"></output></label><label>Coarse tune<input id="coarse" type="range" min="-3" max="3" step="1" value="0"><output id="coarseOut"></output></label><label>Fine tune<input id="fine" type="range" min="-100" max="100" step="1" value="0"><output id="fineOut"></output></label><label>Pulse width<input id="width" type="range" min=".05" max=".95" step=".01" value=".5"><output id="widthOut"></output></label><label>Phase<input id="phase" type="range" min="0" max="1" step=".01" value="0"><output id="phaseOut"></output></label><label>Amplitude<input id="amplitude" type="range" min="0" max="5" step=".1" value="2.5"><output id="amplitudeOut"></output></label><label>DC offset<input id="offset" type="range" min="-5" max="5" step=".1" value="0"><output id="offsetOut"></output></label><label>Volume<input id="volume" type="range" min="0" max=".12" step=".005" value=".035"><output id="volumeOut"></output></label><div class="button-row"><button id="audioStart" class="primary">Start audio</button><button id="audioMute">Mute</button><button id="audioStop">Panic / stop</button><button id="reset">Reset</button></div></aside><main class="workbench"><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Live time-expanded oscilloscope</p><h3>Waveform and voltage</h3></div><div class="readouts"><span>Pitch<b id="pitchReadout"></b></span><span>Period<b id="periodReadout"></b></span><span>Current voltage<b id="instantReadout"></b></span><span>Peak-to-peak<b id="ppReadout"></b></span></div></div><canvas id="waveCanvas" width="1100" height="360"></canvas></section><section class="scope panel"><div class="scope-heading"><div><p class="eyebrow">Harmonic spectrum</p><h3>Relative harmonic strength</h3></div><div class="readouts"><span>Fundamental<b id="fundamentalReadout"></b></span><span>Audio status<b id="audioStatus">Stopped</b></span></div></div><canvas id="spectrumCanvas" width="1100" height="280"></canvas></section><section class="explanation panel"><p class="eyebrow">What changed?</p><h3 id="explainTitle">A repeating voltage</h3><p id="explainText"></p></section></main></section>`;

  const $ = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  };

  const wave = $<HTMLSelectElement>('#wave');
  const frequency = $<HTMLInputElement>('#frequency');
  const cv = $<HTMLInputElement>('#cv');
  const coarse = $<HTMLInputElement>('#coarse');
  const fine = $<HTMLInputElement>('#fine');
  const width = $<HTMLInputElement>('#width');
  const phase = $<HTMLInputElement>('#phase');
  const amplitude = $<HTMLInputElement>('#amplitude');
  const offset = $<HTMLInputElement>('#offset');
  const volume = $<HTMLInputElement>('#volume');
  const waveCanvas = $<HTMLCanvasElement>('#waveCanvas');
  const spectrumCanvas = $<HTMLCanvasElement>('#spectrumCanvas');
  const waveContext = waveCanvas.getContext('2d');
  const spectrumContext = spectrumCanvas.getContext('2d');

  if (!waveContext || !spectrumContext) throw new Error('Canvas unavailable');

  let audio: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let muted = false;
  let lessonIndex = 0;
  let disposed = false;
  let animationFrame = 0;
  let visualPhase = 0;
  let previousFrameTime = performance.now();

  const type = () => wave.value as Waveform;
  const hz = () => clamp(
    frequencyFromCv(
      Number(frequency.value),
      Number(cv.value),
      Number(coarse.value),
      Number(fine.value),
    ),
    20,
    18000,
  );

  function displayCyclesPerSecond() {
    return clamp(0.45 + Math.log2(hz() / 20) * 0.24, 0.45, 2.5);
  }

  function liveVoltage(cyclePhase: number) {
    const sample = waveformSample(
      type(),
      cyclePhase + Number(phase.value),
      Number(width.value),
    );
    return outputVoltage(sample, Number(amplitude.value), Number(offset.value));
  }

  function drawWave(cyclePhase = visualPhase) {
    waveContext.fillStyle = '#101821';
    waveContext.fillRect(0, 0, waveCanvas.width, waveCanvas.height);
    waveContext.strokeStyle = '#334652';
    waveContext.lineWidth = 1;
    waveContext.beginPath();
    waveContext.moveTo(55, waveCanvas.height / 2);
    waveContext.lineTo(waveCanvas.width - 20, waveCanvas.height / 2);
    waveContext.stroke();

    waveContext.strokeStyle = '#79c8ff';
    waveContext.lineWidth = 3;
    waveContext.beginPath();
    for (let i = 0; i < 600; i++) {
      const pointPhase = i / 599 + Number(phase.value);
      const sample = waveformSample(type(), pointPhase, Number(width.value));
      const voltage = outputVoltage(sample, Number(amplitude.value), Number(offset.value));
      const x = 55 + i * (waveCanvas.width - 80) / 599;
      const y = waveCanvas.height / 2 - voltage * (waveCanvas.height * 0.075);
      if (i) waveContext.lineTo(x, y);
      else waveContext.moveTo(x, y);
    }
    waveContext.stroke();

    const voltage = liveVoltage(cyclePhase);
    const markerX = 55 + cyclePhase * (waveCanvas.width - 80);
    const markerY = waveCanvas.height / 2 - voltage * (waveCanvas.height * 0.075);
    waveContext.strokeStyle = '#f4c96b';
    waveContext.lineWidth = 1.5;
    waveContext.beginPath();
    waveContext.moveTo(markerX, 20);
    waveContext.lineTo(markerX, waveCanvas.height - 20);
    waveContext.stroke();
    waveContext.fillStyle = '#f4c96b';
    waveContext.beginPath();
    waveContext.arc(markerX, markerY, 7, 0, Math.PI * 2);
    waveContext.fill();

    waveContext.fillStyle = '#b9c5ce';
    waveContext.font = '13px system-ui';
    for (let volts = -5; volts <= 5; volts += 2.5) {
      waveContext.fillText(
        `${volts} V`,
        8,
        waveCanvas.height / 2 - volts * (waveCanvas.height * 0.075) + 4,
      );
    }

    $<HTMLElement>('#instantReadout').textContent = `${voltage.toFixed(2)} V`;
  }

  function drawSpectrum() {
    const harmonics = harmonicAmplitudes(type(), 16, Number(width.value));
    spectrumContext.fillStyle = '#101821';
    spectrumContext.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
    const barWidth = (spectrumCanvas.width - 100) / 16;
    harmonics.forEach((strength, index) => {
      const height = strength * (spectrumCanvas.height - 55);
      spectrumContext.fillStyle = '#f4c96b';
      spectrumContext.fillRect(
        55 + index * barWidth,
        spectrumCanvas.height - 30 - height,
        barWidth * 0.65,
        height,
      );
      spectrumContext.fillStyle = '#b9c5ce';
      spectrumContext.font = '12px system-ui';
      spectrumContext.fillText(String(index + 1), 58 + index * barWidth, spectrumCanvas.height - 10);
    });
  }

  function applyAudio() {
    if (!audio || !oscillator || !gain) return;
    const now = audio.currentTime;
    oscillator.frequency.setTargetAtTime(hz(), now, 0.02);
    const audioWaveform = webAudioWaveform(type());
    if (audioWaveform === 'periodic') {
      const { real, imag } = pulseWaveCoefficients(Number(width.value));
      oscillator.setPeriodicWave(audio.createPeriodicWave(real, imag, { disableNormalization: false }));
    } else {
      oscillator.type = audioWaveform;
    }
    gain.gain.setTargetAtTime(muted ? 0 : Number(volume.value), now, 0.02);
  }

  function render() {
    const currentHz = hz();
    const waveform = type();
    $<HTMLOutputElement>('#frequencyOut').value = `${Number(frequency.value).toFixed(0)} Hz`;
    $<HTMLOutputElement>('#cvOut').value = `${Number(cv.value).toFixed(2)} V`;
    $<HTMLOutputElement>('#coarseOut').value = `${Number(coarse.value)} oct`;
    $<HTMLOutputElement>('#fineOut').value = `${Number(fine.value)} cents`;
    $<HTMLOutputElement>('#widthOut').value = `${Math.round(Number(width.value) * 100)}%`;
    $<HTMLOutputElement>('#phaseOut').value = `${Math.round(Number(phase.value) * 360)}°`;
    $<HTMLOutputElement>('#amplitudeOut').value = `±${Number(amplitude.value).toFixed(1)} V`;
    $<HTMLOutputElement>('#offsetOut').value = `${Number(offset.value).toFixed(1)} V`;
    $<HTMLOutputElement>('#volumeOut').value = `${Math.round(Number(volume.value) / 0.12 * 100)}%`;
    $<HTMLElement>('#pitchReadout').textContent = `${frequencyToNoteName(currentHz)} · ${currentHz < 1000 ? currentHz.toFixed(1) : `${(currentHz / 1000).toFixed(2)} k`} Hz`;
    $<HTMLElement>('#periodReadout').textContent = `${periodMs(currentHz).toFixed(2)} ms`;
    $<HTMLElement>('#ppReadout').textContent = `${peakToPeak(Number(amplitude.value)).toFixed(1)} V`;
    $<HTMLElement>('#fundamentalReadout').textContent = `${currentHz.toFixed(1)} Hz`;
    $<HTMLElement>('#explainTitle').textContent = waveform === 'sine'
      ? 'One harmonic'
      : waveform === 'triangle'
        ? 'Odd harmonics fade quickly'
        : waveform === 'saw'
          ? 'Every harmonic is present'
          : waveform === 'square'
            ? 'Odd harmonics only'
            : 'Pulse width reshapes harmonics';
    $<HTMLElement>('#explainText').textContent = `The oscillator repeats every ${periodMs(currentHz).toFixed(2)} ms. The gold playhead is time-expanded so the cycle remains visible. Its output is centred at ${Number(offset.value).toFixed(1)} V with ${peakToPeak(Number(amplitude.value)).toFixed(1)} V peak-to-peak.`;
    width.disabled = waveform !== 'pulse';
    drawWave();
    drawSpectrum();
    applyAudio();
  }

  function animate(now: number) {
    if (disposed) return;
    const elapsed = Math.min((now - previousFrameTime) / 1000, 0.1);
    previousFrameTime = now;
    visualPhase = phaseAt(elapsed, displayCyclesPerSecond(), visualPhase);
    drawWave(visualPhase);
    animationFrame = requestAnimationFrame(animate);
  }

  async function start() {
    if (!audio) {
      audio = new AudioContext();
      oscillator = audio.createOscillator();
      gain = audio.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
    }
    if (audio.state === 'suspended') await audio.resume();
    applyAudio();
    $<HTMLElement>('#audioStatus').textContent = 'Running';
  }

  async function stop() {
    if (oscillator) {
      try {
        oscillator.stop();
      } catch {
        // The node may already have stopped.
      }
    }
    oscillator?.disconnect();
    gain?.disconnect();
    if (audio) await audio.close();
    audio = null;
    oscillator = null;
    gain = null;
    $<HTMLElement>('#audioStatus').textContent = 'Stopped';
  }

  function lesson(index: number) {
    lessonIndex = (index + lessons.length) % lessons.length;
    const currentLesson = lessons[lessonIndex];
    $<HTMLElement>('#lessonCount').textContent = `Experiment ${lessonIndex + 1} of ${lessons.length}`;
    $<HTMLElement>('#lessonTitle').textContent = currentLesson[0];
    $<HTMLElement>('#lessonText').textContent = currentLesson[1];
  }

  function reset() {
    wave.value = 'sine';
    frequency.value = '220';
    cv.value = '0';
    coarse.value = '0';
    fine.value = '0';
    width.value = '.5';
    phase.value = '0';
    amplitude.value = '2.5';
    offset.value = '0';
    volume.value = '.035';
    muted = false;
    visualPhase = 0;
    $<HTMLButtonElement>('#audioMute').textContent = 'Mute';
    render();
  }

  [wave, frequency, cv, coarse, fine, width, phase, amplitude, offset, volume]
    .forEach((element) => element.addEventListener('input', render));
  $<HTMLButtonElement>('#audioStart').onclick = start;
  $<HTMLButtonElement>('#audioStop').onclick = stop;
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
  };
  $<HTMLButtonElement>('#exploreTab').onclick = () => {
    $<HTMLElement>('#lesson').hidden = true;
  };

  lesson(0);
  render();
  animationFrame = requestAnimationFrame(animate);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    void stop();
  };
}
