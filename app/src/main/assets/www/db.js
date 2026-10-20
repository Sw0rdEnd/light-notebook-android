import {NativeStore} from './native.js';
import {BrowserStore} from './browser-store.js';
export class Store {
 constructor(){this.backend=globalThis.AndroidStorage?new NativeStore():new BrowserStore();}
 open(){return this.backend.open().then(()=>this);}all(name){return this.backend.all(name);}get(name,id){return this.backend.get(name,id);}put(name,item){return this.backend.put(name,item);}merge(payload){return this.backend.merge(payload);}remove(name,id){return this.backend.remove(name,id);}removeDemo(){return this.backend.removeDemo();}clear(){return this.backend.clear();}close(){this.backend.close?.();}
}
export function storageMessage(e){return /quota|space|ENOSPC/i.test(e?.name+' '+e?.message)?'本地存储空间不足。已保存的照片仍保留；请先导出备份，再删除不需要的复盘照片。':`本地保存失败：${e?.message||'存储不可用'}。请重试，必要时先导出备份。`;}
