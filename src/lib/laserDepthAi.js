// Free, client-side relative-depth inference. Model weights are downloaded on first use;
// no images are sent to a paid API. Inference may need substantial memory/processing time.
// Pin the model ID and library version; errors are surfaced instead of silently substituting an "AI" result.
let estimatorPromise;
export const DEPTH_MODEL='onnx-community/depth-anything-v2-small';
export async function inferDepth(imageCanvas,{onStatus}={}) {
  if(!imageCanvas||!imageCanvas.width)throw Error('Load an image first.');
  if(!navigator.onLine)throw Error('The first AI model download needs internet. Manual modes remain available offline.');
  onStatus?.('Loading free Depth Anything V2 Small model (one-time download)…');
  if(!estimatorPromise)estimatorPromise=import(/* @vite-ignore */ 'https://esm.sh/@huggingface/transformers@3.8.1')
    .then(async ({pipeline,env})=>{
      env.allowLocalModels=false;
      return pipeline('depth-estimation',DEPTH_MODEL,{device:'wasm'});
    }).catch(error=>{estimatorPromise=null;throw error;});
  const estimator=await estimatorPromise;
  onStatus?.('Estimating relative image depth locally…');
  const output=await estimator(imageCanvas.toDataURL('image/png'));
  const depth=output?.depth;
  if(!depth?.data||!depth?.width||!depth?.height)throw Error('AI returned no usable depth pixels.');
  const out=new Uint8ClampedArray(depth.width*depth.height*4);
  const channels=depth.channels || Math.max(1,Math.round(depth.data.length/(depth.width*depth.height)));
  for(let i=0;i<depth.width*depth.height;i++){
    const n=Number(depth.data[i*channels]);
    const v=Number.isFinite(n)?Math.max(0,Math.min(255,Math.round(n))):0;
    out[4*i]=out[4*i+1]=out[4*i+2]=v;out[4*i+3]=255;
  }
  const temp=document.createElement('canvas');temp.width=depth.width;temp.height=depth.height;
  temp.getContext('2d').putImageData(new ImageData(out,depth.width,depth.height),0,0);
  const target=document.createElement('canvas');target.width=imageCanvas.width;target.height=imageCanvas.height;
  target.getContext('2d').drawImage(temp,0,0,target.width,target.height);
  return target.getContext('2d').getImageData(0,0,target.width,target.height);
}
