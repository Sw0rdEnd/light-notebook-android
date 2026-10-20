import {membershipId} from './organize.js';
import {validateCatalogPackage} from './equipment.js';
import {CATALOG_REVISION} from './equipment-data.js';
export const EXTRA_STORES=['groups','memberships','imports','equipment','kits','catalog'];
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
const text=(v,max=1000)=>typeof v==='string'&&v.length<=max;
export function validateExtras(data){
 if(data.version===1)return;
 if(data.dataVersion!==2)throw new Error('备份数据版本不受支持，请使用匹配版本的应用。');
 const ids={};
 for(const name of EXTRA_STORES){if(!Array.isArray(data[name])||data[name].length>(name==='memberships'?100000:20000))throw new Error('备份扩展记录无效。');ids[name]=new Set();for(const row of data[name]){if(!row||!safeId(row.id)||ids[name].has(row.id))throw new Error('备份扩展记录 ID 无效或重复。');ids[name].add(row.id);}}
 const photoIds=new Set(data.photos.map(p=>p.id));
 for(const p of data.photos){if(p.cull!=null&&!['keep','undecided','reject'].includes(p.cull)||p.tags!=null&&(!Array.isArray(p.tags)||p.tags.length>20||p.tags.some(t=>!text(t,40)))||p.reviewNote!=null&&!text(p.reviewNote)||p.fingerprint!=null&&!/^[a-f0-9]{64}$/.test(p.fingerprint))throw new Error('照片整理信息损坏。');if(p.corrections!=null&&(typeof p.corrections!=='object'||Array.isArray(p.corrections)))throw new Error('照片修正无效。');for(const kind of ['body','lens'])if(p.corrections?.[kind])validateDevice(p.corrections[kind]);}
 for(const g of data.groups)if(!text(g.name,80)||!g.name.trim()||!text(g.description||'',500)||!Number.isFinite(g.order)||g.coverPhotoId!=null&&!photoIds.has(g.coverPhotoId))throw new Error('分组信息损坏。');
 for(const m of data.memberships)if(!ids.groups.has(m.groupId)||!photoIds.has(m.photoId)||m.id!==membershipId(m.groupId,m.photoId))throw new Error('分组关联缺失或损坏。');
 for(const g of data.groups)if(g.coverPhotoId&&!data.memberships.some(m=>m.groupId===g.id&&m.photoId===g.coverPhotoId))throw new Error('分组封面不属于该分组。');
 for(const e of data.equipment){if(!['owned','curious'].includes(e.ownership)||typeof e.active!=='boolean'||e.purchasePrice!=null&&(!Number.isFinite(e.purchasePrice)||e.purchasePrice<0)||e.notes!=null&&!text(e.notes))throw new Error('我的设备记录损坏。');validateDevice(e.snapshot);}
 for(const k of data.kits)if(!text(k.name,100)||!safeId(k.bodyId)||k.lensId!=null&&!safeId(k.lensId))throw new Error('设备组合记录损坏。');
 for(const r of data.imports)if(!text(r.at,64)||!Array.isArray(r.ids)||r.ids.some(id=>!safeId(id))||!Array.isArray(r.errors)||r.errors.some(e=>!text(e.name,500)||!text(e.error,1000))||r.duplicates!=null&&(!Array.isArray(r.duplicates)||r.duplicates.some(d=>!text(d.name,500)||!safeId(d.photoId))))throw new Error('导入记录损坏。');
 for(const r of data.catalog)validateDevice(r);
}
function validateDevice(r){if(!r||!safeId(r.id)||!['body','lens','phone'].includes(r.type)||!text(r.model,200)||!text(r.brand,80)||!text(r.mount,80))throw new Error('设备信息损坏。');for(const key of ['focal','maxAperture','sensorMm'])if(r[key]!=null&&(!Array.isArray(r[key])||r[key].length!==2||r[key].some(v=>!Number.isFinite(v)||v<=0)))throw new Error('设备参数损坏。');if(r.crop!=null&&(!Number.isFinite(r.crop)||r.crop<=0||r.crop>10))throw new Error('画幅系数无效。');}
export async function restoredExtras(store,data,photos){
 const payload=Object.fromEntries(EXTRA_STORES.map(n=>[n,data.version===2?data[n]:[]]));
 if(data.version===1){
  for(const s of data.sessions){const pp=photos.filter(p=>p.sessionId===s.id);if(!pp.length)continue;const gid='legacy-'+s.id,old=await store.get('groups',gid);payload.groups.push(old||{id:gid,name:`${s.day} · ${s.summary?.slice(0,30)||'摄影练习'}`,description:'从R0备份中的练习归组迁移。',sessionId:s.id,coverPhotoId:pp[0].id,order:payload.groups.length,createdAt:s.createdAt,demo:!!s.demo});for(const p of pp)payload.memberships.push({id:membershipId(gid,p.id),groupId:gid,photoId:p.id});}
 }
 // Catalog packages retain unverified provenance and no external image rights after import.
 if(payload.catalog.length){const revision=Math.max(CATALOG_REVISION+1,...payload.catalog.map(r=>r.revision||0));payload.catalog=validateCatalogPackage({app:'light-journal-equipment',schema:1,revision,records:payload.catalog});}
 payload.settings=data.settings.filter(s=>s&&(s.id==='appearance'&&['dark','light'].includes(s.value)||data.version===2&&s.id==='default-kit'&&(s.value==null||safeId(s.value))||data.version===2&&s.id==='last-import'&&payload.imports.some(r=>r.id===s.value?.id)));
 payload.settings.push({id:'data-version',value:2});
 return payload;
}
