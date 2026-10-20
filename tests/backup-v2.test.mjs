import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {BrowserStore} from '../app/src/main/assets/www/browser-store.js';
import {NativeStore} from '../app/src/main/assets/www/native.js';
import {makeBridge} from './bridge-fixture.mjs';
import {createSession} from '../app/src/main/assets/www/core.js';
import {saveGroup,assignPhotos,migrateData} from '../app/src/main/assets/www/organize.js';
import {makeBackup,restoreBackup} from '../app/src/main/assets/www/backup.js';
import {SEED_CATALOG} from '../app/src/main/assets/www/equipment-data.js';
import {importBatch} from '../app/src/main/assets/www/photos.js';
import {Store} from '../app/src/main/assets/www/db.js';
globalThis.indexedDB=indexedDB;
for(const backend of ['browser','native'])test(`${backend}: v2 full and records-only backups preserve groups, kits, corrections and legacy upgrades atomically`,async()=>{
 const bridge=backend==='native'?makeBridge():null;if(bridge){globalThis.AndroidStorage=bridge;globalThis.fetch=async url=>new Response(bridge.readFile(url.split('/').at(-1)));}
 const store=bridge?new NativeStore():new BrowserStore('backup-v2-'+crypto.randomUUID());await store.open();await migrateData(store);
 const s=createSession(),body=SEED_CATALOG.find(r=>r.id==='sony-ilce7cm2'),jpeg=new Blob([new Uint8Array([255,216,255,217])]);
 const p={id:crypto.randomUUID(),name:'A.jpg',day:null,importedAt:new Date().toISOString(),exif:{camera:'RAW-NAME'},sessionId:s.id,demo:false,liked:false,improve:false,star:false,reasons:[],tags:['夜景'],cull:'keep',corrections:{bodyId:body.id,body},reviewNote:'侧光更清楚',preview:jpeg,thumb:jpeg,storedBytes:8};
 const equipment={id:crypto.randomUUID(),snapshot:body,active:true,ownership:'owned'},kit={id:crypto.randomUUID(),name:'机身待补镜头',bodyId:equipment.id,lensId:null};
 await store.merge({sessions:[s],photos:[p],equipment:[equipment],kits:[kit],settings:[{id:'default-kit',value:kit.id}]});const g=await saveGroup(store,{name:'周末'});await assignPhotos(store,[p.id],g.id);
 const full=JSON.parse(JSON.stringify(await makeBackup(store,true)));assert.equal(full.version,2);assert.equal(full.memberships.length,1);assert.ok(full.photos[0].image);
 const bad=structuredClone(full);bad.memberships[0].groupId='missing';await assert.rejects(restoreBackup(store,bad));assert.equal((await store.get('photos',p.id)).reviewNote,'侧光更清楚');
 const meta=await makeBackup(store,false);await restoreBackup(store,meta);assert.equal((await store.get('photos',p.id)).preview.size,4);
 await store.clear();await restoreBackup(store,meta);assert.equal((await store.get('photos',p.id)).preview,null);assert.equal((await store.all('groups')).length,1);assert.equal((await store.all('equipment')).length,1);
 await restoreBackup(store,full);const restored=await store.get('photos',p.id);assert.equal(restored.preview.size,4);assert.equal(restored.exif.camera,'RAW-NAME');assert.equal(restored.corrections.body.model,body.model);assert.equal((await store.all('kits')).length,1);
 const legacy={...full,version:1};delete legacy.dataVersion;for(const key of ['groups','memberships','imports','equipment','kits','catalog'])delete legacy[key];
 await restoreBackup(store,legacy);assert.ok((await store.all('memberships')).some(m=>m.groupId==='legacy-'+s.id));
 store.close?.();bridge?.cleanup();delete globalThis.AndroidStorage;
});
test('duplicate detection uses original content across renames, batches, and allows same filename with different bytes',async()=>{
 const bytes=n=>new File([new Uint8Array([255,216,255,217,n])],'same.jpg',{type:'image/jpeg'}),saved=[];
 const process=async(file,{fingerprint})=>({id:crypto.randomUUID(),name:file.name,fingerprint});
 const first=await importBatch([bytes(1),new File([await bytes(1).arrayBuffer()],'renamed.jpg')],{process,onPhoto:async p=>saved.push(p)});assert.equal(first.photos.length,1);assert.equal(first.duplicates.length,1);
 const second=await importBatch([bytes(1),bytes(2),new File(['raw'],'photo.ARW')],{process,existingPhotos:saved});assert.equal(second.photos.length,1);assert.equal(second.duplicates.length,1);assert.equal(second.errors.length,1);assert.match(second.errors[0].error,/RAW/);
});
test('clearing demo photos also clears their links and covers in real custom groups',async()=>{
 const store=new Store();await store.open();const s=createSession({demo:true}),jpeg=new Blob([new Uint8Array([255,216,255,217])]);
 const p={id:crypto.randomUUID(),name:'demo.jpg',day:null,importedAt:new Date().toISOString(),exif:{},sessionId:s.id,demo:true,liked:false,improve:false,star:false,reasons:[],preview:jpeg,thumb:jpeg,storedBytes:8};
 await store.merge({sessions:[s],photos:[p]});const g=await saveGroup(store,{name:'真实分组'});await assignPhotos(store,[p.id],g.id);await saveGroup(store,{...g,coverPhotoId:p.id},g);await store.removeDemo();assert.equal((await store.all('memberships')).length,0);assert.equal((await store.get('groups',g.id)).coverPhotoId,null);await restoreBackup(store,await makeBackup(store,true));store.close();
});
test('reimport repairs a records-only photo without losing its ID, groups or user corrections',async()=>{
 const file=new File([new Uint8Array([255,216,255,217,5])],'A.jpg');const process=async(file,{fingerprint})=>({id:crypto.randomUUID(),name:file.name,fingerprint,preview:new Blob(['preview']),thumb:new Blob(['thumb']),storedBytes:12});
 const initial=(await importBatch([file],{process})).photos[0];const metadata={...initial,preview:null,thumb:null,missingImage:true,reviewNote:'保留原复盘',corrections:{bodyId:'unidentified'}};
 const result=await importBatch([file],{process,existingPhotos:[metadata]});assert.equal(result.photos[0].id,initial.id);assert.equal(result.photos[0].reviewNote,'保留原复盘');assert.equal(result.photos[0].corrections.bodyId,'unidentified');assert.ok(result.photos[0].preview);assert.equal(result.duplicates.length,0);
});
