// Avoid AbortSignal.any/timeout: older Android WebViews can lack those statics.
export function createAiTask({timeoutMs=65000,onElapsed=()=>{}}={}){
 const controller=new AbortController(),started=Date.now();let timedOut=false,disposed=false;
 const timer=setTimeout(()=>{timedOut=true;const error=new Error('分析等待超时。');error.name='TimeoutError';controller.abort(error);},timeoutMs);
 const progress=setInterval(()=>onElapsed(Math.floor((Date.now()-started)/1000)),1000);
 const dispose=()=>{if(disposed)return;disposed=true;clearTimeout(timer);clearInterval(progress);};
 return {signal:controller.signal,get timedOut(){return timedOut;},abort(){dispose();controller.abort();},dispose};
}
