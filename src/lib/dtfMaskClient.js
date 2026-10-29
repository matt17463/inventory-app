let worker,serial=0;
const pending=new Map(),cache=new WeakMap();
const maskKeys=['background','threshold','removalTolerance','backgroundFeather','backgroundColor','backgroundPoint','backgroundScope','backgroundDecontaminate','removeInteriorWhite','interiorWhiteThreshold','interiorWhiteFeather','regionPoints','maskStrokes','aiGuidance'];
export function preparedMask(bitmap,original,opts){
  const key=JSON.stringify(maskKeys.map(k=>opts[k]));
  let masks=cache.get(bitmap);if(!masks){masks=new Map();cache.set(bitmap,masks);}if(masks.has(key))return masks.get(key);
  if(!worker){worker=new Worker(new URL('./dtfMask.worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{const task=pending.get(data.id);if(task){pending.delete(data.id);if(data.error)task.reject(Error(data.error));else task.resolve(data);}};
    worker.onerror=()=>{for(const task of pending.values())task.reject(Error('Mask worker unavailable. Reload the studio.'));pending.clear();worker.terminate();worker=null;};
  }
  const promise=new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,pixels:original,width:bitmap.width,height:bitmap.height,opts},[original.buffer]);});
  masks.set(key,promise);if(masks.size>2)masks.delete(masks.keys().next().value);promise.catch(()=>{if(masks.get(key)===promise)masks.delete(key);});
  return promise;
}
