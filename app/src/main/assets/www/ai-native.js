// Credentials are sent once to the native encrypted vault and never read back.
export function nativeAiStatus(){
 try{const status=JSON.parse(globalThis.AndroidAi.status());return {available:true,configured:status.configured===true,unreadable:status.unreadable===true,model:'deepseek-flash'};}
 catch{return {available:false,configured:false,unreadable:false,model:'deepseek-flash'};}
}
export function nativeAiRequest(action,payload={}, {signal,timeoutMs=70000}={}){
 if(!globalThis.AndroidAi?.request)return Promise.reject(new Error('请安装支持AI直连的新版APK。'));
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();let settled=false,timer;
  const cleanup=()=>{clearTimeout(timer);window.removeEventListener('android-ai-result',reply);signal?.removeEventListener('abort',abort);};
  const finish=(error,data)=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(data);};
  const abort=()=>{try{AndroidAi.cancel(id);}catch{}const error=new Error(signal?.reason?.name==='TimeoutError'?'分析等待超时，请重新发起。':'本次分析已取消。');error.name='AbortError';finish(error);};
  const reply=event=>{const result=event.detail;if(result?.id!==id)return;if(result.ok===true)finish(null,result.data);else{const error=new Error(typeof result.error==='string'?result.error:'本次AI操作未完成，请重试。');error.code=result.code;finish(error);}};
  window.addEventListener('android-ai-result',reply);signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{try{AndroidAi.cancel(id);}catch{}const error=new Error('分析等待超时，请重新发起。');error.code='AI_TIMEOUT';finish(error);},timeoutMs);
  if(signal?.aborted){abort();return;}
  try{AndroidAi.request(id,action,JSON.stringify(payload));}catch{finish(new Error('安卓AI连接失败，请关闭后重新打开应用。'));}
 });
}
export const nativeAiService={status:nativeAiStatus,request:nativeAiRequest};
export function nativeEvaluationPayload(request,consent){
 if(!consent)throw new Error('请先确认同意发送所选照片。');
 return {consent:true,request:{schema:request.schema,requestId:request.requestId,mode:request.mode,note:request.note,learningContext:request.learningContext,photos:request.photos.map(p=>({id:p.id,label:p.label}))}};
}
export function createNativeProvider({signal,consent=false,service=nativeAiService}={}){
 return {evaluate:request=>service.request('evaluate',nativeEvaluationPayload(request,consent),{signal})};
}
