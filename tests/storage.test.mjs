import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBridge} from './bridge-fixture.mjs';
import {Store} from '../app/src/main/assets/www/db.js';
import {createSession,markPhoto,saveReview} from '../app/src/main/assets/www/core.js';
import {makeBackup,restoreBackup} from '../app/src/main/assets/www/backup.js';
const b=makeBridge();globalThis.AndroidStorage=b;globalThis.fetch=async url=>new Response(b.readFile(url.split('/').at(-1)));

test('native adapter saves JPEGs as disk files, stores only references in SQLite and reads after reopen',async()=>{const store=new Store();await store.open();const s=createSession();await store.put('sessions',s);const p={id:crypto.randomUUID(),name:'无EXIF.jpg',importedAt:new Date().toISOString(),day:null,exif:{},sessionId:s.id,demo:false,reasons:[],liked:false,star:false,improve:false,preview:new Blob([new Uint8Array([255,216,255,217])]),thumb:new Blob([new Uint8Array([255,216,255,217])]),storedBytes:8};await store.put('photos',p);assert.ok(p.preview.nativeFile);assert.equal(b.readFile(p.preview.nativeFile).length,4);const persisted=JSON.parse(b.db.prepare("SELECT body FROM records WHERE store='photos'").get().body);assert.ok(persisted.previewFile);assert.equal(persisted.preview,undefined);assert.equal(persisted.image,undefined);await markPhoto(store,p,'liked');await saveReview(store,s,'侧光下主体更清楚。',[]);const again=new Store();assert.equal((await again.all('sessions'))[0].summary,'侧光下主体更清楚。');assert.equal((await again.all('photos'))[0].liked,true);const bk=await makeBackup(again,true);assert.ok(bk.photos[0].image);await store.clear();await restoreBackup(store,JSON.parse(JSON.stringify(bk)));const restored=(await again.all('photos'))[0];assert.equal(restored.preview.size,4);assert.ok(restored.liked);const meta=await makeBackup(store,false);await restoreBackup(store,meta);assert.equal((await store.all('photos'))[0].preview.size,4);});
test.after(()=>b.cleanup());

test('native backup export writes all chunks to a real file and cancellation is distinct from success',async()=>{
 const {saveNativeFile}=await import('../app/src/main/assets/www/native.js');
 const events=Object.assign(new EventTarget(),{CustomEvent});globalThis.window=events;b.setWindow(events);
 const data=new Blob([new Uint8Array(500000).fill(97)]);const ok=await saveNativeFile(data,'导出测试.json');assert.equal(ok,true);const exported=[...b.exports.values()].at(-1);assert.equal((await import('node:fs')).statSync(exported.path).size,500000);
 const normal=globalThis.AndroidStorage;
 globalThis.AndroidStorage={request(action,input){if(action==='exportPick'){const {token}=JSON.parse(input);setTimeout(()=>events.dispatchEvent(new CustomEvent('android-save-finished',{detail:{token,success:false,cancelled:true,error:''}})),1);return JSON.stringify({ok:true,data:null});}return normal.request(action,input);}};
 assert.equal(await saveNativeFile(new Blob(['test']),'取消测试.json'),false);globalThis.AndroidStorage=normal;
});
