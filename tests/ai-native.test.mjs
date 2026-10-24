import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {nativeAiRequest,nativeAiStatus,nativeEvaluationPayload} from '../app/src/main/assets/www/ai-native.js';
import {createAiUI} from '../app/src/main/assets/www/ai-ui.js';
import {makeBackup} from '../app/src/main/assets/www/backup.js';

const FAKE_KEY='unit-test-key-never-a-real-credential';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(){const window=new Window({url:'https://appassets.androidplatform.net/assets/index.html'});Object.defineProperty(globalThis,'window',{value:window,configurable:true});Object.defineProperty(globalThis,'document',{value:window.document,configurable:true});return window;}
const result=(request,compare=true)=>({schema:'light-journal.ai-result.v1',requestId:request.requestId,status:'ok',summary:'<img src=x onerror=alert(1)>',observations:[{aspect:'构图',basis:'observation',text:'A中的主体更集中'}],nextSteps:['向左移动半步再拍一张'],preferred:compare?'A':null,usage:{total_tokens:92}});

test('native RPC correlates async replies, strips status secrets and only sends selected local IDs',async()=>{
 const window=page(),calls=[];
 globalThis.AndroidAi={status:()=>JSON.stringify({configured:true,apiKey:FAKE_KEY,model:'untrusted-model'}),request:(id,action,input)=>{calls.push({id,action,payload:JSON.parse(input)});window.dispatchEvent(new window.CustomEvent('android-ai-result',{detail:{id:'unrelated',ok:true,data:'wrong'}}));setTimeout(()=>window.dispatchEvent(new window.CustomEvent('android-ai-result',{detail:{id,ok:true,data:{configured:true}}})),0);},cancel(){}};
 try{
  assert.deepEqual(nativeAiStatus(),{available:true,configured:true,unreadable:false,model:'deepseek-flash'});
  assert.equal((await nativeAiRequest('configure',{apiKey:FAKE_KEY})).configured,true);assert.equal(calls.length,1);
  const request={schema:'light-journal.ai-evaluation.v1',requestId:'request-123',mode:'compare',note:'选择哪张',learningContext:null,photos:[{id:'a',label:'A',filename:'PRIVATE_FILE',exif:{GPS:'PRIVATE_GPS'},localPreview:{file:'PRIVATE_PATH'}},{id:'b',label:'B'}]};
  assert.throws(()=>nativeEvaluationPayload(request,false));const payload=nativeEvaluationPayload(request,true);
  assert.deepEqual(payload.request.photos,[{id:'a',label:'A'},{id:'b',label:'B'}]);assert.equal(JSON.stringify(payload).includes('PRIVATE_'),false);
 }finally{delete globalThis.AndroidAi;await window.happyDOM.abort();}
});

test('native RPC aborts and times out without keeping listeners or accepting late results',async()=>{
 const window=page(),ids=[],cancelled=[];globalThis.AndroidAi={request:id=>ids.push(id),cancel:id=>cancelled.push(id)};
 try{
  const controller=new AbortController(),pending=nativeAiRequest('evaluate',{}, {signal:controller.signal});controller.abort();await assert.rejects(pending,/取消/);
  window.dispatchEvent(new window.CustomEvent('android-ai-result',{detail:{id:ids[0],ok:true,data:'late'}}));assert.deepEqual(cancelled,[ids[0]]);
  await assert.rejects(nativeAiRequest('test',{}, {timeoutMs:10}),/超时/);assert.equal(cancelled.length,2);
  const early=new AbortController();early.abort();await assert.rejects(nativeAiRequest('test',{}, {signal:early.signal}),/取消/);assert.equal(ids.length,2);
  delete globalThis.AndroidAi;assert.equal(nativeAiStatus().available,false);await assert.rejects(nativeAiRequest('test'),/新版APK/);
 }finally{delete globalThis.AndroidAi;await window.happyDOM.abort();}
});

function harness({configured=false,failSave=false,evaluate,aiTimeoutMs}={}){
 const window=page(),document=window.document,actions=[],records=new Map(['a','b'].map(id=>[id,{id,name:'PRIVATE_'+id+'.jpg',preview:{nativeFile:id+'.jpg'},thumb:null,exif:{camera:'A7C II',GPS:'PRIVATE_GPS'},tags:[],reasons:[],importedAt:'2026-10-24T00:00:00Z'}]));
 let keyConfigured=configured,mergeFails=failSave;
 const state={photos:[...records.values()],sessions:[],settings:[]},store={all:async name=>name==='photos'?[...records.values()]:[],get:async(_name,id)=>records.get(id),merge:async({photos})=>{if(mergeFails)throw new Error('本地写入失败');for(const p of photos)records.set(p.id,p);}};
 const service={status:()=>({available:true,configured:keyConfigured,model:'deepseek-flash'}),request:async(action,payload,options)=>{
  actions.push({action,payload});if(action==='configure'){assert.equal(payload.apiKey,FAKE_KEY);keyConfigured=true;return {configured:true};}if(action==='test')return {message:'密钥与模型检查通过，尚未发送照片。'};if(action==='forget'){keyConfigured=false;return {configured:false};}
  if(evaluate)return evaluate(payload,options);records.set('a',{...records.get('a'),tags:['分析期间保留的新标签']});return result(payload.request,payload.request.mode==='compare');
 }};
 const ui=createAiUI({state,store,nativeService:service,aiTimeoutMs,esc,btn:(label,action,cls='',attrs='')=>`<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`,dialogFrame:(title,body,foot)=>{document.body.innerHTML=`<h2>${esc(title)}</h2>${body}${foot}`;},toast:message=>{const p=document.createElement('p');p.className='toast';p.textContent=message;document.body.append(p);},render(){},reload:async()=>state.photos=[...records.values()],showPhoto(){document.body.innerHTML='<p>返回照片</p>';},showCompare(){document.body.innerHTML='<p>返回双图</p>';}});
 const el=(action,extra={})=>({dataset:{action,ids:'a,b',...extra},closest:()=>null});
 return {window,document,ui,actions,records,store,state,el,allowSave:()=>{mergeFails=false;}};
}

test('native settings configure, test and remove keys without echoing them or putting them in photo backups',async()=>{
 const h=harness();try{
  await h.ui.action(h.el('ai-review'));assert.match(h.document.body.textContent,/先配置/);assert.equal(h.actions.length,0);
  await h.ui.action(h.el('ai-settings',{return:'review'}));h.document.querySelector('#ai-api-key').value=FAKE_KEY;await h.ui.action(h.el('ai-key-save'));
  assert.deepEqual(h.actions.map(x=>x.action),['configure','test']);assert.equal(h.document.querySelector('#ai-api-key').value,'');assert.equal(h.document.body.innerHTML.includes(FAKE_KEY),false);
  await h.ui.action(h.el('ai-settings-back'));assert.ok(h.document.querySelector('#ai-consent'));assert.equal(h.document.querySelector('#ai-consent').checked,false);
  h.document.querySelector('#ai-note').value='保留正在编辑的问题';await h.ui.action(h.el('ai-settings',{return:'review'}));await h.ui.action(h.el('ai-settings-back'));assert.equal(h.document.querySelector('#ai-note').value,'保留正在编辑的问题');
  const backup=await makeBackup(h.store,false);assert.equal(JSON.stringify(backup).includes(FAKE_KEY),false);
  await h.ui.action(h.el('ai-settings'));await h.ui.action(h.el('ai-key-remove'));await h.ui.action(h.el('ai-key-remove-confirm'));assert.match(h.ui.settingsEntry(),/尚未配置/);assert.equal(h.records.size,2);
 }finally{h.ui.cancel();await h.window.happyDOM.abort();}
});

test('native analysis requires consent, preserves fresh photo edits, escapes output and reopens saved results without another call',async()=>{
 const h=harness({configured:true});try{
  await h.ui.action(h.el('ai-review'));await h.ui.action(h.el('ai-submit'));assert.equal(h.actions.length,0);
  h.document.querySelector('#ai-consent').checked=true;await h.ui.action(h.el('ai-submit'));
  assert.equal(h.actions.length,1);assert.equal(h.actions[0].action,'evaluate');assert.deepEqual(h.actions[0].payload.request.photos,[{id:'a',label:'A'},{id:'b',label:'B'}]);assert.equal(JSON.stringify(h.actions[0].payload).includes('PRIVATE_'),false);
  assert.equal(h.document.querySelectorAll('img').length,0);assert.match(h.document.body.textContent,/<img src=x/);assert.deepEqual(h.records.get('a').tags,['分析期间保留的新标签']);assert.equal(h.records.get('a').aiReview.result.preferred,'A');assert.equal(h.records.get('b').aiReview.result.usage.total_tokens,92);
  const backup=await makeBackup(h.store,false);assert.equal(backup.photos[0].aiReview.result.status,'ok');assert.equal(JSON.stringify(backup).includes(FAKE_KEY),false);
  await h.ui.action(h.el('ai-last'));assert.equal(h.actions.length,1);assert.match(h.document.body.textContent,/92 tokens/);
 }finally{h.ui.cancel();await h.window.happyDOM.abort();}
});

test('native result save retry never repeats paid analysis and failed native requests never fabricate a saved review',async()=>{
 const h=harness({configured:true,failSave:true});try{
  await h.ui.action(h.el('ai-review',{ids:'a'}));h.document.querySelector('#ai-consent').checked=true;await h.ui.action(h.el('ai-submit',{ids:'a'}));assert.equal(h.actions.length,1);assert.ok(h.document.querySelector('[data-action="ai-save-result"]'));assert.equal(h.records.get('a').aiReview,undefined);
  h.allowSave();await h.ui.action(h.el('ai-save-result',{ids:'a'}));assert.equal(h.actions.length,1);assert.equal(h.records.get('a').aiReview.result.preferred,null);assert.equal(h.document.querySelector('[data-action="ai-save-result"]'),null);
 }finally{h.ui.cancel();await h.window.happyDOM.abort();}
 const f=harness({configured:true,evaluate:async()=>{throw new Error('DeepSeek余额不足，请检查账户余额。');}});try{
  await f.ui.action(f.el('ai-review'));f.document.querySelector('#ai-consent').checked=true;await f.ui.action(f.el('ai-submit'));assert.match(f.document.body.textContent,/余额不足/);assert.equal(f.records.get('a').aiReview,undefined);assert.equal(f.actions.length,1);
 }finally{f.ui.cancel();await f.window.happyDOM.abort();}
});

test('cancelled native analysis cannot reopen its modal or save a late result',async()=>{
 let complete,started;const entered=new Promise(resolve=>started=resolve);
 const h=harness({configured:true,evaluate:payload=>new Promise(resolve=>{complete=()=>resolve(result(payload.request));started();})});
 try{
  await h.ui.action(h.el('ai-review'));h.document.querySelector('#ai-consent').checked=true;const pending=h.ui.action(h.el('ai-submit'));await entered;
  await h.ui.action(h.el('ai-back'));assert.match(h.document.body.textContent,/返回双图/);complete();await pending;assert.equal(h.records.get('a').aiReview,undefined);assert.match(h.document.body.textContent,/返回双图/);
 }finally{h.ui.cancel();await h.window.happyDOM.abort();}
});

test('visible review action works without AbortSignal statics and previews edited intent before consent',async()=>{
 const h=harness({configured:true}),any=Object.getOwnPropertyDescriptor(AbortSignal,'any'),timeout=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
 Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
 try{
  h.document.body.innerHTML=h.ui.entry(['a']);const question=h.document.querySelector('.ai-question');question.value='构图和背景怎么改进？';h.ui.input(question);
  await h.ui.action(h.document.querySelector('[data-action="ai-review"]'));assert.match(h.document.body.textContent,/确认 AI 点评/);assert.equal(h.document.querySelector('#ai-note').value,question.value);assert.equal(h.document.querySelector('[data-action="ai-submit"]').disabled,true);assert.equal(h.actions.length,0);
  const note=h.document.querySelector('#ai-note');note.value='后期怎么裁切？<img src=x>';h.document.querySelector('.ai-prompt-preview').open=true;h.ui.input(note);assert.match(h.document.querySelector('#ai-prompt-preview').textContent,/后期与裁切/);assert.equal(h.document.querySelector('details').open,true);assert.equal(h.document.querySelectorAll('img').length,0);
  const consent=h.document.querySelector('#ai-consent');consent.checked=true;h.ui.input(consent);assert.equal(h.document.querySelector('[data-action="ai-submit"]').disabled,false);
  await h.ui.action(h.document.querySelector('[data-action="ai-submit"]'));assert.equal(h.actions.length,1);assert.equal(h.actions[0].payload.request.note,note.value);assert.match(h.document.body.textContent,/已保存到这些照片/);
 }finally{Object.defineProperty(AbortSignal,'any',any);Object.defineProperty(AbortSignal,'timeout',timeout);h.ui.cancel();await h.window.happyDOM.abort();}
});

test('startup exception is visible in the review modal and a subsequent request is not stuck',async()=>{
 const h=harness({configured:true}),randomUUID=crypto.randomUUID;
 try{
  await h.ui.action(h.el('ai-review',{ids:'a'}));h.document.querySelector('#ai-note').value='怎样改善光线？';h.document.querySelector('#ai-consent').checked=true;
  crypto.randomUUID=()=>{throw new TypeError('synthetic startup failure');};await h.ui.action(h.el('ai-submit',{ids:'a'}));assert.equal(h.actions.length,0);assert.match(h.document.querySelector('[role="alert"]').textContent,/分析未能启动/);assert.match(h.document.body.textContent,/错误码：AI_REQUEST_FAILED/);
  crypto.randomUUID=randomUUID;await h.ui.action(h.el('ai-retry',{ids:'a'}));assert.equal(h.document.querySelector('#ai-note').value,'怎样改善光线？');assert.equal(h.document.querySelector('#ai-consent').checked,false);
  h.document.querySelector('#ai-consent').checked=true;await h.ui.action(h.el('ai-submit',{ids:'a'}));assert.equal(h.actions.length,1);assert.equal(h.records.get('a').aiReview.result.status,'ok');
 }finally{crypto.randomUUID=randomUUID;h.ui.cancel();await h.window.happyDOM.abort();}
});

test('review timeout gives a visible error and a retry only starts after another consent',async()=>{
 const h=harness({configured:true,aiTimeoutMs:20,evaluate:(_payload,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('interrupted')),{once:true}))});
 try{await h.ui.action(h.el('ai-review'));h.document.querySelector('#ai-note').value='保持我的原问题';h.document.querySelector('#ai-consent').checked=true;await h.ui.action(h.el('ai-submit'));assert.match(h.document.querySelector('[role="alert"]').textContent,/超时/);assert.match(h.document.body.textContent,/AI_TIMEOUT/);assert.equal(h.actions.length,1);assert.equal(h.records.get('a').aiReview,undefined);await h.ui.action(h.el('ai-retry'));assert.equal(h.document.querySelector('#ai-consent').checked,false);assert.equal(h.document.querySelector('#ai-note').value,'保持我的原问题');assert.equal(h.actions.length,1);}
 finally{h.ui.cancel();await h.window.happyDOM.abort();}
});
