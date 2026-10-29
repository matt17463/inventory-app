import { prepareSourceMask } from './dtfMaskGuidance.js';
self.onmessage=({data:{id,pixels,width,height,opts}})=>{
  try{const result=prepareSourceMask(pixels,width,height,opts);self.postMessage({id,...result},[result.data.buffer]);}
  catch(error){self.postMessage({id,error:error.message});}
};
