import '../../../packages/ui/src/tokens.css';
import './styles.css';
import './filter.css';
import './vca-mixer.css';
import './lfo-modulation.css';
import { mountSampleHold } from './sample-hold';
import { mountClockTrigger } from './clock-trigger';
import { mountOscillator } from './oscillator';
import { mountQuantizer } from './quantizer';
import { mountEnvelope } from './envelope';
import { mountPatch } from './patch';
import { mountFilter } from './filter';
import { mountVcaMixer } from './vca-mixer';
import { mountLfoModulationWithOscillatorVisual } from './lfo-modulation-with-oscillator-visual';
import { mountModuleMiniOscilloscope } from './mini-oscilloscope';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing app root');

root.innerHTML = `<header class="suite-header"><div><p class="eyebrow">Interactive modular synthesis curriculum</p><h1>Voltage Lab</h1><p>Small visual and audible laboratories for understanding voltage, timing and sound.</p></div><nav aria-label="Laboratories"><a href="#/sample-and-hold" data-route="sample">Sample & Hold</a><a href="#/clock-and-trigger" data-route="clock">Clock & Trigger</a><a href="#/oscillator" data-route="oscillator">Oscillator</a><a href="#/quantizer" data-route="quantizer">Quantizer</a><a href="#/envelope" data-route="envelope">Envelope</a><a href="#/patch" data-route="patch">Patch</a><a href="#/filter" data-route="filter">Filter</a><a href="#/vca-mixer" data-route="vca-mixer">VCA & Mixer</a><a href="#/lfo-modulation" data-route="lfo-modulation">LFO & Modulation</a></nav></header><main id="module"></main><footer>Voltage Lab · one concept at a time</footer>`;

const moduleRoot = document.querySelector<HTMLElement>('#module');
if (!moduleRoot) throw new Error('Missing module root');

let dispose: (() => void) | undefined;
const keep = (mounted: void | (() => void)) => {
  if (typeof mounted === 'function') dispose = mounted;
};

function mountWithMiniScope(moduleId: string, mounted: void | (() => void)) {
  keep(mounted);
  const removeMiniScope = mountModuleMiniOscilloscope(moduleRoot, moduleId);
  const disposeModule = dispose;
  dispose = () => {
    removeMiniScope?.();
    disposeModule?.();
  };
}

function route() {
  dispose?.();
  dispose = undefined;
  const path = location.hash || '#/sample-and-hold';
  root.querySelectorAll('nav a').forEach((link) => link.classList.remove('active'));
  if (path === '#/sample-and-hold') {
    root.querySelector('[data-route=sample]')?.classList.add('active');
    mountWithMiniScope('sample-and-hold', mountSampleHold(moduleRoot));
  } else if (path === '#/clock-and-trigger') {
    root.querySelector('[data-route=clock]')?.classList.add('active');
    mountWithMiniScope('clock-and-trigger', mountClockTrigger(moduleRoot));
  } else if (path === '#/oscillator') {
    root.querySelector('[data-route=oscillator]')?.classList.add('active');
    mountWithMiniScope('oscillator', mountOscillator(moduleRoot));
  } else if (path === '#/quantizer') {
    root.querySelector('[data-route=quantizer]')?.classList.add('active');
    mountWithMiniScope('quantizer', mountQuantizer(moduleRoot));
  } else if (path === '#/envelope') {
    root.querySelector('[data-route=envelope]')?.classList.add('active');
    mountWithMiniScope('envelope', mountEnvelope(moduleRoot));
  } else if (path === '#/patch') {
    root.querySelector('[data-route=patch]')?.classList.add('active');
    mountWithMiniScope('patch', mountPatch(moduleRoot));
  } else if (path === '#/filter') {
    root.querySelector('[data-route=filter]')?.classList.add('active');
    mountWithMiniScope('filter', mountFilter(moduleRoot));
  } else if (path === '#/vca-mixer') {
    root.querySelector('[data-route=vca-mixer]')?.classList.add('active');
    mountWithMiniScope('vca-mixer', mountVcaMixer(moduleRoot));
  } else if (path === '#/lfo-modulation') {
    root.querySelector('[data-route=lfo-modulation]')?.classList.add('active');
    mountWithMiniScope('lfo-modulation', mountLfoModulationWithOscillatorVisual(moduleRoot));
  } else {
    moduleRoot.innerHTML = '<section class="empty panel"><h2>Module not found</h2><a href="#/sample-and-hold">Open Sample & Hold</a></section>';
  }
}

window.addEventListener('hashchange', route);
route();
