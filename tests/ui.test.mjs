import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {indexedDB} from 'fake-indexeddb';
import {makeBridge} from './bridge-fixture.mjs';
import {Store} from '../app/src/main/assets/www/db.js';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url),sharp=require('sharp');
const dom=new Window({url:'http://localhost:8080/',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const window=dom,document=dom.document;
for(const k of ['window','document','navigator','location','HTMLElement','Event','CustomEvent'])Object.defineProperty(globalThis,k,{value:k==='window'?window:window[k],configurable:true});
const bridge=makeBridge();globalThis.AndroidStorage=bridge;bridge.setWindow(window);globalThis.indexedDB=indexedDB;globalThis.scrollTo=()=>{};
const modalProto=window.HTMLDialogElement.prototype;modalProto.showModal=function(){this.setAttribute('open','');};modalProto.close=function(){this.removeAttribute('open');};
const jpg=await fs.readFile(new URL('../app/src/main/assets/www/assets/lake.jpg',import.meta.url));
const nativeFetch=globalThis.fetch;globalThis.fetch=async name=>name.startsWith('assets/')?new Response(jpg,{headers:{'content-type':'image/jpeg'}}):name.includes('/data/')?new Response(bridge.readFile(name.split('/').at(-1))):nativeFetch(name);
const urls=new Map();URL.createObjectURL=b=>{const u='blob:test-'+crypto.randomUUID();urls.set(u,b);return u;};URL.revokeObjectURL=u=>urls.delete(u);
const canvas=window.HTMLCanvasElement.prototype;canvas.getContext=function(){return {drawImage:image=>{this.image=image;}};};canvas.toBlob=function(cb,type,quality){sharp(this.image.buffer).resize(this.width,this.height).jpeg({quality:Math.round(quality*100)}).toBuffer().then(b=>cb(new Blob([b],{type})));};
globalThis.createImageBitmap=async b=>{const buffer=Buffer.from(await b.arrayBuffer()),m=await sharp(buffer).metadata();return {buffer,width:m.width,height:m.height,close(){}};};
let downloads=[];window.addEventListener('android-save-finished',async e=>{if(e.detail.success){const ex=bridge.exports.get(e.detail.token);downloads.push({name:ex.name,blob:new Blob([await fs.readFile(ex.path)])});}});window.HTMLAnchorElement.prototype.click=function(){if(this.download)downloads.push({name:this.download,blob:urls.get(this.href)});};
document.body.innerHTML='<div id="app"></div><div id="toast"></div><dialog id="modal"></dialog><input id="photo-input" type="file" multiple><input id="backup-input" type="file">';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const wait=async fn=>{const end=Date.now()+4000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out: '+fn.toString());};
const click=async selector=>{await wait(()=>$(selector)&&!$(selector).disabled);$(selector).dispatchEvent(new window.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,25));};
const change=async (selector,value)=>{const e=$(selector);e.value=value;e.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,25));};
const input=async(selector,value)=>{const e=$(selector);e.value=value;e.dispatchEvent(new window.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,300));};
const store=new Store();
await import('../app/src/main/assets/www/app.js');

test('DOM interaction flow: wizard, task completion/note/skip, import 3 real JPEGs, unknown EXIF, grouping, compare, marking, review, backup and restore',async()=>{
 assert.match(document.body.textContent,/开始练习/);assert.equal($('[data-action="continue"]').disabled,true);
 await click('[data-action="new"]');await click('[data-action="choose"][data-value="60"]');await click('[data-action="wizard-next"]');await click('[data-action="choose"][data-value="still"]');await click('[data-action="wizard-next"]');await click('[data-action="choose"][data-value="focal"]');await click('[data-action="wizard-next"]');assert.equal($$('.task-preview').length,4);await click('[data-action="start"]');assert.equal((await store.all('sessions')).length,1);
 await click('[data-action="task-note"]');await input('#task-note-field','窗边侧光，背景有亮点。');await click('#modal [data-action="close"]');await click('[data-action="task-done"]');assert.match(document.body.textContent,/1 \/ 4/);await click('[data-action="task-skip"]');
 // Simulate reload persistence through a new DB connection and return home/continue.
 const reloaded=new Store();assert.equal((await reloaded.all('sessions'))[0].tasks[0].note,'窗边侧光，背景有亮点。');await click('[data-action="nav"][data-tab="practice"]');assert.equal($('[data-action="continue"]').disabled,false);await click('[data-action="continue"]');await click('[data-action="finish"]');await click('[data-action="confirm-finish"]');assert.match(document.body.textContent,/拍摄已结束/);
 await click('[data-action="import"]');await click('[data-action="begin-import"]');const files=await Promise.all([1,2,3].map(async i=>new File([await sharp(jpg).resize(300+i*10).jpeg().toBuffer()],`无EXIF-${i}.jpg`,{type:'image/jpeg'})));Object.defineProperty($('#photo-input'),'files',{value:files,configurable:true});$('#photo-input').dispatchEvent(new window.Event('change',{bubbles:true}));await wait(()=>$('[data-action="confirm-groups"]'));
 assert.match($('#modal').textContent,/拍摄日期未知/);assert.equal((await store.all('photos')).length,3);await click('[data-action="confirm-groups"]');assert.equal((await store.all('photos')).filter(p=>p.sessionId).length,3);
 await click('.photo-open');assert.equal($$('.exif dd.unknown').length,7);await click('#modal [data-action="mark"][data-kind="liked"]');await click('#modal [data-action="photo-reason"][data-reason="背景杂乱"]');await click('#modal [data-action="close"]');await click('[data-action="toggle-select"]');let cells=$$('.photo-open');cells[0].click();await new Promise(r=>setTimeout(r,30));cells=$$('.photo-open');cells[1].click();await new Promise(r=>setTimeout(r,30));await click('[data-action="compare"]');assert.equal($$('.compare-stage figure').length,2);assert.ok($('.compare-stage').classList.contains('show-both'));assert.equal($$('.compare-stage figure.mobile-hidden').length,0);assert.equal($$('.comparison-table td.unknown').length,14);assert.equal($$('.comparison-table tbody tr').length,7);await click('#modal [data-action="ai-review"]');assert.match($('#modal').textContent,/尚未接入/);await click('[data-action="ai-back"]');await click('[data-action="compare-side"][data-side="1"]');assert.equal($('.compare-stage figure[data-side="1"]').classList.contains('mobile-hidden'),false);assert.equal($$('.comparison-table td.unknown').length,14);await click('#modal [data-action="mark"][data-kind="star"]');await click('#modal [data-action="close"]');
 await click('[data-action="nav"][data-tab="practice"]');await click('[data-action="continue"]');await input('#review-summary','85mm 时后退，背景看起来更集中。');await click('[data-action="review-issue"][data-reason="背景杂乱"]');await click('[data-action="save-review"]');assert.equal((await store.all('sessions'))[0].status,'done');assert.equal((await store.all('sessions'))[0].summary,'85mm 时后退，背景看起来更集中。');
 await click('[data-action="nav"][data-tab="settings"]');await click('[data-action="backup-full"]');await wait(()=>downloads.length===1);assert.match(downloads[0].name,/含.*照片/);const backup=JSON.parse(await downloads[0].blob.text());assert.equal(backup.photos.length,3);assert.ok(backup.photos.every(p=>p.image));await click('#modal [data-action="close"]');
 await click('[data-action="clear-all"]');await input('#clear-confirm','清空');await click('[data-action="confirm-clear"]');assert.equal((await store.all('photos')).length,0);const backupFile=new File([JSON.stringify(backup)],'backup.json',{type:'application/json'});Object.defineProperty($('#backup-input'),'files',{value:[backupFile],configurable:true});$('#backup-input').dispatchEvent(new window.Event('change',{bubbles:true}));await wait(()=>$('[data-action="confirm-restore"]'));await click('[data-action="confirm-restore"]');await wait(()=>!$('#modal').open);assert.equal((await store.all('photos')).length,3);assert.equal((await store.all('sessions'))[0].summary,'85mm 时后退，背景看起来更集中。');assert.ok((await store.all('photos')).some(p=>p.star));
 await click('[data-action="nav"][data-tab="growth"]');assert.equal($('.growth-progress').getAttribute('aria-valuenow'),'1');assert.equal($$('.growth-bars').length,0);assert.ok(!document.body.textContent.includes('能力评分'));
 await click('[data-action="nav"][data-tab="settings"]');await click('[data-action="demo"]');await wait(async()=>(await store.all('photos')).filter(p=>p.demo).length===3);assert.equal((await store.all('photos')).filter(p=>p.demo).length,3);await click('[data-action="nav"][data-tab="growth"]');assert.equal($('.growth-metric[data-metric="photos"] strong').textContent,'3');assert.equal($('.growth-metric[data-metric="sessions"] strong').textContent,'1');await click('[data-action="nav"][data-tab="settings"]');await click('[data-action="clear-demo"]');assert.equal((await store.all('photos')).length,3);
});

test('native photo organization closes on success and keeps unsaved edits available after failure',async()=>{
 await click('[data-action="nav"][data-tab="photos"]');const photoId=$('.photo-open').dataset.id;
 await click('.photo-open');const groups=[...$('#photo-groups').selectedOptions].map(el=>el.value).sort();
 await input('#photo-tags','窗边, 构图');await input('#photo-review','保存并返回照片列表');await change('#photo-cull','keep');
 await click('[data-action="photo-organize-save"]');await wait(()=>!$('#modal').open);
 const saved=await store.get('photos',photoId);assert.equal(saved.reviewNote,'保存并返回照片列表');assert.equal(saved.cull,'keep');assert.deepEqual(saved.tags,['窗边','构图']);assert.ok(saved.reviewedAt);
 assert.deepEqual((await store.all('memberships')).filter(m=>m.photoId===photoId).map(m=>m.groupId).sort(),groups);
 await click(`.photo-open[data-id="${photoId}"]`);assert.equal($('#photo-review').value,'保存并返回照片列表');
 await input('#photo-review','失败后保留，重试后保存');
 const request=bridge.request,logError=console.error;
 bridge.request=(action,payload)=>action==='merge'&&JSON.parse(payload).photos?.some(p=>p.id===photoId)?JSON.stringify({ok:false,error:'模拟写入失败',name:'WriteError'}):request(action,payload);
 console.error=(error,...rest)=>{if(error?.message!=='模拟写入失败')logError(error,...rest);};
 try{await click('[data-action="photo-organize-save"]');assert.equal($('#modal').open,true);assert.equal($('#photo-review').value,'失败后保留，重试后保存');assert.match($('#modal .error-banner').textContent,/模拟写入失败/);assert.equal((await store.get('photos',photoId)).reviewNote,'保存并返回照片列表');}
 finally{bridge.request=request;console.error=logError;}
 await click('[data-action="photo-organize-save"]');await wait(()=>!$('#modal').open);assert.equal((await store.get('photos',photoId)).reviewNote,'失败后保留，重试后保存');assert.equal($('#main .error-banner')===null,true);
});

test('import receipt, filename search, reset filters, mixed failures, unassigned photos and immediate compare',async()=>{
 await click('[data-action="nav"][data-tab="photos"]');
 assert.equal($$('.photo-cell').length,3);assert.match(document.body.textContent,/无EXIF-1.jpg/);
 await input('#photo-search','无EXIF-2');assert.equal($$('.photo-cell').length,1);
 await click('[data-action="reset-photos"]');assert.equal($$('.photo-cell').length,3);
 await click('[data-action="photo-filter"][data-filter="star"]');
 const files=[new File([jpg],'新照片.jpg',{type:'image/jpeg'}),new File(['bad'],'损坏.jpg',{type:'image/jpeg'})];
 Object.defineProperty($('#photo-input'),'files',{value:files,configurable:true});$('#photo-input').dispatchEvent(new window.Event('change',{bubbles:true}));
 await wait(()=>$('[data-action="confirm-groups"]'));assert.match($('#modal').textContent,/已保存 1 张照片/);assert.match($('#modal').textContent,/损坏.jpg/);
 assert.equal((await store.all('photos')).length,4);assert.match(document.body.textContent,/最近导入：成功 1 张.*失败 1 张/);
 await click('#modal [data-action="close"]');assert.equal($$('.photo-cell').length,4);
 await click('[data-action="recent-import"]');assert.equal($$('.photo-cell').length,1);assert.match($('.photo-name').textContent,/新照片.jpg/);
 await click('[data-action="import-details"]');assert.match($('#modal').textContent,/损坏.jpg/);await click('#modal [data-action="close"]');
 await click('[data-action="reset-photos"]');await click('[data-action="toggle-select"]');
 const cells=$$('.photo-open');cells[0].click();await new Promise(r=>setTimeout(r,25));$$('.photo-open')[1].click();await new Promise(r=>setTimeout(r,25));
 await click('[data-action="compare"]');assert.equal($$('.compare-stage figure.mobile-hidden').length,0);await click('#modal [data-action="close"]');
 // Removing the test import keeps the original review/restart fixture at three photos.
 const imported=(await store.all('photos')).find(p=>p.name==='新照片.jpg');await store.remove('photos',imported.id);
});

test('fresh page startup restores review and photos from the same IndexedDB',async()=>{
 const next=new Window({url:'http://localhost:8080/',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 for(const k of ['window','document','navigator','location','HTMLElement','Event','CustomEvent'])Object.defineProperty(globalThis,k,{value:k==='window'?next:next[k],configurable:true});
 next.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};next.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 next.document.body.innerHTML='<div id="app"></div><div id="toast"></div><dialog id="modal"></dialog><input id="photo-input" type="file" multiple><input id="backup-input" type="file">';
 bridge.setWindow(next);await import('../app/src/main/assets/www/app.js?fresh-startup');
 assert.match(next.document.body.textContent,/85mm 时后退/);
 assert.equal((await store.all('photos')).length,3);
 const row=next.document.querySelector('[data-action="open-session"]');row.click();await new Promise(r=>setTimeout(r,40));
 assert.equal(next.document.querySelector('#review-summary').value,'85mm 时后退，背景看起来更集中。');
 assert.equal(next.document.querySelectorAll('.photo-cell').length,3);
 next.happyDOM.abort();
});

test.after(()=>{window.happyDOM.abort();bridge.cleanup();});
