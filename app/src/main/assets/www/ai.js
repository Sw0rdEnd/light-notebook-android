import {nativeCall} from './native.js';
import {photoEquipment} from './equipment.js';
export const AI_REQUEST_SCHEMA='light-journal.ai-evaluation.v1';
export const AI_RESULT_SCHEMA='light-journal.ai-result.v1';
export function buildEvaluationRequest(photos,{session=null,note='',catalog}={}){
 if(!Array.isArray(photos)||photos.length<1||photos.length>2)throw new Error('请选择 1 至 2 张照片。');
 return {schema:AI_REQUEST_SCHEMA,requestId:crypto.randomUUID(),createdAt:new Date().toISOString(),mode:photos.length===2?'compare':'single',equipment:session?.equipment||null,evidenceRules:{exif:'原始文件元数据，不据此断言照片好坏',corrections:'用户修正，与EXIF分开',observation:'可从画面观察的事实',inference:'模型推测必须明确标注'},learningContext:session?{theme:session.theme,scene:session.scene,tasks:session.tasks.map(t=>({title:t.title,purpose:t.purpose})),summary:session.summary}:null,note:String(note).slice(0,1000),photos:photos.map((p,i)=>{const equipment=photoEquipment(p,catalog);return {id:p.id,label:i?'B':'A',filename:p.name,width:p.width,height:p.height,exif:{...p.exif},equipment:{body:equipment.body,lens:equipment.lens},corrections:{...p.corrections},reviewNote:p.reviewNote||'',localPreview:{available:!!p.preview,file:p.preview?.nativeFile||null,mime:'image/jpeg'},userMarks:{liked:!!p.liked,improve:!!p.improve,star:!!p.star,cull:p.cull||'undecided',tags:[...(p.tags||[])],reasons:[...(p.reasons||[])]}};})};
}
export function validateEvaluationResult(result,request){
 if(result?.schema!==AI_RESULT_SCHEMA||result.requestId!==request.requestId)throw new Error('AI 评价返回的数据不匹配。');
 if(result.status==='not_configured')return result;
 if(result.status!=='ok'||typeof result.summary!=='string'||result.summary.length>5000||!Array.isArray(result.observations)||result.observations.length>20||result.observations.some(o=>!o||typeof o.aspect!=='string'||typeof o.text!=='string'||o.text.length>3000)||!Array.isArray(result.nextSteps)||result.nextSteps.length>10||result.nextSteps.some(t=>typeof t!=='string'||t.length>1000)||!(result.preferred===null||['A','B','tie'].includes(result.preferred)))throw new Error('AI 评价返回格式无效。');
 return {...result,observations:result.observations.map(o=>{if(o.basis!=null&&!['observation','exif','inference'].includes(o.basis))throw new Error('AI 评价证据类别无效。');return {...o,basis:o.basis||'inference'};})};
}
export async function requestEvaluation(request,{provider}={}){
 const result=provider?await provider.evaluate(request):globalThis.AndroidStorage?nativeCall('aiEvaluate',{request}):{schema:AI_RESULT_SCHEMA,requestId:request.requestId,status:'not_configured',code:'AI_NOT_CONFIGURED',message:'AI 评价服务尚未接入，照片没有发送。'};
 return validateEvaluationResult(result,request);
}
