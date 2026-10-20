import {STORES} from './organize.js';
const ROOT='https://appassets.androidplatform.net';
export function nativeCall(action,payload={}){if(!globalThis.AndroidStorage)throw new Error('请通过安卓安装的《光影练习册》打开。');let out;try{out=JSON.parse(AndroidStorage.request(action,JSON.stringify(payload)));}catch{throw new Error('安卓本地存储连接失败，请关闭后重新打开应用。');}if(!out.ok){const e=new Error(out.error||'安卓本地存储操作失败');e.name=out.name||'StorageError';throw e;}return out.data;}
class LocalPhoto{
 constructor(file,size){this.nativeFile=file;this.nativeUrl=ROOT+'/data/'+file;this.size=size||0;this.type='image/jpeg';}
 async arrayBuffer(){const r=await fetch(this.nativeUrl);if(!r.ok)throw new Error('复盘照片文件缺失，请重新导入。');return r.arrayBuffer();}
}
function hydrate(store,p){if(!p)return undefined;if(store!=='photos')return p;return {...p,preview:p.previewFile?new LocalPhoto(p.previewFile,p.previewSize):null,thumb:p.thumbFile?new LocalPhoto(p.thumbFile,p.thumbSize):null};}
async function sendChunks(blob,append){const bytes=new Uint8Array(await blob.arrayBuffer());for(let p=0;p<bytes.length;p+=192*1024){const part=bytes.subarray(p,p+192*1024);let bin='';for(let i=0;i<part.length;i+=32768)bin+=String.fromCharCode(...part.subarray(i,i+32768));append(btoa(bin));await new Promise(resolve=>setTimeout(resolve,0));}}
async function prepare(store,item){if(store!=='photos')return {row:item,original:item};const {preview,thumb,...row}=item;for(const kind of ['preview','thumb']){const blob=item[kind];if(blob?.nativeFile){row[kind+'File']=blob.nativeFile;row[kind+'Size']=blob.size;}else if(blob){const token=nativeCall('photoBegin');try{await sendChunks(blob,chunk=>nativeCall('photoAppend',{token,chunk}));const info=nativeCall('photoFinish',{token});row[kind+'File']=info.file;row[kind+'Size']=info.size;}catch(e){try{nativeCall('photoAbort',{token});}catch{}throw e;}}else {row[kind+'File']=null;row[kind+'Size']=0;}}
 row.storedBytes=(row.previewSize||0)+(row.thumbSize||0);return {row,original:item};}
export class NativeStore{
 async open(){nativeCall('open');return this;}
 async all(name){return nativeCall('all',{store:name}).map(p=>hydrate(name,p));}
 async get(name,id){return hydrate(name,nativeCall('get',{store:name,id}));}
 async put(name,item){await this.merge({[name]:[item]});return item;}
 async merge(payload){const data={deletions:payload.deletions||{}},prepared=[];for(const name of STORES){data[name]=[];for(const item of payload[name]||[]){const p=await prepare(name,item);data[name].push(p.row);if(name==='photos')prepared.push(p);}}nativeCall('merge',data);for(const p of prepared)Object.assign(p.original,hydrate('photos',p.row));}
 async remove(name,id){nativeCall('remove',{store:name,id});}
 async removeDemo(){nativeCall('removeDemo');}
 async clear(){nativeCall('clear');}
}
export async function saveNativeFile(blob,name){const token=nativeCall('exportBegin',{name});return new Promise((resolve,reject)=>{const done=e=>{if(e.detail.token!==token)return;window.removeEventListener('android-save-finished',done);e.detail.success?resolve(true):e.detail.cancelled?resolve(false):reject(new Error(e.detail.error||'备份保存失败。'));};window.addEventListener('android-save-finished',done);sendChunks(blob,chunk=>nativeCall('exportAppend',{token,chunk})).then(()=>nativeCall('exportPick',{token})).catch(e=>{window.removeEventListener('android-save-finished',done);reject(e);});});}
