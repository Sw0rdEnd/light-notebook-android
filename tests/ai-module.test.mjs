import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createAiModule} from '../app/src/main/assets/www/ai-module.js';
import {newReviewRecord,cleanReviewRecord} from '../app/src/main/assets/www/ai-history.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('independent review module filters history, safely opens deleted-photo snapshots and prefills a new review',async()=>{
 const window=new Window();Object.defineProperty(globalThis,'window',{value:window,configurable:true});Object.defineProperty(globalThis,'document',{value:window.document,configurable:true});const d=window.document;d.body.innerHTML='<main id="app"></main><dialog id="modal"></dialog>';
 const photos=[{id:'old-a',name:'<img src=x onerror=alert(1)>.jpg',exif:{focal:35}},{id:'old-b',name:'B.jpg',exif:{}}],req={requestId:'request-one',mode:'single',note:'第一次构图问题',photos:[{id:'old-a',label:'A'}]},r=newReviewRecord(req,photos),req2={requestId:'request-two',mode:'compare',note:'比较光线',photos:[{id:'old-a',label:'A'},{id:'old-b',label:'B'}]},r2=newReviewRecord(req2,photos);
 const record=cleanReviewRecord({...r,createdAt:'2026-10-20T12:00:00Z',finishedAt:'2026-10-20T12:01:00Z',status:'success',result:{schema:'light-journal.ai-result.v1',requestId:req.requestId,status:'ok',summary:'<script>unsafe</script>',observations:[{aspect:'构图',basis:'observation',text:'观察文字'}],nextSteps:['移动机位'],preferred:null}}),failed=cleanReviewRecord({...r2,createdAt:'2026-10-21T12:00:00Z',finishedAt:'2026-10-21T12:01:00Z',status:'failed',error:{code:'AI_TIMEOUT',message:'等待超时'}});
 const state={photos:[],aiReviews:[record,failed],tab:'reviews'},drafts=new Map();let module;
 const ctx={state,esc,btn:(label,action,cls='',attrs='')=>`<button data-action="${action}" class="${cls}" ${attrs}>${label}</button>`,url:()=>'',toast(){},reload:async()=>{},showPhoto(){throw new Error('Deleted photo must not open');},closeDialog:()=>d.querySelector('#modal').removeAttribute('open'),dialogFrame:(title,body,foot)=>{d.querySelector('#modal').innerHTML=`<h2>${title}</h2>${body}${foot}`;d.querySelector('#modal').setAttribute('open','');},render:()=>d.querySelector('#app').innerHTML=module.page(),aiUI:{native:true,entry:()=>'<p>点评表单</p>',unsavedId:()=>null,getDraft:ids=>drafts.get(ids.join(',')),setDraft:(ids,note)=>drafts.set(ids.join(','),note),stop:async()=>{}}};
 module=createAiModule(ctx);const input=(id,value)=>{const el=d.getElementById(id);el.value=value;assert.equal(module.input(el),true);};
 try{
  ctx.render();assert.equal(d.querySelectorAll('.ai-history-card').length,2);assert.equal(d.querySelectorAll('script,img').length,0);
  input('ai-history-mode','compare');assert.equal(d.querySelectorAll('.ai-history-card').length,1);input('ai-history-status','success');assert.equal(d.querySelectorAll('.ai-history-card').length,0);
  await module.action({dataset:{action:'ai-history-reset'}});input('ai-history-from','2026-10-21');assert.equal(d.querySelectorAll('.ai-history-card').length,1);input('ai-history-to','2026-10-20');assert.match(d.querySelector('.error-banner').textContent,/开始日期不能晚于/);
  await module.action({dataset:{action:'ai-history-reset'}});input('ai-history-search','第一次构图');assert.equal(d.querySelectorAll('.ai-history-card').length,1);await module.action(d.querySelector('.ai-history-card'));assert.match(d.querySelector('#modal').textContent,/原照片已移除/);assert.match(d.querySelector('#modal').textContent,/<script>unsafe/);assert.equal(d.querySelectorAll('script,img').length,0);assert.equal(d.querySelector('[data-action="ai-history-photo"]'),null);
  await module.action({dataset:{action:'ai-history-repeat',id:record.id}});assert.equal(state.tab,'reviews');assert.equal(module.ui.composing,true);assert.deepEqual(module.ui.ids,[]);assert.equal(module.ui.note,'第一次构图问题');assert.equal(d.querySelector('#modal').hasAttribute('open'),false);
 }finally{await window.happyDOM.abort();}
});
