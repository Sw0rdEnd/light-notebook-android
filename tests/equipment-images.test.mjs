import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheEquipmentImage,cachedEquipmentImage,permittedImage} from '../app/src/main/assets/www/equipment-images.js';
test('unlicensed images cannot be fetched, imported rights are not accepted, licensed cache survives reopening',async()=>{
 let requests=0;const values=new Map(),cacheStorage={open:async()=>({match:async key=>values.get(key)?.clone(),put:async(key,value)=>values.set(key,value.clone())})};const fetcher=async()=>{requests++;return new Response(new Blob(['fixture'],{type:'image/jpeg'}));};
 const record={id:'fixture',revision:1,provenance:'official-specification',image:{url:'https://example.org/image.jpg',cacheAllowed:false}};
 await assert.rejects(cacheEquipmentImage(record,{fetcher,cacheStorage}));assert.equal(requests,0);
 const licensed={...record,image:{...record.image,cacheAllowed:true,licenseUrl:'https://example.org/license'}};await cacheEquipmentImage(licensed,{fetcher,cacheStorage});await cacheEquipmentImage(licensed,{fetcher,cacheStorage});assert.equal(requests,1);assert.equal((await cachedEquipmentImage(licensed,{cacheStorage})).type,'image/jpeg');assert.equal(permittedImage({...licensed,provenance:'user-import'}),null);
 assert.equal(permittedImage({...licensed,image:{...licensed.image,bundledPath:'assets/equipment/fixture.jpg'}}).bundled,'assets/equipment/fixture.jpg');
});
