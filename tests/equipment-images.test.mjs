import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheEquipmentImage,cachedEquipmentImage,permittedImage} from '../app/src/main/assets/www/equipment-images.js';
import {equipmentPhoto} from '../app/src/main/assets/www/equipment-images.js';
import {SEED_CATALOG} from '../app/src/main/assets/www/equipment-data.js';
import {EQUIPMENT_PHOTO_ENTRIES} from '../app/src/main/assets/www/equipment-photo-data.js';
import {createEquipmentUI} from '../app/src/main/assets/www/equipment-ui.js';
import {Window} from 'happy-dom';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
test('unlicensed images cannot be fetched, imported rights are not accepted, licensed cache survives reopening',async()=>{
 let requests=0;const values=new Map(),cacheStorage={open:async()=>({match:async key=>values.get(key)?.clone(),put:async(key,value)=>values.set(key,value.clone())})};const fetcher=async()=>{requests++;return new Response(new Blob(['fixture'],{type:'image/jpeg'}));};
 const record={id:'fixture',revision:1,provenance:'official-specification',image:{url:'https://example.org/image.jpg',cacheAllowed:false}};
 await assert.rejects(cacheEquipmentImage(record,{fetcher,cacheStorage}));assert.equal(requests,0);
 const licensed={...record,image:{...record.image,cacheAllowed:true,licenseUrl:'https://example.org/license'}};await cacheEquipmentImage(licensed,{fetcher,cacheStorage});await cacheEquipmentImage(licensed,{fetcher,cacheStorage});assert.equal(requests,1);assert.equal((await cachedEquipmentImage(licensed,{cacheStorage})).type,'image/jpeg');assert.equal(permittedImage({...licensed,provenance:'user-import'}),null);
 assert.equal(permittedImage({...licensed,image:{...licensed.image,bundledPath:'assets/equipment/fixture.jpg'}}).bundled,'assets/equipment/fixture.jpg');
});

test('every catalog variant resolves to a real, intact offline product image with retained source and credit',async()=>{
 const base=new URL('../app/src/main/assets/www/',import.meta.url),sw=await fs.readFile(new URL('sw.js',base),'utf8');
 assert.equal(EQUIPMENT_PHOTO_ENTRIES.length,61);assert.equal(new Set(EQUIPMENT_PHOTO_ENTRIES.map(p=>p.sha256)).size,61);
 assert.equal(SEED_CATALOG.length,78);
 for(const record of SEED_CATALOG){
  const photo=equipmentPhoto(record);assert.ok(photo,record.id);assert.equal(permittedImage(record).bundled,photo.bundledPath);
 }
 for(const photo of EQUIPMENT_PHOTO_ENTRIES){
  const bytes=await fs.readFile(new URL(photo.bundledPath,base)),decoded=await sharp(bytes).metadata();
  assert.equal(decoded.format,'webp');assert.ok(decoded.width>90&&decoded.height>90);assert.ok(decoded.width<=600&&decoded.height<=400);
  assert.equal(bytes.length,photo.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256);
  assert.equal(decoded.width,photo.width);assert.equal(decoded.height,photo.height);assert.ok(sw.includes('./'+photo.bundledPath));
  assert.equal(new URL(photo.sourcePage).protocol,'https:');assert.equal(new URL(photo.sourceUrl).protocol,'https:');assert.ok(photo.credit&&photo.rights&&photo.originalSha256);
  // Public product-page attribution is kept separate from an open-license grant.
  assert.equal(photo.licenseUrl,null);
 }
});

test('catalog, detail and historical owned snapshots show matching photos without changing saved specifications or trusting imported identities',async()=>{
 const window=new Window(),document=window.document,record=SEED_CATALOG.find(r=>r.id==='sony-ilce7cm2');
 const old={...structuredClone(record),revision:20261001,weightG:12345,image:{url:null,cacheAllowed:false,rights:'旧版占位'}};
 const manual={...structuredClone(record),id:'my-manual-body',provenance:'manual'};
 const state={equipment:[{id:'owned',snapshot:old,ownership:'owned',active:true},{id:'manual',snapshot:manual,ownership:'owned',active:true}],kits:[],catalog:[],settings:[],photos:[]};
 const before=JSON.stringify(state.equipment),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let detail='';const devices=createEquipmentUI({state,store:{},esc,btn:(label,action,cls='',attrs='')=>`<button data-action="${action}" ${attrs}>${label}</button>`,render(){},reload(){},dialogFrame(title,body){detail=body;},closeDialog(){},toast(){}});
 document.body.innerHTML=devices.page();
 assert.equal(document.querySelectorAll('.equipment-card img').length,1);assert.match(document.querySelector('img').getAttribute('src'),/sony-ilce7cm2\.webp$/);
 assert.equal(document.querySelectorAll('.equipment-card .device-visual').length,1);assert.equal(JSON.stringify(state.equipment),before);
 assert.equal(permittedImage({...old,provenance:'user-import'}),null);assert.equal(permittedImage({...old,provenance:'manual'}),null);assert.equal(permittedImage({...old,model:'different model'}),null);
 await devices.action({dataset:{action:'device-catalog'}});document.body.innerHTML=devices.page();
 assert.equal(document.querySelectorAll('.equipment-card img').length,78);assert.equal(document.querySelectorAll('.equipment-card .device-visual').length,0);
 for(const img of document.querySelectorAll('.equipment-card img')){assert.ok(img.getAttribute('src').startsWith('assets/equipment/'));assert.match(img.alt,/产品外观参考/);}
 await devices.action({dataset:{action:'device-detail',id:record.id}});document.body.innerHTML=detail;
 assert.equal(document.querySelector('img').getAttribute('src'),equipmentPhoto(record).bundledPath);assert.equal(document.querySelector('.device-photo-source a').getAttribute('href'),equipmentPhoto(record).sourcePage);
 assert.match(document.querySelector('.device-photo-source').textContent,/卡口细节/);assert.equal(JSON.stringify(state.equipment),before);
 window.happyDOM.abort();
});
