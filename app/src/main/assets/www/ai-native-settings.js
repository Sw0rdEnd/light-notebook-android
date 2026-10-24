export function createNativeAiSettings(ctx){
 const {service,esc,btn,dialogFrame,toast,render,onOpen,onReviewReturn}=ctx;
 let controller=null,sequence=0,reviewReturn=false;
 const status=()=>{try{return service.status();}catch{return {available:false,configured:false,unreadable:true};}};
 function cancel(){sequence++;controller?.abort();controller=null;const input=document.querySelector('#ai-api-key');if(input)input.value='';}
 function entry(){const info=status();return `<section class="settings-section"><div><h2>AI 摄影点评</h2><p class="weak small">DeepSeek · 个人 API Key</p></div><div class="stack"><div class="ai-settings-status"><span class="badge">${info.configured?'已保存密钥':'尚未配置'}</span><span>单张点评 / 双图比较</span></div><p>在手机中配置自己的DeepSeek密钥。确认分析后，才将所选照片的压缩副本、相关参数和问题发给DeepSeek；结果保存在本机。</p>${btn('AI 设置','ai-settings','primary')}</div></section>`;}
 function show(message='',error=false){
  const info=status();
  dialogFrame('AI 设置',`<div class="ai-config-intro"><span class="eyebrow">DEEPSEEK</span><h3>让照片多一个观察角度</h3><p>使用你自己的API Key，手机直连官方服务。</p></div><div class="ai-config-model"><span>读图模型</span><strong>DeepSeek Flash</strong><small>deepseek-flash</small></div>${!info.available?'<p class="error-banner">请安装支持AI直连的新版APK。</p>':''}${info.unreadable?'<p class="error-banner">原密钥无法读取，请重新保存。</p>':''}<div class="form-stack"><label>API Key<input id="ai-api-key" class="field" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="512" placeholder="${info.configured?'已保存；填写新密钥可替换':'粘贴DeepSeek平台的API Key'}" ${!info.available?'disabled':''}></label><p class="small muted">密钥由Android系统密钥加密保存，不包含在照片备份中。保存后不回显原值。</p><p id="ai-config-message" class="${error?'error-banner':'note'}" role="status" aria-live="polite">${esc(message||(info.configured?'已有本机密钥，可以测试连接或直接返回照片。':'填写密钥后，点击「保存并测试」。连接测试不上传照片。'))}</p></div>${info.configured?`<div class="ai-key-actions">${btn('测试已保存密钥','ai-key-test','ghost')}${btn('移除密钥','ai-key-remove','ghost danger')}</div>`:''}<p class="small muted ai-config-footnote">照片分析会按DeepSeek账户规则计费，应用不自动重试。</p>`,(reviewReturn?btn('返回点评','ai-settings-back','ghost'):btn('完成','close','ghost'))+btn('保存并测试','ai-key-save','primary',!info.available?'disabled':''),'ai-config-modal');
 }
 async function check(save){
  if(controller)return;
  const input=document.querySelector('#ai-api-key'),value=save?input?.value.trim():'',info=status();
  if(save&&!value&&!info.configured){toast('请先填写你的DeepSeek API Key。');return;}
  controller=new AbortController();const signal=controller.signal,current=sequence;
  if(input)input.disabled=true;
  const message=document.querySelector('#ai-config-message');if(message){message.className='note';message.textContent=save&&value?'正在加密保存密钥并检查连接…':'正在检查密钥与模型，照片没有发送…';}
  let saved=false;
  try{
   if(save&&value){await service.request('configure',{apiKey:value},{signal});saved=true;if(input)input.value='';}
   if(current!==sequence)return;
   const result=await service.request('test',{}, {signal});
   if(current===sequence){controller=null;render();show(result.message||'密钥与模型检查通过，尚未发送照片。');}
  }catch(error){if(current===sequence){controller=null;render();show((saved?'密钥已保存。':'')+(error.message||'连接测试未完成，请重试。'),true);}}
  finally{if(input?.isConnected)input.disabled=false;if(current===sequence)controller=null;}
 }
 async function action(el){
  const name=el.dataset.action;
  if(name==='ai-settings'){onOpen();reviewReturn=el.dataset.return==='review';show();return true;}
  if(name==='ai-settings-back'){cancel();await onReviewReturn();return true;}
  if(name==='ai-key-save'){await check(true);return true;}
  if(name==='ai-key-test'){await check(false);return true;}
  if(name==='ai-key-remove'){if(controller)return true;dialogFrame('移除DeepSeek密钥？','<p>移除后，下次分析需要重新填写密钥。已有照片和点评结果会保留。</p>',btn('返回设置','ai-key-remove-cancel')+btn('确认移除','ai-key-remove-confirm','danger'));return true;}
  if(name==='ai-key-remove-cancel'){show();return true;}
  if(name==='ai-key-remove-confirm'){
   if(controller)return true;controller=new AbortController();const current=sequence;
   try{await service.request('forget',{}, {signal:controller.signal});if(current===sequence){controller=null;render();show('本机密钥已移除。');}}
   catch(error){if(current===sequence){controller=null;show(error.message,true);}}
   finally{if(current===sequence)controller=null;}return true;
  }
  return false;
 }
 return {entry,action,cancel,status};
}
