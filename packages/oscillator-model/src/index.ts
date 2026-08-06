export type Waveform='sine'|'triangle'|'saw'|'square'|'pulse';
export type ModulationSource='off'|'sine'|'stepped';
export type ModulationDestination='pitch'|'pulseWidth'|'amplitude';
export function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value))}
export function frequencyFromCv(referenceHz:number,volts:number,coarseOctaves=0,fineCents=0){return referenceHz*Math.pow(2,volts+coarseOctaves+fineCents/1200)}
export function periodMs(frequencyHz:number){return 1000/frequencyHz}
export function scopeCycles(frequencyHz:number,windowMs:number){return frequencyHz*windowMs/1000}
export function phaseAt(timeSeconds:number,frequencyHz:number,phaseOffset=0){const p=(timeSeconds*frequencyHz+phaseOffset)%1;return p<0?p+1:p}
export function triggeredScopePhase(timeFromTriggerSeconds:number,frequencyHz:number,phaseOffset=0){return phaseAt(timeFromTriggerSeconds,frequencyHz,phaseOffset)}
export function waveformSample(type:Waveform,phase:number,pulseWidth=.5){const p=((phase%1)+1)%1;switch(type){case'sine':return Math.sin(p*Math.PI*2);case'triangle':return 1-4*Math.abs(Math.round(p)-p);case'saw':return 2*p-1;case'square':return p<.5?1:-1;case'pulse':return p<clamp(pulseWidth,.05,.95)?1:-1}}
export function modulationSample(source:ModulationSource,phase:number){const p=((phase%1)+1)%1;if(source==='off')return 0;if(source==='sine')return Math.sin(p*Math.PI*2);return[-1,-1/3,1/3,1][Math.min(3,Math.floor(p*4))]}
export function modulationVoltage(source:ModulationSource,timeSeconds:number,rateHz:number,amountVolts:number){return modulationSample(source,timeSeconds*Math.max(0,rateHz))*amountVolts}
export function modulatedParameters(baseFrequencyHz:number,basePulseWidth:number,baseAmplitude:number,destination:ModulationDestination,cvVolts:number){return{frequencyHz:destination==='pitch'?frequencyFromCv(baseFrequencyHz,cvVolts):baseFrequencyHz,pulseWidth:destination==='pulseWidth'?clamp(basePulseWidth+cvVolts*.2,.05,.95):clamp(basePulseWidth,.05,.95),amplitude:destination==='amplitude'?clamp(baseAmplitude+cvVolts,0,5):clamp(baseAmplitude,0,5)}}
export function outputVoltage(sample:number,amplitude:number,offset:number){return sample*amplitude+offset}
export function peakToPeak(amplitude:number){return Math.abs(amplitude)*2}
export function harmonicAmplitudes(type:Waveform,count=16,pulseWidth=.5){return Array.from({length:count},(_,i)=>{const n=i+1;if(type==='sine')return n===1?1:0;if(type==='saw')return 1/n;if(type==='triangle')return n%2?1/(n*n):0;if(type==='square')return n%2?1/n:0;return Math.abs(2*Math.sin(Math.PI*n*clamp(pulseWidth,.05,.95))/(Math.PI*n))})}
export function webAudioWaveform(type:Waveform):OscillatorType|'periodic'{return type==='saw'?'sawtooth':type==='pulse'?'periodic':type}
export function pulseWaveCoefficients(pulseWidth:number,harmonics=64){const width=clamp(pulseWidth,.05,.95),real=new Float32Array(harmonics+1),imag=new Float32Array(harmonics+1);for(let n=1;n<=harmonics;n++){real[n]=2*Math.sin(2*Math.PI*n*width)/(Math.PI*n);imag[n]=2*(1-Math.cos(2*Math.PI*n*width))/(Math.PI*n)}return{real,imag}}
export function frequencyToNoteName(frequency:number){const midi=Math.round(69+12*Math.log2(frequency/440));const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];return`${names[(midi%12+12)%12]}${Math.floor(midi/12)-1}`}
