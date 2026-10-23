import {EQUIPMENT_PHOTO_ENTRIES} from './equipment-photo-data.js';
// Built-in reference illustrations have fixed local paths and retained source/credit
// metadata. Their inclusion does not grant an open license. Imported records cannot
// claim these assets or enable arbitrary downloads; remote caching still needs a license.
const builtins=new Map(EQUIPMENT_PHOTO_ENTRIES.flatMap(photo=>photo.recordIds.map(id=>[id,photo])));
export function equipmentPhoto(record){
 const photo=builtins.get(record?.id);
 return record?.provenance==='official-specification'&&photo&&['brand','model','type'].every(key=>record[key]===photo[key])?photo:null;
}
export const IMAGE_CACHE='light-journal-licensed-equipment-v1';
export function permittedImage(record){const builtin=equipmentPhoto(record);if(builtin)return {bundled:builtin.bundledPath};const image=record?.image;if(record?.provenance!=='official-specification'||!image?.cacheAllowed||!image.licenseUrl)return null;try{if(new URL(image.licenseUrl).protocol!=='https:')return null;}catch{return null;}
 if(image.bundledPath&&/^assets\/equipment\/[A-Za-z0-9_/-]+\.(jpg|png|webp)$/.test(image.bundledPath))return {bundled:image.bundledPath};
 try{if(new URL(image.url).protocol==='https:')return {url:image.url};}catch{}return null;
}
export function imageCacheKey(record,origin){return new URL(`/__equipment_image/${encodeURIComponent(record.id)}?revision=${record.revision}`,origin).href;}
export async function cacheEquipmentImage(record,{cacheStorage=globalThis.caches,fetcher=globalThis.fetch,origin=globalThis.location?.origin||'https://local.invalid'}={}){
 const allowed=permittedImage(record);if(!allowed||!allowed.url)throw new Error('这张官方图片尚无可用的缓存授权。');if(!cacheStorage)throw new Error('当前浏览器不支持图片缓存。');
 const cache=await cacheStorage.open(IMAGE_CACHE),key=imageCacheKey(record,origin),old=await cache.match(key);if(old)return old.blob();
 const response=await fetcher(allowed.url,{credentials:'omit',mode:'cors'});if(!response.ok)throw new Error('官方图片加载失败，可通过产品链接查看。');const blob=await response.blob();if(blob.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(blob.type))throw new Error('官方图片格式或体积不受支持，已保留占位。');await cache.put(key,new Response(blob,{headers:{'Content-Type':blob.type}}));return blob;
}
export async function cachedEquipmentImage(record,{cacheStorage=globalThis.caches,origin=globalThis.location?.origin||'https://local.invalid'}={}){if(!permittedImage(record)?.url||!cacheStorage)return null;const cache=await cacheStorage.open(IMAGE_CACHE),response=await cache.match(imageCacheKey(record,origin));return response?response.blob():null;}
