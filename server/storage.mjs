import {mkdirSync,readdirSync,unlinkSync,statSync,statfsSync} from 'node:fs';
import {writeFile,readFile,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {HttpError} from './config.mjs';
import {validateBackup} from '../dist/backup.js';
export class CloudStorage {
 constructor(db,directory){
  this.db=db;this.directory=directory;this.root=path.join(directory,'objects');this.active=0;
  mkdirSync(this.root,{recursive:true,mode:0o700});
  db.exec('CREATE TABLE IF NOT EXISTS cloud_files(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,created_at INTEGER NOT NULL)');
  // Only this application owns UUID-named objects. Reconcile interrupted writes/deletes.
  for(const filename of readdirSync(this.root))if(/^[a-f0-9-]{36}\.json$/.test(filename)&&!db.prepare('SELECT 1 FROM cloud_files WHERE id=?').get(filename.slice(0,-5)))unlinkSync(path.join(this.root,filename));
 }
 list(userId=null){return this.db.prepare(`SELECT id,user_id userId,name,size,sha256,created_at createdAt FROM cloud_files ${userId?'WHERE user_id=?':''} ORDER BY created_at DESC LIMIT 200`).all(...(userId?[userId]:[]));}
 metrics(settings,userId=null){
  const used=this.db.prepare(`SELECT count(*) files,coalesce(sum(size),0) bytes FROM cloud_files ${userId?'WHERE user_id=?':''}`).get(...(userId?[userId]:[]));
  let freeBytes=null;try{const disk=statfsSync(this.directory);freeBytes=disk.bavail*disk.bsize;}catch{}
  let databaseBytes=0;for(const suffix of ['','-wal','-shm'])try{databaseBytes+=statSync(path.join(this.directory,'usage.sqlite'+suffix)).size;}catch{}
  return {...used,limitMb:userId?this.db.prepare('SELECT storage_quota_mb n FROM accounts WHERE id=?').get(userId)?.n:settings.storageLimitMb,maxBackupMb:settings.maxBackupMb,...(!userId?{freeBytes,databaseBytes}:{}),filesList:this.list(userId)};
 }
 async put(user,body,name,settings,now=Date.now()){
  try{validateBackup(body);}catch{throw new HttpError(400,'INVALID_BACKUP','请上传有效的光影练习册JSON备份。');}
  const bytes=Buffer.from(JSON.stringify(body));if(bytes.length>settings.maxBackupMb*1048576)throw new HttpError(413,'BACKUP_TOO_LARGE','备份超过单文件限制，可尝试仅备份记录。');
  const id=randomUUID(),filename=path.join(this.root,id+'.json');
  try{
   await writeFile(filename,bytes,{flag:'wx',mode:0o600});
   this.db.exec('BEGIN IMMEDIATE');try{
    const saved=this.db.prepare('SELECT value FROM runtime_settings WHERE id=1').get(),live={...settings,...(saved?JSON.parse(saved.value):{})};
    if(bytes.length>live.maxBackupMb*1048576)throw new HttpError(413,'BACKUP_TOO_LARGE','单文件限制已调整，请缩小备份后重新上传。');
    const account=this.db.prepare('SELECT status,storage_quota_mb FROM accounts WHERE id=?').get(user.id);
    if(account?.status!=='active')throw new HttpError(403,'ACCOUNT_DISABLED','账户已停用。');
    const personal=this.db.prepare('SELECT coalesce(sum(size),0) bytes,count(*) files FROM cloud_files WHERE user_id=?').get(user.id),total=this.db.prepare('SELECT coalesce(sum(size),0) bytes,count(*) files FROM cloud_files').get();
    if(personal.files>=200||total.files>=10000)throw new HttpError(409,'BACKUP_COUNT_LIMIT','云备份数量达到上限，请先下载并删除旧备份。');
    if(personal.bytes+bytes.length>account.storage_quota_mb*1048576)throw new HttpError(409,'USER_STORAGE_LIMIT','你的云存储空间不足。');
    if(total.bytes+bytes.length>live.storageLimitMb*1048576)throw new HttpError(409,'SITE_STORAGE_LIMIT','站点云存储空间不足。');
    this.db.prepare('INSERT INTO cloud_files VALUES(?,?,?,?,?,?)').run(id,user.id,String(name||'光影练习册备份.json').replace(/[\x00-\x1f]/g,'').slice(0,100),bytes.length,createHash('sha256').update(bytes).digest('hex'),now);this.db.exec('COMMIT');
   }catch(error){this.db.exec('ROLLBACK');throw error;}
   return this.db.prepare('SELECT id,name,size,created_at createdAt FROM cloud_files WHERE id=?').get(id);
  }catch(error){await unlink(filename).catch(()=>{});throw error;}
 }
 owned(id,user,admin=false){const row=this.db.prepare('SELECT * FROM cloud_files WHERE id=?').get(id);if(!row||!admin&&row.user_id!==user.id)throw new HttpError(404,'FILE_NOT_FOUND','云备份不存在。');return row;}
 async download(id,user){this.owned(id,user);try{return await readFile(path.join(this.root,id+'.json'));}catch{throw new HttpError(404,'FILE_MISSING','备份文件缺失，请联系管理员检查恢复记录。');}}
 async remove(id,user,admin=false){const row=this.owned(id,user,admin);try{await unlink(path.join(this.root,id+'.json'));}catch(error){if(error.code!=='ENOENT')throw error;}this.db.prepare('DELETE FROM cloud_files WHERE id=?').run(id);return row;}
}
