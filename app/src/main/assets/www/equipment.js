import {SEED_CATALOG,CATALOG_REVISION} from './equipment-data.js';
export const MOUNTS=['Sony E','Sony A','Canon RF','Canon EF','Nikon Z','Nikon F','Fujifilm X','Fujifilm G','L-Mount','Micro Four Thirds','内置','未知'];
export function catalogRecords(updates=[]) {const map=new Map(SEED_CATALOG.map(r=>[r.id,r]));for(const r of updates)if(!map.has(r.id)||r.revision>map.get(r.id).revision)map.set(r.id,r);return [...map.values()];}
export function compatibility(body,lens) {
  if(body?.type==='phone'&&!lens)return {kind:'native',text:'手机内置拍摄系统；倍率是否为光学焦距需按手机型号确认。',crop:body.crop||null};
  if(!body||!lens||!body.mount||!lens.mount||[body.mount,lens.mount].includes('未知'))return {kind:'unknown',text:'尚未核实：缺少机身、镜头、卡口或画幅信息。',crop:null};
  if(body.mount!==lens.mount){const adapter={'Canon RF:Canon EF':'EF-EOS R','Nikon Z:Nikon F':'FTZ / FTZ II','Sony E:Sony A':'LA-EA 系列'}[`${body.mount}:${lens.mount}`];return {kind:adapter?'adapter':'unknown',text:adapter?`需转接：${adapter}。须逐项核实具体机身、镜头与转接环，不保证自动对焦、防抖和全部功能。`:'尚未核实：卡口不同，不能原生安装；本资料库未确认可用转接方案。',crop:null};}
  if(!body.crop||!lens.crop)return {kind:'unknown',text:'同卡口，但画幅覆盖尚未核实。',crop:null};
  if(body.provenance==='manual'||lens.provenance==='manual'||body.provenance==='user-import'||lens.provenance==='user-import')return {kind:'unknown',text:'卡口信息相同，但资料由用户提供，兼容性尚未核实。',crop:null};
  const crop=Math.max(body.crop,lens.crop);
  return {kind:lens.crop>body.crop?'crop':'native',text:lens.crop>body.crop?'裁切使用：镜头像场小于机身画幅，按裁切视角换算；实际裁切模式须在机身确认。':'原生兼容：卡口一致，镜头像场覆盖机身画幅；具体功能仍依赖固件和厂商兼容列表。',crop};
}
export function focalPractice(body,lens) {
  const check=compatibility(body,lens);if(!lens?.focal)return {check,actual:'未知',equivalent:'未知',points:[]};
  const [low,high]=lens.focal,range=(a,b)=>a===b?`${a}mm`:`${a}–${b}mm`;
  const points=[...new Set([low,...[24,35,50,85,135].filter(n=>n>low&&n<high),high])];
  return {check,actual:range(low,high),equivalent:check.crop?range(+(low*check.crop).toFixed(1),+(high*check.crop).toFixed(1)):'尚未核实',points};
}
const normalize=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9]/g,'');
export function matchExif(exif={},catalog=SEED_CATALOG) {
  const find=(raw,type)=>!raw?[]:catalog.filter(r=>r.type===type&&[r.model,...(r.aliases||[])].some(a=>normalize(a)===normalize(raw)));
  const bodies=find(exif.camera,'body'),body=bodies.length===1?bodies[0]:null;
  let lenses=find(exif.lens,'lens');if(body&&lenses.length>1){const native=lenses.filter(l=>l.mount===body.mount);if(native.length===1)lenses=native;}
  return {body,lens:lenses.length===1?lenses[0]:null,bodyCandidates:bodies.map(r=>r.id),lensCandidates:lenses.map(r=>r.id)};
}
export function photoEquipment(photo,catalog=SEED_CATALOG) {
  const match=matchExif(photo.exif,catalog),c=photo.corrections||{};
  return {body:c.bodyId==='unidentified'?null:c.body||catalog.find(r=>r.id===c.bodyId)||match.body,lens:c.lensId==='unidentified'?null:c.lens||catalog.find(r=>r.id===c.lensId)||match.lens,match};
}
export function defaultEquipment(equipment,kits,defaultId) {
  const kit=kits.find(k=>k.id===defaultId);if(!kit)return null;
  const body=equipment.find(e=>e.id===kit.bodyId&&e.active&&e.ownership==='owned'),lens=equipment.find(e=>e.id===kit.lensId&&e.active&&e.ownership==='owned');
  if(!body||body.snapshot.type!=='phone'&&!lens)return null;
  const check=compatibility(body.snapshot,lens?.snapshot),manualSameMount=lens&&body.snapshot.mount===lens.snapshot.mount&&body.snapshot.mount!=='未知'&&[body.snapshot,lens.snapshot].some(r=>['manual','user-import'].includes(r.provenance));if(!['native','crop'].includes(check.kind)&&!manualSameMount)return null;
  return {kitId:kit.id,name:kit.name,body:body.snapshot,lens:lens?.snapshot||null,check};
}
export function validateCatalogPackage(data) {
  if(data?.app!=='light-journal-equipment'||data.schema!==1||!Number.isInteger(data.revision)||data.revision<=CATALOG_REVISION||!Array.isArray(data.records)||data.records.length>2000)throw new Error('不是支持的较新设备资料包。');
  const ids=new Set();return data.records.map(r=>{
    if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(r.id)||ids.has(r.id)||!['body','lens','phone'].includes(r.type)||typeof r.model!=='string'||!r.model.trim()||r.model.length>200||typeof r.brand!=='string'||!MOUNTS.includes(r.mount))throw new Error('设备资料条目无效。');ids.add(r.id);
    if(r.crop!=null&&(!Number.isFinite(r.crop)||r.crop<=0||r.crop>10))throw new Error('画幅系数无效。');
    for(const key of ['focal','maxAperture','sensorMm'])if(r[key]!=null&&(!Array.isArray(r[key])||r[key].length!==2||r[key].some(v=>!Number.isFinite(v)||v<=0)))throw new Error('设备数值无效。');
    if(r.focal&&r.focal[0]>r.focal[1])throw new Error('焦距范围无效。');
    if(!Array.isArray(r.sources)||!r.sources.length||r.sources.some(s=>{try{return new URL(s.url).protocol!=='https:';}catch{return true;}}))throw new Error('资料包需要有效的 HTTPS 来源。');
    // Imported assertions never acquire the built-in audited status or image redistribution rights.
    return {...r,aliases:Array.isArray(r.aliases)?r.aliases.filter(s=>typeof s==='string'&&s.length<=200):[],image:{url:null,cacheAllowed:false,rights:'用户导入资料的图片许可尚未审核'},revision:data.revision,provenance:'user-import'};
  });
}
