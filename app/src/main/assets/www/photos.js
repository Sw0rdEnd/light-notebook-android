import {readExif,shootingDay} from './exif.js';
import {id} from './core.js';
export function verifyJpeg(buffer,name,size){if(!/\.jpe?g$/i.test(name))throw new Error('只支持 JPG / JPEG，请先将 RAW、HEIC 或 PNG 导出为 JPG。');if(size>40*1024*1024)throw new Error('单张超过 40MB，请先缩小或导出 JPG。');const a=new Uint8Array(buffer);if(a.length<4||a[0]!==255||a[1]!==216||a[2]!==255)throw new Error('文件内容不是有效的 JPEG。');}
async function decode(file){if(globalThis.createImageBitmap){try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch{}}
 const url=URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('无法解码这张 JPEG，文件可能已损坏。'));img.src=url;});}finally{URL.revokeObjectURL(url);}}
function scaled(image,max,quality){const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight,ratio=Math.min(1,max/Math.max(width,height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(width*ratio));c.height=Math.max(1,Math.round(height*ratio));const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);return new Promise((resolve,reject)=>c.toBlob(b=>{c.width=c.height=1;b?resolve(b):reject(new Error('生成复盘副本失败。'));},'image/jpeg',quality));}
export async function fingerprint(buffer){const digest=await crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function processPhoto(file,{buffer,fingerprint:hash}={}){if(file.size>40*1024*1024)throw new Error('单张超过 40MB，请先导出较小 JPG。');buffer ||= await file.arrayBuffer();verifyJpeg(buffer,file.name,file.size);const exif=readExif(buffer),image=await decode(file);try{if((image.width||image.naturalWidth)*(image.height||image.naturalHeight)>100000000)throw new Error('照片超过一亿像素，请缩小后导入。');const preview=await scaled(image,2400,.88),thumb=await scaled(image,400,.76);return {id:id(),name:file.name,importedAt:new Date().toISOString(),day:shootingDay(exif),dateSource:shootingDay(exif)?'EXIF':'unknown',exif,width:image.width||image.naturalWidth,height:image.height||image.naturalHeight,preview,thumb,fingerprint:hash||await fingerprint(buffer),storedBytes:preview.size+thumb.size,originalBytes:file.size,sessionId:null,liked:false,improve:false,star:false,reasons:[],tags:[],corrections:{},cull:'undecided',demo:false};}finally{image.close?.();}}
export async function importBatch(files,{process=processPhoto,existingPhotos=[],onProgress=()=>{},onPhoto=async()=>{}}={}){
 const photos=[],errors=[],duplicates=[],known=new Map(existingPhotos.filter(p=>p.fingerprint).map(p=>[p.fingerprint,p]));
 if(files.length>200)throw new Error('单批最多 200 张。');
 for(let i=0;i<files.length;i++){
  try{
   let buffer,hash;
   if(files[i].arrayBuffer){if(files[i].size>40*1024*1024)throw new Error('单张超过 40MB');buffer=await files[i].arrayBuffer();verifyJpeg(buffer,files[i].name,files[i].size);hash=await fingerprint(buffer);}
   const previous=hash?known.get(hash):null;
   if(previous&&!previous.missingImage&&previous.preview!==null&&previous.thumb!==null){duplicates.push({name:files[i].name,photoId:previous.id});}
   else {let photo=await process(files[i],{buffer,fingerprint:hash});if(previous)photo={...previous,preview:photo.preview,thumb:photo.thumb,width:photo.width,height:photo.height,storedBytes:photo.storedBytes,missingImage:false};await onPhoto(photo);photos.push(photo);if(hash)known.set(hash,photo);}
  }catch(e){errors.push({name:files[i].name,error:e.name==='QuotaExceededError'?'本地空间不足':e.message});if(e.name==='QuotaExceededError'){for(const file of files.slice(i+1))errors.push({name:file.name,error:'空间不足，本批已停止'});onProgress(files.length,files.length,{success:photos.length,failed:errors.length,duplicates:duplicates.length});return {photos,errors,duplicates,stopped:true};}}
  onProgress(i+1,files.length,{success:photos.length,failed:errors.length,duplicates:duplicates.length});
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return {photos,errors,duplicates,stopped:false};
}
