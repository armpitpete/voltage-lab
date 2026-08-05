export type HoldMode='sample-hold'|'track-hold'|'companion-hold';
export const clamp=(v:number,min=-5,max=5)=>Math.min(max,Math.max(min,v));
export const sampleHold=(previous:number,input:number,triggered:boolean)=>triggered?input:previous;
export const trackHold=(previous:number,input:number,gate:boolean)=>gate?input:previous;
export function slew(current:number,target:number,amount:number){if(amount<=0)return target;const rate=Math.max(.002,1-amount)*.22;return current+(target-current)*rate}
export const companionValues=(main:number,spread:number)=>({main:clamp(main),high:clamp(main+spread),low:clamp(main-spread)});
export function jitteredInterval(baseMs:number,jitter:number,random=.5){const offset=(random*2-1)*Math.max(0,Math.min(.35,jitter));return Math.max(40,baseMs*(1+offset))}
export const quantizeCv=(cv:number,on:boolean)=>on?Math.round(cv*12)/12:cv;
export const cvToFrequency=(cv:number,reference=220)=>reference*Math.pow(2,cv);
const NOTES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export function frequencyToNoteName(f:number){const midi=Math.round(69+12*Math.log2(f/440));return `${NOTES[(midi%12+12)%12]}${Math.floor(midi/12)-1}`}
