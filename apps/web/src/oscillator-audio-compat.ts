import{pulseWaveCoefficients,webAudioWaveform,type Waveform}from'../../../packages/oscillator-model/src/index';

let installed=false;

export function installOscillatorAudioCompatibility(){
  if(installed)return;
  installed=true;
  const descriptor=Object.getOwnPropertyDescriptor(OscillatorNode.prototype,'type');
  if(!descriptor?.set)return;
  const nativeSet=descriptor.set;
  Object.defineProperty(OscillatorNode.prototype,'type',{
    configurable:descriptor.configurable,
    enumerable:descriptor.enumerable,
    get:descriptor.get,
    set(this:OscillatorNode,value:OscillatorType){
      const requested=value as unknown as Waveform;
      const mapped=webAudioWaveform(requested);
      if(mapped==='periodic'){
        const widthControl=document.querySelector<HTMLInputElement>('#width');
        const width=widthControl?Number(widthControl.value):.5;
        const{real,imag}=pulseWaveCoefficients(width);
        this.setPeriodicWave(this.context.createPeriodicWave(real,imag,{disableNormalization:false}));
        return;
      }
      nativeSet.call(this,mapped);
    }
  });
}
