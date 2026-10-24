import {buildEvaluationRequest,requestEvaluation,validateEvaluationResult} from './ai.js';
import {aiServiceStatus,createHttpProvider} from './ai-http.js';
import {nativeAiService,createNativeProvider} from './ai-native.js';
import {createNativeAiSettings} from './ai-native-settings.js';
import {createReviewBrief} from './ai-prompt.js';
import {createAiTask} from './ai-task.js';
export function createAiUI(ctx){
 const {state,store,esc,btn,dialogFrame,showPhoto,showCompare,reload,render,toast}=ctx;
 const native=!!ctx.nativeService||!!globalThis.AndroidStorage,service=ctx.nativeService||nativeAiService;
 let pending=null,task=null,sequence=0,accessCode='',unsavedResult=null;
 const drafts=new Map();
 const settings=createNativeAiSettings({service,esc,btn,dialogFrame,toast,render,onOpen:cancel,onReviewReturn:async()=>{if(pending)await open(pending.ids,pending.note);}});
 function validSaved(saved){try{return Array.isArray(saved?.photoIds)&&saved.photoIds.length>=1&&saved.photoIds.length<=2&&saved.photoIds.every(id=>typeof id==='string')&&validateEvaluationResult(saved.result,{requestId:saved.result?.requestId}).status==='ok';}catch{return false;}}
 function cancel(){sequence++;task?.abort();task=null;settings.cancel();}
 const back=ids=>btn('返回照片','ai-back','',`data-ids="${ids.join(',')}"`);
 function entry(ids){
  const saved=state.photos.find(p=>p.id===ids[0])?.aiReview,hasSaved=validSaved(saved)&&saved.photoIds.join(',')===ids.join(',');
  const info=native?settings.status():null,key=ids.join(',');
  return `<section class="ai-entry" data-ids="${key}"><div class="ai-entry-heading"><h3>AI 摄影点评 <span class="badge">${native?'DeepSeek 直连':'按需分析'}</span></h3><p class="small muted">${native?(info.configured?'密钥已保存。填写问题后，点下方按钮继续。':'先填写想问的问题，下一步可配置密钥。'):'结合画面与拍摄参数，给出具体改进建议。'}</p></div><label class="ai-question-label">想重点了解什么？<span class="weak">选填</span><textarea class="field ai-question" aria-label="想问AI的问题" maxlength="1000" rows="3" placeholder="例如：这张照片拍摄时怎么改进？不填写则做全面点评。">${esc(drafts.get(key)||'')}</textarea></label><div class="ai-examples" aria-label="常见点评问题">${[['整体改进','这张照片拍摄时怎么改进？'],['构图建议','怎样调整构图，让主体更突出？'],['光线曝光','这张照片的光线和曝光可以怎么改进？']].map(([label,question])=>btn(label,'ai-example','ghost',`data-question="${question}"`)).join('')}</div><p class="ai-entry-hint small muted">${native?'原问题会在本机整理为点评要求，下一步可查看。':'下一步确认发送内容。'}此处点击不会直接上传照片。</p><div class="ai-entry-actions">${btn('开始 AI 点评','ai-review','primary full',`data-ids="${key}"`)}${hasSaved?btn('查看上次分析','ai-last','ghost full',`data-ids="${key}"`):''}</div></section>`;
 }
 function promptPreview(){
  const brief=createReviewBrief(pending.note,pending.ids.length===2?'compare':'single');
  return `<details class="ai-prompt-preview"><summary>查看整理后的点评要求</summary><p class="ai-brief-goal">${esc(brief.goal)}</p><p class="small">原问题：${esc(brief.question||'未填写，做全面点评。')}</p><p class="small">重点：${brief.focus.map(esc).join('、')}</p><ol>${brief.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><p class="small muted">保留你的原意，结合画面核实；本机整理不额外调用API。</p></details>`;
 }
 function confirm(){
  dialogFrame('确认 AI 点评',`<div class="ai-upload-summary"><strong>${pending.photos.length===2?'A / B 双图比较':'单张照片点评'}</strong><span>DeepSeek${native?' Flash':''}</span></div><p>将发送所选${pending.photos.length}张照片的压缩副本、相关拍摄参数及你的问题给DeepSeek分析。结果保存在${native?'手机本机':'当前浏览器'}。</p><p class="note" style="margin-top:16px">压缩副本用于构图、光线和选片参考，精确判焦建议由你核对。图片分析会按DeepSeek账户规则计费。</p><div class="form-stack" style="margin-top:16px">${native?`<p class="small muted">使用本机保存的个人密钥。${btn('检查或更换密钥','ai-settings','ghost','data-return="review"')}</p>`:pending.useAccount?'<p class="small muted">使用当前登录账户的AI额度。</p>':`<label>AI访问口令<input type="password" id="ai-access-code" class="field" autocomplete="off" value="${esc(accessCode)}" placeholder="由站点管理员提供，不是DeepSeek密钥"></label>`}<label>这次想问什么<textarea id="ai-note" class="field" maxlength="1000">${esc(pending.note)}</textarea></label>${native?`<div id="ai-prompt-preview">${promptPreview()}</div>`:''}<label class="check ai-consent-label"><input type="checkbox" id="ai-consent" aria-describedby="ai-consent-hint">我同意发送这些照片及参数进行分析</label><p id="ai-consent-hint" class="small muted" role="status">先勾选同意，再点击「确认发送并分析」。</p></div>`,back(pending.ids)+btn('确认发送并分析','ai-submit','primary','disabled'),'ai-review-modal');
 }
 function input(el){
  if(el.matches?.('.ai-question')){drafts.set(el.closest('.ai-entry').dataset.ids,el.value);return true;}
  if(el.id==='ai-note'&&pending){pending.note=el.value;drafts.set(pending.ids.join(','),el.value);const box=document.querySelector('#ai-prompt-preview');if(box){const expanded=box.querySelector('details')?.open;box.innerHTML=promptPreview();if(expanded)box.querySelector('details').open=true;}return true;}
  if(el.id==='ai-consent'){const button=document.querySelector('[data-action="ai-submit"]');if(button)button.disabled=!el.checked;const hint=document.querySelector('#ai-consent-hint');if(hint)hint.textContent=el.checked?'已确认，可以发送分析。':'先勾选同意，再点击「确认发送并分析」。';return true;}
  return false;
 }
 function showResult(saved,persisted=true){
  unsavedResult=persisted?null:saved;
  const result=saved.result,basis={observation:'画面观察',exif:'拍摄参数',inference:'推测'};
  dialogFrame('AI 分析结果',`<p class="note">${esc(result.summary)}</p>${result.preferred?`<p style="margin-top:12px"><strong>选片建议：${result.preferred==='tie'?'两张各有所长':esc(result.preferred)}</strong></p>`:''}<div class="stack" style="margin-top:20px">${result.observations.map(o=>`<article class="panel"><span class="badge">${basis[o.basis]||'推测'}</span><h3>${esc(o.aspect)}</h3><p>${esc(o.text)}</p></article>`).join('')}</div><h3 style="margin-top:20px">下次可以试试</h3><ul>${result.nextSteps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><p class="small muted">${persisted?'已保存到这些照片的复盘记录。':'分析已返回，但本地保存失败。可以重试保存当前结果，无需再次分析。'}AI建议由你自行取舍。</p>${Number.isSafeInteger(result.usage?.total_tokens)?`<p class="small muted">服务返回用量：${result.usage.total_tokens} tokens</p>`:''}`,back(saved.photoIds)+(persisted?'':btn('重试保存结果','ai-save-result','primary')));
 }
 async function persist(saved){const rows=[];for(const id of saved.photoIds){const fresh=await store.get('photos',id);if(fresh)rows.push({...fresh,aiReview:saved});}if(rows.length!==saved.photoIds.length)throw new Error('照片已移除，无法保存分析。');await store.merge({photos:rows});await reload();render();}
 async function open(ids,note){
  cancel();const current=sequence,photos=ids.map(id=>state.photos.find(p=>p.id===id)).filter(Boolean);
  if(photos.length!==ids.length||!photos.length)return toast('照片不存在，请刷新后重试。');
  pending={ids,photos,note};drafts.set(ids.join(','),note);
  if(native){const info=settings.status();if(!info.available||!info.configured){dialogFrame('先配置AI点评',`<p>${info.available?'在AI设置保存自己的DeepSeek API Key，即可分析所选照片。':'请安装支持AI直连的新版APK。'}</p><p class="small muted">照片尚未发送。</p>`,back(ids)+btn('设置 API Key','ai-settings','primary','data-return="review"'));return;}confirm();return;}
  task=new AbortController();dialogFrame('检查AI服务','<p>正在检查服务状态，照片尚未发送。</p>',back(ids));
  let status;try{status=await aiServiceStatus({signal:task.signal});}catch{if(current===sequence)task=null;return;}
  if(current!==sequence)return;task=null;
  if(!status.enabled){dialogFrame('AI 评价 · 尚未启用',`<p>${esc(status.message||'AI尚未启用，照片没有发送。')}</p><p class="small muted" style="margin-top:12px">服务器配置完成后，可从这里分析单张或A/B双图。</p>`,back(ids));return;}
  if(status.accountRequired&&!status.signedIn){dialogFrame('登录后使用AI','<p>管理员已启用账户额度管理，请先登录，再返回照片主动分析。</p><p><a href="/account/">前往账户登录</a></p>',back(ids));return;}
  pending.useAccount=!!status.signedIn;pending.csrfToken=status.csrfToken||'';confirm();
 }
 async function dispatch(el){
  const name=el.dataset.action;
  if(name==='ai-example'){const field=el.closest('.ai-entry')?.querySelector('.ai-question');if(field){field.value=el.dataset.question;input(field);field.focus();}return true;}
  if(native&&name==='ai-settings'&&el.dataset.return==='review'&&pending)pending.note=document.querySelector('#ai-note')?.value??pending.note;
  if(native&&await settings.action(el))return true;
  if(name==='ai-save-result'){if(unsavedResult){const saved=unsavedResult;try{await persist(saved);showResult(saved);}catch(error){toast(error.message||'结果保存失败，请保留当前页面后重试。');}}return true;}
  if(name==='ai-back'){cancel();const ids=el.dataset.ids.split(',');if(ids.length===2){state.selected=ids;showCompare();}else showPhoto(ids[0]);return true;}
  if(name==='ai-review'){await open(el.dataset.ids.split(','),el.closest('.ai-entry')?.querySelector('.ai-question')?.value||'');return true;}
  if(name==='ai-last'){cancel();const saved=state.photos.find(p=>p.id===el.dataset.ids.split(',')[0])?.aiReview;if(validSaved(saved))showResult(saved);else toast('上次分析记录不可用，请重新分析。');return true;}
  if(name==='ai-retry'){cancel();if(pending)confirm();return true;}
  if(name!=='ai-submit')return false;
  if(!pending||task)return true;
  if(!document.querySelector('#ai-consent')?.checked){toast('请先确认同意发送所选照片。');return true;}
  if(!native&&!pending.useAccount){accessCode=document.querySelector('#ai-access-code').value.trim();if(!accessCode){toast('请输入站点管理员提供的AI访问口令。');return true;}}
  pending.note=document.querySelector('#ai-note').value;drafts.set(pending.ids.join(','),pending.note);
  const current=sequence,details=pending;let running;
  try{
   running=createAiTask({timeoutMs:ctx.aiTimeoutMs||65000,onElapsed:seconds=>{if(current!==sequence)return;const status=document.querySelector('#ai-progress');if(status)status.textContent=`已等待 ${seconds} 秒。${seconds>=15?'仍在等待服务响应，可返回取消；不会自动重试。':'正在准备照片并请求分析…'}`;}});task=running;const signal=running.signal;
   dialogFrame('正在分析照片','<div class="ai-working" role="status" aria-live="polite"><span class="ai-working-dot" aria-hidden="true"></span><p id="ai-progress">正在准备照片并请求分析…</p></div><p class="small muted" style="margin-top:12px">返回或关闭可取消本地等待；已经发出的分析仍可能计费。</p>',back(details.ids),'ai-review-modal');
   const session=state.sessions.find(s=>s.id===details.photos[0]?.sessionId),request=buildEvaluationRequest(details.photos,{session,note:details.note,catalog:ctx.catalog?.()});
   const provider=native?createNativeProvider({service,signal,consent:true}):createHttpProvider({photos:details.photos,accessCode:details.useAccount?null:accessCode,csrfToken:details.csrfToken,signal});
   const result=await requestEvaluation(request,{provider});
   if(result.status!=='ok')throw new Error(result.message||'AI服务尚未启用。');
   if(current!==sequence)return;
   const saved={result,photoIds:details.ids,note:details.note,at:new Date().toISOString()};let persisted=true;
   try{await persist(saved);}catch{persisted=false;}
   if(current===sequence)showResult(saved,persisted);
  }catch(error){if(current===sequence)showFailure(error,details.ids,running?.timedOut);}
  finally{running?.dispose();if(current===sequence)task=null;}
  return true;
 }
 function showFailure(error,ids,timedOut=false){
  const code=timedOut?'AI_TIMEOUT':/^[A-Z][A-Z0-9_]{2,60}$/.test(error?.code||'')?error.code:'AI_REQUEST_FAILED';
  const message=timedOut?'分析等待超时，可检查网络后重新发起。':error instanceof TypeError?'分析未能启动，请检查AI设置或更新Android System WebView。':error?.message||'分析未完成，请检查AI设置后重试。';
  dialogFrame('这次分析未完成',`<p class="error-banner" role="alert">${esc(message)}</p><p class="small muted ai-error-code">错误码：${code}</p><p class="small muted">本地照片与手动复盘仍保留，不会自动重试。重新填写后会再次确认上传。</p>`,(ids?.length?back(ids):btn('关闭','close'))+(native?btn('AI 设置','ai-settings','ghost','data-return="review"'):'')+(pending?btn('重新填写','ai-retry','primary'):''),'ai-review-modal');
 }
 async function action(el){
  if(!el.dataset.action?.startsWith('ai-'))return false;
  try{return await dispatch(el);}catch(error){cancel();showFailure(error,pending?.ids||el.dataset.ids?.split(','));return true;}
 }
 return {entry,action,input,cancel,settingsEntry:()=>native?settings.entry():''};
}
