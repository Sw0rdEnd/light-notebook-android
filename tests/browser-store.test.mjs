import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {Store} from '../app/src/main/assets/www/db.js';
import {createSession} from '../app/src/main/assets/www/core.js';
import {makeBackup,restoreBackup} from '../app/src/main/assets/www/backup.js';
globalThis.indexedDB=indexedDB;delete globalThis.AndroidStorage;
test('PC browser saves JPEG blobs, restores from a new connection, and migrates full backup',async()=>{
 const store=new Store();await store.open();await store.clear();const session=createSession();
 const image=new Blob([new Uint8Array([255,216,255,217])],{type:'image/jpeg'});
 const photo={id:crypto.randomUUID(),name:'PC预览.jpg',importedAt:new Date().toISOString(),day:null,exif:{focal:85},preview:image,thumb:image,storedBytes:8,sessionId:session.id,liked:false,improve:false,star:false,reasons:[],demo:false};
 await store.merge({sessions:[session],photos:[photo]});const fresh=new Store();assert.equal((await fresh.all('photos'))[0].preview.size,4);assert.equal((await fresh.get('sessions',session.id)).theme,'composition');
 const backup=await makeBackup(fresh,true);assert.ok(backup.photos[0].image);await store.clear();await restoreBackup(store,JSON.parse(JSON.stringify(backup)));assert.equal((await store.get('photos',photo.id)).exif.focal,85);assert.equal((await store.get('photos',photo.id)).preview.size,4);
 const demo={...photo,id:crypto.randomUUID(),demo:true};await store.put('photos',demo);await store.removeDemo();assert.equal((await store.all('photos')).length,1);await store.remove('photos',photo.id);assert.equal((await fresh.all('photos')).length,0);store.close();fresh.close();
});
test('browser metadata merge aborts all writes on invalid data',async()=>{
 const store=new Store();await store.open();await store.clear();
 await assert.rejects(store.merge({sessions:[{id:'valid',summary:'must roll back'},{missingId:true}]}));assert.equal((await store.all('sessions')).length,0);store.close();
});
