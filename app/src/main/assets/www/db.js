import {NativeStore} from './native.js';
import {BrowserStore} from './browser-store.js';
import {migrateData} from './organize.js';
import {migrateReviewHistory} from './ai-history.js';
export class Store {
 constructor(){this.backend=globalThis.AndroidStorage?new NativeStore():new BrowserStore();}
 async open(){if(!this.ready)this.ready=this.backend.open().then(()=>migrateData(this.backend)).then(()=>migrateReviewHistory(this.backend)).catch(e=>{this.ready=null;throw e;});await this.ready;return this;}
 async all(name){await this.open();return this.backend.all(name);}async get(name,id){await this.open();return this.backend.get(name,id);}async put(name,item){await this.open();return this.backend.put(name,item);}async merge(payload){await this.open();return this.backend.merge(payload);}async remove(name,id){await this.open();return this.backend.remove(name,id);}async removeDemo(){await this.open();const {deleteGroup,deletePhotos}=await import('./organize.js');await deletePhotos(this.backend,(await this.backend.all('photos')).filter(p=>p.demo).map(p=>p.id));await this.backend.removeDemo();for(const g of await this.backend.all('groups'))if(g.demo)await deleteGroup(this.backend,g.id);}async clear(){await this.open();await this.backend.clear();this.ready=null;}close(){this.backend.close?.();this.ready=null;}
}
export function storageMessage(e){return /quota|space|ENOSPC/i.test(e?.name+' '+e?.message)?'本地存储空间不足。已保存的照片仍保留；请先导出备份，再删除不需要的复盘照片。':`本地保存失败：${e?.message||'存储不可用'}。请重试，必要时先导出备份。`;}
