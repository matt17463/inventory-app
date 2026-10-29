import assert from 'node:assert/strict';
import {pipeline, RawImage} from '@huggingface/transformers';
import {applyLocalSegmentationAlpha} from '../src/lib/creativeLocalMask.js';

const width=128,height=128,data=new Uint8ClampedArray(width*height*3);
for(let y=0;y<height;y++) for(let x=0;x<width;x++){
  const i=(y*width+x)*3;
  const fg=Math.hypot(x-64,y-64)<36;
  const c=fg?[40,75,190]:[240,242,245];
  data.set(c,i);
}
console.log('Loading local CPU uint8 model in Node.js (browser uses WASM)...');
const remover=await pipeline('background-removal','onnx-community/ormbg-ONNX',{device:'cpu',dtype:'uint8'});
console.log('Performing inference on synthetic image...');
const output=await remover([new RawImage(data,width,height,3)]);
assert(Array.isArray(output)&&output.length===1,'Expected one output image');
const image=output[0];
assert.equal(image.width,width);
assert.equal(image.height,height);
assert([1,3,4].includes(image.channels),'Unexpected output channels');
const source=image.channels===4?image.data:null;
if(source){
  const result=applyLocalSegmentationAlpha(new Uint8ClampedArray(source));
  assert(result.data.length===width*height*4);
  assert(result.foreground>=0);
}
console.log('PASS: model loaded, inference completed, dimensions and output validated (not a print-quality certification).');
