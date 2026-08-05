export type Waveform='sine'|'triangle'|'saw'|'square'|'pulse';
export function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value))}
export function frequencyFromCv(referenceHz:number,volts:number,coarseOctaves=0,fineCents=0){return referenceHz*Math.pow(2,volts+coarseOctaves+fineCents/1200)}
export function periodMs(frequencyHz:number){return 1000/frequencyHz}
export function phaseAt(timeSeconds:number,frequencyHz:number,phaseOffset=0){const p=(timeSeconds*frequencyHz+phaseOffset)%1;return p<0?p+1:p}
export function waveformSample(type:Waveform,phase:number,pulseWidth=.5){const p=((phase%1)+1)%1;switch(type){case'sine':return Math.sin(p*Math.PI*2);case'triangle':return 1-4*Math.abs(Math.round(p)-p);case'saw':return 2*p-1;case'square':return p<.5?1:-1;case'pulse':return p<clamp(pulseWidth,.05,.95)?1:-1}}
export function outputVoltage(sample:number,amplitude:number,offset:number){return sample*amplitude+offset}
export function peakToPeak(amplitude:number){return Math.abs(amplitude)*2}
export function harmonicAmplitudes(type:Waveform,count=16,pulseWidth=.5){return Array.from({length:count},(_,i)=>{const n=i+1;if(type==='sine')return n===1?1:0;if(type==='saw')return 1/n;if(type==='triangle')return n%2?1/(n*n):0;if(type==='square')return n%2?1/n:0;return Math.abs(2*Math.sin(Math.PI*n*clamp(pulseWidth,.05,.95))/(Math.PI*n))})}
export function frequencyToNoteName(frequency:number){const midi=Math.round(69+12*Math.log2(frequency/440));const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];return`${names[(midi%12+12)%12]}${Math.floor(midi/12)-1}`}
