import {validateEvaluationResult} from './ai.js';
import {createReviewBrief} from './ai-prompt.js';

export const REVIEW_SCHEMA='light-journal.ai-review.v1';
export const REVIEW_STATUSES={running:'未完成',success:'已完成',failed:'未完成分析',cancelled:'已取消',interrupted:'已中断'};
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);
const date=value=>typeof value==='string'&&value.length<=64&&Number.isFinite(Date.parse(value));
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const copy=value=>JSON.parse(JSON.stringify(value));
const now=()=>new Date().toISOString();
function parameters(value){
 const out={};for(const key of ['camera','make','lens','takenAt'])if(typeof value?.[key]==='string')out[key]=value[key].slice(0,300);
 for(const key of ['focal','focal35','aperture','exposure','iso'])if(Number.isFinite(value?.[key])&&value[key]>0&&value[key]<1e8)out[key]=value[key];return out;
}
function snapshot(photo,label){
 const corrections=parameters(photo?.corrections);
 if(photo?.corrections?.body?.model)corrections.camera=String(photo.corrections.body.model).slice(0,300);
 if(photo?.corrections?.lens?.model)corrections.lens=String(photo.corrections.lens.model).slice(0,300);
 return {id:photo.id,label,name:String(photo.name||photo.filename||'已移除的照片').slice(0,500),exif:parameters(photo.exif),corrections};
}
function cleanResult(value,requestId,count){
 const result=validateEvaluationResult(value,{requestId});
 if(result.status!=='ok'||result.observations.length<1||result.observations.length>12||result.nextSteps.length<1||result.nextSteps.length>6||count===1&&result.preferred!==null||result.observations.some(o=>!text(o.aspect,80)))throw new Error('点评结果记录无效。');
 const out={schema:result.schema,requestId,status:'ok',summary:result.summary,observations:result.observations.map(({aspect,basis,text})=>({aspect,basis,text})),nextSteps:[...result.nextSteps],preferred:result.preferred};
 const usage={};for(const key of ['prompt_tokens','completion_tokens','total_tokens'])if(Number.isSafeInteger(result.usage?.[key])&&result.usage[key]>=0)usage[key]=result.usage[key];if(Object.keys(usage).length)out.usage=usage;return out;
}
function cleanBrief(value,note,mode){
 if(value==null)return createReviewBrief(note,mode);
 if(value.schema!=='light-journal.ai-brief.v1'||!text(value.question,1000)||!text(value.goal,500)||!Array.isArray(value.focus)||value.focus.length>8||value.focus.some(v=>!text(v,100))||!Array.isArray(value.steps)||value.steps.length>8||value.steps.some(v=>!text(v,1000)))throw new Error('点评要求快照无效。');
 return {schema:value.schema,question:value.question,goal:value.goal,focus:[...value.focus],steps:[...value.steps]};
}
export function cleanReviewRecord(value){
 if(!value||value.schema!==REVIEW_SCHEMA||!safeId(value.id)||!safeId(value.requestId)||!date(value.createdAt)||!Object.prototype.hasOwnProperty.call(REVIEW_STATUSES,value.status)||!['single','compare'].includes(value.mode)||!text(value.note,1000)||!['native','web','legacy'].includes(value.origin)||value.model!=null&&!text(value.model,80)||!Array.isArray(value.photos)||value.photos.length!==(value.mode==='single'?1:2))throw new Error('点评历史记录无效。');
 const seen=new Set();for(const [i,p] of value.photos.entries())if(!p||!safeId(p.id)||seen.has(p.id)||p.label!==(i===0?'A':'B')||!text(p.name,500))throw new Error('点评照片快照无效。');else seen.add(p.id);
 if(value.status==='running'?value.finishedAt!=null:!date(value.finishedAt))throw new Error('点评历史时间无效。');
 const out={schema:REVIEW_SCHEMA,id:value.id,requestId:value.requestId,createdAt:value.createdAt,finishedAt:value.finishedAt||null,timeSource:value.timeSource==='migration'?'migration':'review',status:value.status,mode:value.mode,note:value.note,provider:'DeepSeek',model:value.model||null,origin:value.origin,photos:value.photos.map(p=>snapshot(p,p.label)),brief:cleanBrief(value.brief,value.note,value.mode)};
 if(value.status==='success')out.result=cleanResult(value.result,value.requestId,value.photos.length);
 else if(value.error){if(!text(value.error.code,80)||!text(value.error.message,1000))throw new Error('点评错误记录无效。');out.error={code:value.error.code,message:value.error.message};}
 if(value.legacyKey!=null){if(!text(value.legacyKey,600))throw new Error('旧点评标识无效。');out.legacyKey=value.legacyKey;}
 return out;
}
export function newReviewRecord(request,photos,{origin='native',model=null}={}){
 return cleanReviewRecord({schema:REVIEW_SCHEMA,id:'review-'+crypto.randomUUID(),requestId:request.requestId,createdAt:now(),finishedAt:null,status:'running',mode:request.mode,note:request.note,origin,model,photos:request.photos.map((p,i)=>snapshot(photos.find(photo=>photo.id===p.id)||p,i===0?'A':'B'))});
}
function hash(value){let a=2166136261,b=2246822507;for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b^value.charCodeAt(i),3266489909);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
export function legacyReviewRecords(photos,existing=[]){
 const rows=[],all=[...existing],byPhoto=new Map(photos.map(p=>[p.id,p]));
 for(const photo of photos){
  const saved=photo.aiReview;if(!saved?.result||!Array.isArray(saved.photoIds)||saved.photoIds.length<1||saved.photoIds.length>2||saved.photoIds.some(id=>!safeId(id)))continue;
  if(all.some(r=>r.id===saved.reviewId||r.requestId===saved.result.requestId&&r.status==='success'))continue;
  try{
   const key=[saved.result.requestId,saved.at||'',saved.photoIds.join(','),hash(JSON.stringify(saved.result))].join('|');
   if(all.some(r=>r.legacyKey===key))continue;
   let id='legacy-review-'+hash(key);if(all.some(r=>r.id===id))id='legacy-review-'+crypto.randomUUID();
   const at=date(saved.at)?saved.at:now();
   const row=cleanReviewRecord({schema:REVIEW_SCHEMA,id,requestId:saved.result.requestId,createdAt:at,finishedAt:at,timeSource:date(saved.at)?'review':'migration',status:'success',mode:saved.photoIds.length===2?'compare':'single',note:typeof saved.note==='string'?saved.note.slice(0,1000):'',origin:'legacy',model:null,photos:saved.photoIds.map((id,i)=>snapshot(byPhoto.get(id)||{id},i===0?'A':'B')),result:saved.result,legacyKey:key});
   rows.push(row);all.push(row);
  }catch{/* Keep unreadable legacy data on its original photo, never invent a result. */}
 }
 return rows;
}
export async function migrateReviewHistory(store){
 const [photos,existing]=await Promise.all([store.all('photos'),store.all('aiReviews')]);
 const interrupted=[];for(const record of existing)if(record.status==='running')try{interrupted.push(cleanReviewRecord({...record,status:'interrupted',finishedAt:now(),error:{code:'AI_INTERRUPTED',message:'上次分析未确认完成，已发出的请求仍可能计费。'}}));}catch{}
 const legacy=legacyReviewRecords(photos,existing);if(interrupted.length||legacy.length)await store.merge({aiReviews:[...interrupted,...legacy]});
}
export function createReviewJournal(store){
 let queue=Promise.resolve();
 const serial=operation=>{const next=queue.then(operation);queue=next.catch(()=>{});return next;};
 return {
  start(record){return serial(async()=>{const row=cleanReviewRecord(record);if(await store.get('aiReviews',row.id))throw new Error('点评记录标识重复，请重新发起。');await store.put('aiReviews',row);return copy(row);});},
  finish(record,patch,{isCurrent=()=>true}={}){return serial(async()=>{
   const old=await store.get('aiReviews',record.id);if(!old)throw new Error('点评历史已移除，当前结果尚未保存。');
   if(['success','failed','cancelled'].includes(old.status))return old;
   if(!isCurrent())return null;
   const row=cleanReviewRecord({...old,...patch,finishedAt:now()}),photos=[];
   if(row.status==='success')for(const p of row.photos){const fresh=await store.get('photos',p.id);if(fresh)photos.push({...fresh,aiReview:{reviewId:row.id,result:row.result,photoIds:row.photos.map(p=>p.id),note:row.note,at:row.finishedAt}});}
   if(!isCurrent())return null;
   await store.merge({aiReviews:[row],photos});return row;
  });},
  flush(){return queue;}
 };
}
