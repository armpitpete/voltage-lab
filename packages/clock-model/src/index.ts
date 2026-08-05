export type ClockFrame={phase:number;gate:boolean;trigger:boolean;divided:boolean;multiplied:boolean;beat:number};
export const bpmToHz=(bpm:number)=>bpm/60;
export const hzToBpm=(hz:number)=>hz*60;
export const periodMs=(bpm:number)=>60000/bpm;
export const clampPulseWidth=(value:number)=>Math.min(.95,Math.max(.05,value));
export function swungInterval(baseMs:number,swing:number,step:number){const s=Math.min(.49,Math.max(0,swing));return baseMs*(step%2===0?1+s:1-s)}
export function clockFrame(elapsedMs:number,bpm:number,pulseWidth:number,division:number,multiplication:number):ClockFrame{const base=periodMs(bpm),phase=(elapsedMs%base)/base,beat=Math.floor(elapsedMs/base);const gate=phase<clampPulseWidth(pulseWidth);const trigger=phase<.035;const divided=beat%Math.max(1,Math.round(division))===0&&trigger;const multiPhase=(elapsedMs%(base/Math.max(1,Math.round(multiplication))))/(base/Math.max(1,Math.round(multiplication)));return{phase,gate,trigger,divided,multiplied:multiPhase<.035,beat}}
export function pulseDurationMs(bpm:number,pulseWidth:number){return periodMs(bpm)*clampPulseWidth(pulseWidth)}
