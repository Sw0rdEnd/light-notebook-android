import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {HttpError} from './config.mjs';
export const dayKey=timestamp=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
export class Ledger {
 constructor(directory){
  mkdirSync(directory,{recursive:true,mode:0o700});this.filename=path.join(directory,'usage.sqlite');this.db=new DatabaseSync(this.filename);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=2000;
   CREATE TABLE IF NOT EXISTS attempts (request_id TEXT PRIMARY KEY, day TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS attempts_day ON attempts(day); CREATE INDEX IF NOT EXISTS attempts_time ON attempts(created_at);
   CREATE TABLE IF NOT EXISTS runtime_settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS cloud_files(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,created_at INTEGER NOT NULL);`);
  const columns=new Set(this.db.prepare('PRAGMA table_info(attempts)').all().map(c=>c.name));
  for(const [name,type] of Object.entries({user_id:'TEXT',model:'TEXT',input_tokens:'INTEGER',output_tokens:'INTEGER',cached_tokens:'INTEGER',duration_ms:'INTEGER'}))if(!columns.has(name))this.db.exec(`ALTER TABLE attempts ADD COLUMN ${name} ${type}`);
  this.db.exec('CREATE INDEX IF NOT EXISTS attempts_user_day ON attempts(user_id,day)');
  this.db.exec('CREATE INDEX IF NOT EXISTS cloud_files_user_time ON cloud_files(user_id,created_at); CREATE INDEX IF NOT EXISTS cloud_files_time ON cloud_files(created_at)');
 }
 settings(config){
  const stored=this.db.prepare('SELECT value FROM runtime_settings WHERE id=1').get();
  return {aiEnabled:config.enabled,sharedTokenEnabled:config.allowSharedToken!==false,dailyLimit:config.dailyLimit,perMinute:config.perMinute,concurrency:config.concurrency,timeoutMs:config.timeoutMs,maxTokens:config.maxTokens,model:config.model,retentionDays:31,storageLimitMb:1024,maxBackupMb:16,...(stored?JSON.parse(stored.value):{})};
 }
 saveSettings(value){this.db.prepare('INSERT INTO runtime_settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(value));}
 reserve(requestId,config,now=Date.now(),user=null){
  const day=dayKey(now);this.db.exec('BEGIN IMMEDIATE');
  try{
   this.db.prepare('DELETE FROM attempts WHERE created_at < ? AND status != ?').run(now-(config.retentionDays||31)*86400000,'pending');
   if(this.db.prepare('SELECT 1 FROM attempts WHERE request_id=?').get(requestId))throw new HttpError(409,'ALREADY_SUBMITTED','这次请求已经提交，请勿重复发送。');
   if(this.db.prepare('SELECT count(*) AS n FROM attempts WHERE day=?').get(day).n>=config.dailyLimit)throw new HttpError(429,'DAILY_LIMIT','今日AI调用额度已用完，请明天再试。');
   if(this.db.prepare('SELECT count(*) AS n FROM attempts WHERE created_at>=?').get(now-60000).n>=config.perMinute)throw new HttpError(429,'RATE_LIMIT','调用较频繁，请稍后再试。');
   if(user){
    const account=this.db.prepare('SELECT status,ai_allowed,daily_limit FROM accounts WHERE id=?').get(user.id);
    if(!account||account.status!=='active'||!account.ai_allowed)throw new HttpError(403,'AI_FORBIDDEN','此账户暂不可使用AI。');
    if(this.db.prepare('SELECT count(*) AS n FROM attempts WHERE user_id=? AND day=?').get(user.id,day).n>=account.daily_limit)throw new HttpError(429,'USER_DAILY_LIMIT','你的今日AI额度已用完。');
   }
   this.db.prepare('INSERT INTO attempts(request_id,day,created_at,status,user_id,model) VALUES(?,?,?,?,?,?)').run(requestId,day,now,'pending',user?.id||null,config.model||null);this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 recordUsage(requestId,usage){
  const integer=v=>Number.isSafeInteger(v)&&v>=0&&v<=1e9?v:null;
  const input=integer(usage?.prompt_tokens),output=integer(usage?.completion_tokens),cached=integer(usage?.prompt_cache_hit_tokens??usage?.prompt_tokens_details?.cached_tokens);
  this.db.prepare('UPDATE attempts SET input_tokens=?,output_tokens=?,cached_tokens=? WHERE request_id=?').run(input,output,cached!=null&&input!=null&&cached<=input?cached:null,requestId);
 }
 complete(requestId,status,durationMs=null){this.db.prepare('UPDATE attempts SET status=?,duration_ms=? WHERE request_id=?').run(status,durationMs,requestId);}
 usage(now=Date.now(),userId=null){
  const since=dayKey(now-13*86400000),where=userId?' AND user_id=?':'',params=userId?[since,userId]:[since];
  const rows=this.db.prepare(`SELECT day,count(*) attempts,sum(status='ok') success,sum(status NOT IN ('ok','pending')) failed,sum(status='pending') pending,
   coalesce(sum(input_tokens),0) inputTokens,coalesce(sum(output_tokens),0) outputTokens,coalesce(sum(cached_tokens),0) cachedTokens,
   sum(input_tokens IS NULL OR output_tokens IS NULL) unknownUsage,round(avg(duration_ms)) averageMs
   FROM attempts WHERE day>=?${where} GROUP BY day ORDER BY day`).all(...params);
  const days=Array.from({length:14},(_,i)=>{const day=dayKey(now-(13-i)*86400000);return rows.find(r=>r.day===day)||{day,attempts:0,success:0,failed:0,pending:0,inputTokens:0,outputTokens:0,cachedTokens:0,unknownUsage:0,averageMs:null};});
  const totals={};for(const key of ['attempts','success','failed','pending','inputTokens','outputTokens','cachedTokens','unknownUsage'])totals[key]=days.reduce((n,row)=>n+row[key],0);
  const recent=this.db.prepare(`SELECT request_id requestId,day,created_at createdAt,status,user_id userId,model,input_tokens inputTokens,output_tokens outputTokens,duration_ms durationMs FROM attempts WHERE day>=?${where} ORDER BY created_at DESC,request_id LIMIT 100`).all(...params);
  return {totals,today:days.at(-1),days,recent};
 }
 cleanup(retentionDays,now=Date.now()) {return this.db.prepare("DELETE FROM attempts WHERE created_at < ? AND status!='pending'").run(now-retentionDays*86400000).changes;}
 async snapshot(destination){await backup(this.db,destination);return destination;}
 close(){this.db.close();}
}
