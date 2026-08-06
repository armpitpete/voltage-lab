import {
  oscillatorSample,
  type MixerWaveform,
} from '../../../packages/vca-mixer-model/src/index';
import { mountLfoModulation } from './lfo-modulation';

const WAVEFORM_NAMES: Record<MixerWaveform, string> = {
  sine: 'Sine',
  sawtooth: 'Saw',
  square: 'Square',
  triangle: 'Triangle',
};

export function mountLfoModulationWithOscillatorVisual(root: HTMLElement) {
  const disposeLab = mountLfoModulation(root);
  const oscillatorWave = root.querySelector<HTMLSelectElement>('#oscillatorWave');
  const pitchReadout = root.querySelector<HTMLElement>('#pitchReadout');
  const routingPanel = root.querySelector<HTMLElement>('.routing-panel');

  if (!oscillatorWave || !pitchReadout || !routingPanel) {
    return disposeLab;
  }

  const panel = document.createElement('section');
  panel.className = 'scope panel';
  panel.id = 'audibleOscillatorVisual';
  panel.innerHTML = `<div class="scope-heading"><div><p class="eyebrow">Audible oscillator view</p><h3>Selected audio waveform</h3></div><div class="readouts"><span>Waveform<b id="audibleWaveformReadout">Saw</b></span><span>Current pitch<b id="audiblePitchReadout">220 Hz</b></span><span>Display<b>Stationary</b></span></div></div><canvas id="audibleOscillatorCanvas" width="1100" height="360" role="img" aria-label="Stationary saw audio oscillator waveform"></canvas><p class="scope-legend"><span class="quantized-key">Gold: audible oscillator shape</span><span>Moving dot: slowed inspection marker</span><span>Pitch modulation changes the frequency readout, not the displayed cycle count</span></p>`;
  routingPanel.before(panel);

  const canvas = panel.querySelector<HTMLCanvasElement>('#audibleOscillatorCanvas');
  const waveformReadout = panel.querySelector<HTMLElement>('#audibleWaveformReadout');
  const audiblePitchReadout = panel.querySelector<HTMLElement>('#audiblePitchReadout');
  const context = canvas?.getContext('2d');

  if (!canvas || !waveformReadout || !audiblePitchReadout || !context) {
    panel.remove();
    return disposeLab;
  }

  let animationFrame = 0;
  let markerPhase = 0;
  let lastFrameAt = performance.now();

  function drawGrid(width: number, height: number) {
    context.strokeStyle = '#263642';
    context.lineWidth = 1;
    for (let column = 0; column <= 12; column += 1) {
      const x = column / 12 * width;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let row = 0; row <= 6; row += 1) {
      const y = row / 6 * height;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }

  function draw(now: number) {
    const elapsedMs = Math.min(100, Math.max(0, now - lastFrameAt));
    lastFrameAt = now;
    markerPhase = (markerPhase + elapsedMs / 2000) % 1;

    const waveform = oscillatorWave.value as MixerWaveform;
    const waveformName = WAVEFORM_NAMES[waveform] ?? 'Unknown';
    const frequencyText = pitchReadout.textContent?.trim() || '—';
    const width = canvas.width;
    const height = canvas.height;
    const centre = height / 2;
    const amplitude = height * 0.36;
    const cycles = 3;

    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101821';
    context.fillRect(0, 0, width, height);
    drawGrid(width, height);

    context.strokeStyle = '#657785';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, centre);
    context.lineTo(width, centre);
    context.stroke();

    context.strokeStyle = '#f4c96b';
    context.lineWidth = 4;
    context.beginPath();
    for (let index = 0; index <= 900; index += 1) {
      const progress = index / 900;
      const x = progress * width;
      const sample = oscillatorSample(waveform, progress * cycles);
      const y = centre - sample * amplitude;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();

    const markerProgress = markerPhase;
    const markerSample = oscillatorSample(waveform, markerProgress * cycles);
    const markerX = markerProgress * width;
    const markerY = centre - markerSample * amplitude;
    context.fillStyle = '#f4c96b';
    context.beginPath();
    context.arc(markerX, markerY, 9, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#dce7ed';
    context.font = '18px system-ui';
    context.fillText(`${waveformName} · three fixed cycles`, 14, 26);
    context.fillText('+1', 10, 52);
    context.fillText('0', 10, centre - 8);
    context.fillText('−1', 10, height - 16);

    waveformReadout.textContent = waveformName;
    audiblePitchReadout.textContent = frequencyText;
    canvas.setAttribute('aria-label', `Stationary ${waveformName.toLowerCase()} audio oscillator waveform at ${frequencyText}`);
    animationFrame = requestAnimationFrame(draw);
  }

  animationFrame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(animationFrame);
    panel.remove();
    disposeLab?.();
  };
}
