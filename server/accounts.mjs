import {randomBytes,randomUUID,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {HttpError} from './config.mjs';
const derive=promisify(scrypt),hash=value=>createHash('sha256').update(value).digest('hex');
const COOKIE='lj_session',SESSION_MS=8*3600000;
const fail=(status,code,message)=>{throw new HttpError(status,code,message);};
export async function passwordHash(password){
 if(typeof password!=='string'||password.length<12||password.length>128)fail(400,'PASSWORD_LENGTH','密码长度需要12至128个字符。');
 const salt=randomBytes(16).toString('hex'),key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password,encoded){
 const [,salt,key]=encoded.split('$');const actual=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return timingSafeEqual(Buffer.from(key,'hex'),actual);
}
const publicUser=row=>row?{id:row.id,username:row.username,displayName:row.display_name,email:row.email,emailVerified:false,role:row.role,status:row.status,aiAllowed:!!row.ai_allowed,dailyLimit:row.daily_limit,storageQuotaMb:row.storage_quota_mb,createdAt:row.created_at}:null;
export class Accounts {
 constructor(db,config,{now=Date.now}={}){
  this.db=db;this.config=config;this.inflight=0;this.now=now;
  db.exec(`CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,display_name TEXT NOT NULL,email TEXT UNIQUE COLLATE NOCASE,email_verified_at INTEGER,role TEXT NOT NULL CHECK(role IN ('admin','user')),status TEXT NOT NULL CHECK(status IN ('active','disabled')),password_hash TEXT NOT NULL,ai_allowed INTEGER NOT NULL,daily_limit INTEGER NOT NULL,storage_quota_mb INTEGER NOT NULL,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS session_user ON auth_sessions(user_id);
   CREATE TABLE IF NOT EXISTS auth_throttle(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor_id TEXT,action TEXT NOT NULL,target_id TEXT,created_at INTEGER NOT NULL,details TEXT NOT NULL);`);
 }
 audit(actor,action,target,details={}){this.db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(randomUUID(),actor?.id||null,action,target||null,Date.now(),JSON.stringify(details));}
 get(id){return publicUser(this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id));}
 list(){return this.db.prepare(`SELECT a.*,coalesce((SELECT sum(size) FROM cloud_files f WHERE f.user_id=a.id),0) storage_bytes FROM accounts a ORDER BY created_at DESC`).all().map(r=>({...publicUser(r),storageBytes:r.storage_bytes}));}
 async create(input,actor=null,{bootstrap=false}={}){
  const username=String(input.username||'').trim(),displayName=String(input.displayName||username).trim(),email=input.email?String(input.email).trim().toLowerCase():null;
  if(!/^[A-Za-z0-9_.-]{3,64}$/.test(username)||!displayName||displayName.length>60)fail(400,'INVALID_USER','用户名需为3至64位字母、数字、点、横线或下划线；显示名最多60字。');
  if(email&&(email.length>254||!/^\S+@\S+\.\S+$/.test(email)))fail(400,'INVALID_EMAIL','邮箱格式无效。');
  const role=input.role||'user';if(!['admin','user'].includes(role))fail(400,'INVALID_ROLE','角色无效。');
  const dailyLimit=input.dailyLimit??20,storageQuotaMb=input.storageQuotaMb??100;
  if(!Number.isInteger(dailyLimit)||dailyLimit<0||dailyLimit>10000||!Number.isInteger(storageQuotaMb)||storageQuotaMb<0||storageQuotaMb>102400)fail(400,'INVALID_QUOTA','用户额度无效。');
  if(input.aiAllowed!=null&&typeof input.aiAllowed!=='boolean')fail(400,'INVALID_USER','AI权限无效。');
  const encoded=await passwordHash(input.password),id=randomUUID();
  this.db.exec('BEGIN IMMEDIATE');try{
   if(bootstrap&&this.db.prepare("SELECT 1 FROM accounts WHERE role='admin' AND status='active'").get())fail(409,'ALREADY_INITIALIZED','已有管理员；需要重置密码时使用本机reset-password命令。');
   if(actor?.id&&(this.get(actor.id)?.role!=='admin'||this.get(actor.id)?.status!=='active'))fail(403,'ADMIN_REQUIRED','管理员权限已变更。');
   this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?,NULL,?,?,?,?,?,?,?)').run(id,username,displayName,email,role,'active',encoded,input.aiAllowed===false?0:1,dailyLimit,storageQuotaMb,Date.now());
   this.audit(actor,'user.create',id,{role});this.db.exec('COMMIT');return this.get(id);
  }catch(error){this.db.exec('ROLLBACK');if(String(error.code).includes('CONSTRAINT'))fail(409,'USER_EXISTS','用户名或邮箱已被使用。');throw error;}
 }
 async update(id,input,actor){
  const password=input.password?await passwordHash(input.password):null;
  this.db.exec('BEGIN IMMEDIATE');try{
   const current=this.get(id);if(!current)fail(404,'USER_NOT_FOUND','用户不存在。');
   if(actor&&(!this.get(actor.id)||this.get(actor.id).role!=='admin'||this.get(actor.id).status!=='active'))fail(403,'ADMIN_REQUIRED','管理员权限已变更。');
   const next={...current,...Object.fromEntries(['displayName','email','role','status','aiAllowed','dailyLimit','storageQuotaMb'].filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]]))};
   next.email=next.email?String(next.email).trim().toLowerCase():null;
   if(typeof next.displayName!=='string'||!next.displayName.trim()||next.displayName.length>60||!['admin','user'].includes(next.role)||!['active','disabled'].includes(next.status)||typeof next.aiAllowed!=='boolean'||!Number.isInteger(next.dailyLimit)||next.dailyLimit<0||next.dailyLimit>10000||!Number.isInteger(next.storageQuotaMb)||next.storageQuotaMb<0||next.storageQuotaMb>102400||next.email&&(next.email.length>254||!/^\S+@\S+\.\S+$/.test(next.email)))fail(400,'INVALID_USER','用户资料或额度无效。');
   if(current.role==='admin'&&current.status==='active'&&(next.role!=='admin'||next.status!=='active')&&this.db.prepare("SELECT count(*) n FROM accounts WHERE role='admin' AND status='active'").get().n<=1)fail(409,'LAST_ADMIN','至少保留一个启用的管理员。');
   const used=this.db.prepare('SELECT coalesce(sum(size),0) n FROM cloud_files WHERE user_id=?').get(id).n;if(used>next.storageQuotaMb*1048576)fail(409,'QUOTA_BELOW_USAGE','存储额度不能低于已用空间，请先处理云备份。');
   this.db.prepare('UPDATE accounts SET display_name=?,email=?,email_verified_at=NULL,role=?,status=?,ai_allowed=?,daily_limit=?,storage_quota_mb=? WHERE id=?').run(next.displayName.trim(),next.email,next.role,next.status,+next.aiAllowed,next.dailyLimit,next.storageQuotaMb,id);
   if(password)this.db.prepare('UPDATE accounts SET password_hash=? WHERE id=?').run(password,id);
   if(password||next.status!==current.status||next.role!==current.role)this.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id);
   this.audit(actor,'user.update',id,{fields:Object.keys(input).filter(k=>k!=='password'),passwordReset:!!password});this.db.exec('COMMIT');return this.get(id);
  }catch(error){this.db.exec('ROLLBACK');if(String(error.code).includes('CONSTRAINT'))fail(409,'EMAIL_EXISTS','邮箱已被使用。');throw error;}
 }
 token(req){const match=(req.headers.cookie||'').match(/(?:^|;\s*)lj_session=([a-f0-9]{64})(?:;|$)/);return match?.[1]||null;}
 session(req,now=this.now()){
  const token=this.token(req);if(!token)return null;
  const row=this.db.prepare("SELECT a.* FROM auth_sessions s JOIN accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'").get(hash(token),now);
  return row?{user:publicUser(row),csrfToken:hash('csrf:'+token)}:null;
 }
 require(req,{admin=false,mutation=false}={}){
  if(!this.config.adminEnabled)fail(503,'ACCOUNTS_DISABLED','账户服务尚未启用。');
  const session=this.session(req);if(!session)fail(401,'LOGIN_REQUIRED','请先登录账户。');
  if(admin&&session.user.role!=='admin')fail(403,'ADMIN_REQUIRED','需要管理员权限。');
  if(mutation&&(req.headers.origin!==this.config.origin||req.headers['x-csrf-token']!==session.csrfToken))fail(403,'CSRF_DENIED','页面验证已失效，请刷新后重试。');return session;
 }
 cookie(token,clear=false){return `${COOKIE}=${token||''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:SESSION_MS/1000}${this.config.origin.startsWith('https:')?'; Secure':''}`;}
 async login(req,input,now=this.now()){
  if(!this.config.adminEnabled)fail(503,'ACCOUNTS_DISABLED','账户服务尚未启用。');
  if(req.headers.origin!==this.config.origin)fail(403,'ORIGIN_DENIED','登录来源不匹配。');
  const username=typeof input.username==='string'?input.username.slice(0,64):'',password=typeof input.password==='string'?input.password:'';
  if(!username||password.length<1||password.length>128)fail(401,'LOGIN_FAILED','用户名或密码错误。');
  this.db.prepare('DELETE FROM auth_throttle WHERE expires_at<=?').run(now);this.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(now);
  const keys=['ip:'+hash(this.config.trustProxy?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress||'unknown'),'name:'+hash(username.toLowerCase())];
  for(const key of keys)if((this.db.prepare('SELECT count FROM auth_throttle WHERE key=?').get(key)?.count||0)>=10)fail(429,'LOGIN_RATE_LIMIT','登录尝试过多，请15分钟后再试。');
  if(this.inflight>=2)fail(429,'LOGIN_BUSY','登录请求较多，请稍后再试。');
  for(const key of keys)this.db.prepare('INSERT INTO auth_throttle VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+15*60000);
  this.inflight++;let row,valid;try{
   row=this.db.prepare('SELECT * FROM accounts WHERE username=? COLLATE NOCASE').get(username);
   valid=await verifyPassword(password,row?.password_hash||`scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`);
  }finally{this.inflight--;}
  row=row&&this.db.prepare('SELECT * FROM accounts WHERE id=? AND password_hash=?').get(row.id,row.password_hash);
  if(!valid||row?.status!=='active')fail(401,'LOGIN_FAILED','用户名或密码错误。');
  this.db.prepare('DELETE FROM auth_throttle WHERE key=?').run(keys[1]);
  const old=this.token(req);if(old)this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(old));
  const token=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(hash(token),row.id,now+SESSION_MS);
  this.db.prepare('DELETE FROM auth_sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM auth_sessions WHERE user_id=? ORDER BY expires_at DESC,rowid DESC LIMIT 10)').run(row.id,row.id);
  this.audit(publicUser(row),'auth.login',row.id);return {token,user:publicUser(row),csrfToken:hash('csrf:'+token)};
 }
 logout(req){const token=this.token(req);if(token)this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(token));}
}
