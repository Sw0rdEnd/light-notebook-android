import {STORES} from './organize.js';
/** Browser preview storage; Android continues to use NativeStore/SQLite. */
export class BrowserStore {
 constructor(name='light-journal-browser-v1'){this.name=name;this.db=null;}
 async open(){if(this.db)return this;this.db=await new Promise((resolve,reject)=>{const req=indexedDB.open(this.name,3);req.onupgradeneeded=()=>{for(const name of STORES)if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name,{keyPath:'id'});};req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();this.db=null;};resolve(req.result);};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('请关闭其他预览标签页后重试。'));});return this;}
 async read(name,method,id){await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(name,'readonly'),req=tx.objectStore(name)[method](id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 all(name){return this.read(name,'getAll');}get(name,id){return this.read(name,'get',id);}
 async write(names,enqueue){await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(names,'readwrite');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('浏览器保存已中止。'));tx.onerror=()=>{};try{enqueue(tx);}catch(error){tx.abort();reject(error);}});}
 async put(name,item){await this.merge({[name]:[item]});return item;}
 async merge(payload){const names=STORES.filter(n=>payload[n]?.length||payload.deletions?.[n]?.length);if(!names.length)return;await this.write(names,tx=>{for(const name of names){for(const id of payload.deletions?.[name]||[])tx.objectStore(name).delete(id);for(const item of payload[name]||[])tx.objectStore(name).put(item);}});}
 async remove(name,id){await this.write([name],tx=>tx.objectStore(name).delete(id));}
 async removeDemo(){await this.write(['sessions','photos'],tx=>{for(const name of ['sessions','photos']){const req=tx.objectStore(name).openCursor();req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;if(cursor.value.demo)cursor.delete();cursor.continue();};}});}
 async clear(){await this.write(STORES,tx=>{for(const name of STORES)tx.objectStore(name).clear();});}
 close(){this.db?.close();this.db=null;}
}
