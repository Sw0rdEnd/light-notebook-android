import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {BrowserStore} from '../app/src/main/assets/www/browser-store.js';
import {NativeStore} from '../app/src/main/assets/www/native.js';
import {Store} from '../app/src/main/assets/www/db.js';
import {STORES,migrateData} from '../app/src/main/assets/www/organize.js';
import {createReviewJournal,newReviewRecord,migrateReviewHistory,cleanReviewRecord} from '../app/src/main/assets/www/ai-history.js';
import {makeBackup,restoreBackup} from '../app/src/main/assets/www/backup.js';
import {makeBridge} from './bridge-fixture.mjs';

globalThis.indexedDB=indexedDB;
const jpeg=()=>new Blob([new Uint8Array([255,216,255,217])],{type:'image/jpeg'});
const photo=(id,name=id+'.jpg')=>({id,name,day:null,importedAt:'2026-10-24T01:00:00Z',exif:{focal:35,camera:'Original camera'},sessionId:null,demo:false,liked:false,improve:false,star:false,reasons:[],tags:[],reviewNote:'',preview:jpeg(),thumb:jpeg(),storedBytes:8});
const request=(ids,note='构图怎么改进？')=>({requestId:crypto.randomUUID(),mode:ids.length===1?'single':'compare',note,photos:ids.map((id,i)=>({id,label:i===0?'A':'B'}))});
const result=(id,count=1,summary='第一次的具体观察')=>({schema:'light-journal.ai-result.v1',requestId:id,status:'ok',summary,observations:[{aspect:'构图',basis:'observation',text:'画面观察'}],nextSteps:['移动半步后重拍'],preferred:count===1?null:'A',usage:{total_tokens:42}});

for(const backend of ['browser','native'])test(`${backend}: every review survives repeat analysis, rename, photo deletion and v2 full/records-only backup`,async()=>{
 const bridge=backend==='native'?makeBridge():null,oldFetch=globalThis.fetch;
 if(bridge){globalThis.AndroidStorage=bridge;globalThis.fetch=async url=>new Response(bridge.readFile(url.split('/').at(-1)));}
 const store=bridge?new NativeStore():new BrowserStore('ai-history-'+crypto.randomUUID());await store.open();await migrateData(store);
 try{
  const photos=[photo('p-a','原始文件A.jpg'),photo('p-b')];await store.merge({photos});const journal=createReviewJournal(store);
  const firstRequest=request(['p-a'],'第一次看构图'),first=await journal.start(newReviewRecord(firstRequest,photos,{origin:'native',model:'deepseek-flash'}));
  await journal.finish(first,{status:'success',result:result(first.requestId)});
  const secondRequest=request(['p-a'],'第二次看光线'),second=await journal.start(newReviewRecord(secondRequest,photos));await journal.finish(second,{status:'success',result:result(second.requestId,1,'第二次的观察')});
  const compareRequest=request(['p-a','p-b'],'比较两张'),compare=await journal.start(newReviewRecord(compareRequest,photos));await journal.finish(compare,{status:'failed',error:{code:'AI_TIMEOUT',message:'等待超时'}});
  const failedRequest=request(['p-b']),cancelled=await journal.start(newReviewRecord(failedRequest,photos));await journal.finish(cancelled,{status:'cancelled',error:{code:'AI_CANCELLED',message:'已取消等待'}});
  assert.equal((await store.all('aiReviews')).length,4);assert.equal((await store.get('photos','p-a')).aiReview.reviewId,second.id);
  const fresh=await store.get('photos','p-a');await store.put('photos',{...fresh,name:'改名后的照片.jpg',exif:{focal:85},tags:['新标签']});
  assert.equal((await store.get('aiReviews',first.id)).photos[0].name,'原始文件A.jpg');assert.equal((await store.get('aiReviews',first.id)).photos[0].exif.focal,35);assert.equal((await store.get('aiReviews',first.id)).result.summary,'第一次的具体观察');
  await store.remove('photos','p-a');assert.equal((await store.get('aiReviews',first.id)).status,'success');
  const full=JSON.parse(JSON.stringify(await makeBackup(store,true))),meta=JSON.parse(JSON.stringify(await makeBackup(store,false)));assert.equal(full.version,2);assert.equal(full.aiReviews.length,4);assert.equal(meta.aiReviews.length,4);assert.ok(full.photos[0].image);
  await store.clear();await restoreBackup(store,meta);assert.equal((await store.all('aiReviews')).length,4);assert.equal((await store.get('photos','p-b')).preview,null);
  await store.clear();await restoreBackup(store,full);assert.equal((await store.all('aiReviews')).length,4);assert.ok((await store.get('photos','p-b')).preview);
  const bad=structuredClone(full);bad.aiReviews.find(r=>r.result).result.requestId='does-not-match';bad.photos[0].name='must-not-write';await assert.rejects(restoreBackup(store,bad));assert.notEqual((await store.get('photos','p-b')).name,'must-not-write');assert.equal((await store.all('aiReviews')).length,4);
  await migrateReviewHistory(store);assert.equal((await store.all('aiReviews')).length,4);
 }finally{store.close?.();bridge?.cleanup();delete globalThis.AndroidStorage;globalThis.fetch=oldFetch;}
});

test('legacy paired results migrate once and an older v2 backup still restores without a history field',async()=>{
 const store=new BrowserStore('ai-legacy-'+crypto.randomUUID());await store.open();await migrateData(store);
 try{
  const req=request(['old-a','old-b']),saved={photoIds:['old-a','old-b'],note:'旧问题',at:'2026-10-23T08:00:00Z',result:result(req.requestId,2)},photos=[photo('old-a'),photo('old-b')].map(p=>({...p,aiReview:saved}));
  await store.merge({photos});await migrateReviewHistory(store);await migrateReviewHistory(store);const rows=await store.all('aiReviews');assert.equal(rows.length,1);assert.equal(rows[0].origin,'legacy');assert.equal(rows[0].note,'旧问题');assert.equal(rows[0].photos.length,2);
  const old=await makeBackup(store,false);delete old.aiReviews;await store.clear();await restoreBackup(store,old);assert.equal((await store.all('aiReviews')).length,1);await restoreBackup(store,old);assert.equal((await store.all('aiReviews')).length,1);
 }finally{store.close();}
});

test('physical IndexedDB v2 upgrade preserves photos and migrates their last saved review on open',async()=>{
 const name='ai-v2-upgrade-'+crypto.randomUUID(),req=request(['old-photo']),p=photo('old-photo');p.aiReview={photoIds:[p.id],note:'旧记录',at:'2026-10-23T08:00:00Z',result:result(req.requestId)};
 const db=await new Promise((resolve,reject)=>{const open=indexedDB.open(name,2);open.onupgradeneeded=()=>{for(const n of STORES.filter(n=>n!=='aiReviews'))open.result.createObjectStore(n,{keyPath:'id'});};open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
 await new Promise((resolve,reject)=>{const tx=db.transaction(['photos','settings'],'readwrite');tx.objectStore('photos').put(p);tx.objectStore('settings').put({id:'data-version',value:2});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
 const store=new Store();store.backend=new BrowserStore(name);
 try{await store.open();assert.equal(store.backend.db.version,3);assert.ok((await store.get('photos',p.id)).preview);assert.equal((await store.all('aiReviews')).length,1);assert.equal((await store.get('settings','data-version')).value,2);}
 finally{store.close();}
});

test('interrupted runs remain queryable, cancellation is terminal and a failed local save retries the same record',async()=>{
 const store=new BrowserStore('ai-lifecycle-'+crypto.randomUUID());await store.open();await migrateData(store);
 try{
  const photos=[photo('p')];await store.merge({photos});const journal=createReviewJournal(store),req=request(['p']),record=await journal.start(newReviewRecord(req,photos));await migrateReviewHistory(store);assert.equal((await store.get('aiReviews',record.id)).status,'interrupted');
  await journal.finish(record,{status:'success',result:result(req.requestId)});assert.equal((await store.get('aiReviews',record.id)).status,'success');
  const req2=request(['p']),record2=await journal.start(newReviewRecord(req2,photos));await journal.finish(record2,{status:'cancelled',error:{code:'AI_CANCELLED',message:'已取消'}});await journal.finish(record2,{status:'success',result:result(req2.requestId)});assert.equal((await store.get('aiReviews',record2.id)).status,'cancelled');
  const req3=request(['p']),record3=await journal.start(newReviewRecord(req3,photos)),merge=store.merge.bind(store);let fail=true;store.merge=async payload=>{if(payload.aiReviews?.[0]?.status==='success'&&fail){fail=false;throw new Error('模拟磁盘写入失败');}return merge(payload);};
  await assert.rejects(journal.finish(record3,{status:'success',result:result(req3.requestId)}));assert.equal((await store.get('aiReviews',record3.id)).status,'running');await journal.finish(record3,{status:'success',result:result(req3.requestId)});assert.equal((await store.all('aiReviews')).length,3);assert.equal((await store.get('photos','p')).aiReview.reviewId,record3.id);
  const clean=cleanReviewRecord({...await store.get('aiReviews',record3.id),apiKey:'unit-key-not-for-history',result:{...result(req3.requestId),apiKey:'unit-key-not-for-history'}});assert.equal(JSON.stringify(clean).includes('unit-key-not-for-history'),false);
  const brief={...clean.brief,goal:'当时保存的旧模板目标'};assert.equal(cleanReviewRecord({...clean,brief}).brief.goal,'当时保存的旧模板目标');
 }finally{store.close();}
});
