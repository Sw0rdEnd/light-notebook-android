// The site access code is not the DeepSeek API key. No credential is persisted.
export async function aiServiceStatus({fetchImpl=fetch,signal}={}){
 try{const r=await fetchImpl('/api/ai/status',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000),cache:'no-store'});if(r.ok){const status=await r.json();if(typeof status.enabled==='boolean')return status;}}catch(error){if(signal?.aborted)throw error;}
 return {enabled:false,message:'AI评价服务尚未启用，照片没有发送。'};
}
export async function encodeAiPreview(blob){
 if(!(blob instanceof Blob))throw new Error('照片副本缺失，请先重新导入照片。');
 const bitmap=await createImageBitmap(blob);
 try{
  const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
  if(!image||image.size>2*1024*1024)throw new Error('图片无法压缩到AI传输限制内，请先缩小后重新导入。');
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('读取图片失败。'));reader.readAsDataURL(image);});
 }finally{bitmap.close?.();}
}
export function createHttpProvider({photos,accessCode,csrfToken,signal,fetchImpl=fetch,encode=encodeAiPreview}){
 const metadata=value=>Object.fromEntries(['camera','make','lens','takenAt','focal','focal35','aperture','exposure','iso'].filter(key=>value?.[key]!=null).map(key=>[key,value[key]]));
 return {async evaluate(request){
  const uploads=[];
  for(const photo of request.photos){
   signal?.throwIfAborted();const local=photos.find(p=>p.id===photo.id);
   const corrections={...photo.corrections};if(corrections.body?.model)corrections.camera=corrections.body.model;if(corrections.lens?.model)corrections.lens=corrections.lens.model;
   uploads.push({label:photo.label,image:await encode(local?.preview),exif:metadata(photo.exif),corrections:metadata(corrections),reviewNote:photo.reviewNote});
  }
  signal?.throwIfAborted();
  const response=await fetchImpl('/api/ai/evaluate',{method:'POST',headers:{'Content-Type':'application/json',...(accessCode?{Authorization:`Bearer ${accessCode}`}:{'X-CSRF-Token':csrfToken||''})},body:JSON.stringify({schema:'light-journal.ai-upload.v1',requestId:request.requestId,note:request.note,learningContext:request.learningContext,photos:uploads}),signal});
  let result;try{result=await response.json();}catch{throw new Error('服务器没有返回有效结果，请稍后再试。');}
  if(!response.ok)throw new Error(result.message||'AI分析暂时失败，请稍后再试。');return result;
 }};
}
