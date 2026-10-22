import {buildEvaluationRequest,requestEvaluation,validateEvaluationResult} from './ai.js';
import {aiServiceStatus,createHttpProvider} from './ai-http.js';
export function createAiUI(ctx){
 const {state,store,esc,btn,dialogFrame,showPhoto,showCompare,reload,render,toast}=ctx;
 let pending=null,task=null,sequence=0,accessCode='';
 function validSaved(saved){try{return Array.isArray(saved?.photoIds)&&saved.photoIds.length>=1&&saved.photoIds.length<=2&&saved.photoIds.every(id=>typeof id==='string')&&validateEvaluationResult(saved.result,{requestId:saved.result?.requestId}).status==='ok';}catch{return false;}}
 function cancel(){sequence++;task?.abort();task=null;}
 const back=ids=>btn('返回照片','ai-back','',`data-ids="${ids.join(',')}"`);
 function entry(ids){
  const saved=state.photos.find(p=>p.id===ids[0])?.aiReview,hasSaved=validSaved(saved)&&saved.photoIds.join(',')===ids.join(',');
  return `<section class="ai-entry"><div><h3>AI 摄影复盘 <span class="badge">${globalThis.AndroidStorage?'待接入':'按需分析'}</span></h3><p class="small muted">结合画面、拍摄参数和你的问题，分析构图、光线与取舍。</p></div><label class="sr-only">想问AI的问题</label><input class="field ai-question" aria-label="想问AI的问题" maxlength="1000" placeholder="可选：想问什么？">${btn('主动评价','ai-review','ghost',`data-ids="${ids.join(',')}"`)}${hasSaved?btn('查看上次分析','ai-last','ghost',`data-ids="${ids.join(',')}"`):''}</section>`;
 }
 function confirm(){
  dialogFrame('AI 摄影复盘',`<p>将发送所选${pending.photos.length}张照片的压缩副本、拍摄参数及你的问题给DeepSeek分析。分析结果会保存在当前浏览器。</p><p class="note" style="margin-top:16px">图片经过缩小，清晰度与精确判焦建议仅供参考。原照片中的文字也可能进入分析。</p><div class="form-stack" style="margin-top:16px">${pending.useAccount?'<p class="small muted">使用当前登录账户的AI额度。</p>':`<label>AI访问口令<input type="password" id="ai-access-code" class="field" autocomplete="off" value="${esc(accessCode)}" placeholder="由站点管理员提供，不是DeepSeek密钥"></label>`}<label>这次想问什么<textarea id="ai-note" class="field" maxlength="1000">${esc(pending.note)}</textarea></label><label class="check"><input type="checkbox" id="ai-consent">我同意发送这些照片及参数进行分析</label></div>`,back(pending.ids)+btn('发送并分析','ai-submit','primary'));
 }
 function showResult(saved,persisted=true){
  const result=saved.result,basis={observation:'画面观察',exif:'拍摄参数',inference:'推测'};
  dialogFrame('AI 分析结果',`<p class="note">${esc(result.summary)}</p>${result.preferred?`<p style="margin-top:12px"><strong>选片建议：${result.preferred==='tie'?'两张各有所长':esc(result.preferred)}</strong></p>`:''}<div class="stack" style="margin-top:20px">${result.observations.map(o=>`<article class="panel"><span class="badge">${basis[o.basis]||'推测'}</span><h3>${esc(o.aspect)}</h3><p>${esc(o.text)}</p></article>`).join('')}</div><h3 style="margin-top:20px">下次可以试试</h3><ul>${result.nextSteps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><p class="small muted">${persisted?'已保存到这些照片的复盘记录。':'分析已返回，但本地保存失败；请保留当前结果后重试。'}AI建议由你自行取舍。</p>`,back(saved.photoIds));
 }
 async function open(ids,note){
  cancel();const current=sequence,photos=ids.map(id=>state.photos.find(p=>p.id===id)).filter(Boolean);
  if(photos.length!==ids.length||!photos.length)return toast('照片不存在，请刷新后重试。');
  pending={ids,photos,note};
  if(globalThis.AndroidStorage){dialogFrame('AI 评价 · 待接入','<p>当前APK的联网AI尚未接入，照片没有发送。服务器网页版配置完成后可使用AI分析。</p>',back(ids));return;}
  task=new AbortController();dialogFrame('检查AI服务','<p>正在检查服务状态，照片尚未发送。</p>',back(ids));
  let status;try{status=await aiServiceStatus({signal:task.signal});}catch{if(current===sequence)task=null;return;}
  if(current!==sequence)return;task=null;
  if(!status.enabled){dialogFrame('AI 评价 · 尚未启用',`<p>${esc(status.message||'AI尚未启用，照片没有发送。')}</p><p class="small muted" style="margin-top:12px">服务器配置完成后，可从这里分析单张或A/B双图。</p>`,back(ids));return;}
  if(status.accountRequired&&!status.signedIn){dialogFrame('登录后使用AI','<p>管理员已启用账户额度管理，请先登录，再返回照片主动分析。</p><p><a href="/account/">前往账户登录</a></p>',back(ids));return;}
  pending.useAccount=!!status.signedIn;pending.csrfToken=status.csrfToken||'';confirm();
 }
 async function action(el){
  const name=el.dataset.action;
  if(name==='ai-back'){cancel();const ids=el.dataset.ids.split(',');if(ids.length===2){state.selected=ids;showCompare();}else showPhoto(ids[0]);return true;}
  if(name==='ai-review'){await open(el.dataset.ids.split(','),el.closest('.ai-entry')?.querySelector('.ai-question')?.value||'');return true;}
  if(name==='ai-last'){cancel();const saved=state.photos.find(p=>p.id===el.dataset.ids.split(',')[0])?.aiReview;if(validSaved(saved))showResult(saved);else toast('上次分析记录不可用，请重新分析。');return true;}
  if(name==='ai-retry'){cancel();if(pending)confirm();return true;}
  if(name!=='ai-submit')return false;
  if(!pending||task)return true;
  if(!document.querySelector('#ai-consent')?.checked){toast('请先确认同意发送所选照片。');return true;}
  if(!pending.useAccount){accessCode=document.querySelector('#ai-access-code').value.trim();if(!accessCode){toast('请输入站点管理员提供的AI访问口令。');return true;}}
  pending.note=document.querySelector('#ai-note').value;
  const current=sequence,details=pending;task=new AbortController();const signal=AbortSignal.any([task.signal,AbortSignal.timeout(65000)]);
  dialogFrame('正在分析照片','<p>所选副本正在发送给DeepSeek，通常需要等待一会儿。</p><p class="small muted" style="margin-top:12px">返回或关闭可取消本地等待；已经发出的分析仍可能计费。</p>',back(details.ids));
  try{
   const session=state.sessions.find(s=>s.id===details.photos[0]?.sessionId),request=buildEvaluationRequest(details.photos,{session,note:details.note,catalog:ctx.catalog?.()});
   const result=await requestEvaluation(request,{provider:createHttpProvider({photos:details.photos,accessCode:details.useAccount?null:accessCode,csrfToken:details.csrfToken,signal})});
   if(result.status!=='ok')throw new Error(result.message||'AI服务尚未启用。');
   if(current!==sequence)return;
   const saved={result,photoIds:details.ids,note:details.note,at:new Date().toISOString()};let persisted=true;
   try{const rows=[];for(const id of details.ids){const fresh=await store.get('photos',id);if(fresh)rows.push({...fresh,aiReview:saved});}if(rows.length!==details.ids.length)throw new Error('photo missing');await store.merge({photos:rows});await reload();render();}catch{persisted=false;}
   if(current===sequence)showResult(saved,persisted);
  }catch(error){if(current===sequence)dialogFrame('这次分析未完成',`<p>${esc(signal.aborted?'分析已超时或取消。':error.message)}</p><p class="small muted" style="margin-top:12px">本地照片与手动复盘仍保留，不会自动重试。</p>`,back(details.ids)+btn('重新填写','ai-retry','primary'));}
  finally{if(current===sequence)task=null;}
  return true;
 }
 return {entry,action,cancel};
}
