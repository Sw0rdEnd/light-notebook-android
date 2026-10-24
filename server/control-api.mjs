import {HttpError} from './config.mjs';
export function createControlApi({config,ledger,accounts,storage,readJson,json,now}){
 const settings=()=>ledger.settings(config);
 function saveSettings(input,actor){
  const next=settings(),ranges={dailyLimit:[1,10000],perMinute:[1,60],concurrency:[1,4],timeoutMs:[1000,65000],maxTokens:[128,4096],retentionDays:[7,365],storageLimitMb:[1,102400],maxBackupMb:[1,16]};
  const allowed=[...Object.keys(ranges),'aiEnabled','sharedTokenEnabled','model'];
  if(Object.keys(input).some(k=>!allowed.includes(k)))throw new HttpError(400,'INVALID_SETTING','包含不支持的设置。');
  for(const [key,value] of Object.entries(input)){
   if(ranges[key]&&(!Number.isInteger(value)||value<ranges[key][0]||value>ranges[key][1]))throw new HttpError(400,'INVALID_SETTING',`${key}超出允许范围。`);
   if(['aiEnabled','sharedTokenEnabled'].includes(key)&&typeof value!=='boolean'||key==='model'&&(typeof value!=='string'||!/^[a-zA-Z0-9._-]{1,100}$/.test(value)))throw new HttpError(400,'INVALID_SETTING','设置格式无效。');
   next[key]=value;
  }
  if(next.aiEnabled&&!config.key)throw new HttpError(409,'KEY_NOT_CONFIGURED','先在服务器配置DeepSeek密钥，再启用AI。');
  if(next.sharedTokenEnabled&&config.accessToken.length<32)throw new HttpError(409,'SHARED_TOKEN_MISSING','先在服务器配置独立共享口令，或关闭共享口令模式。');
  const used=storage.metrics(next).bytes;if(next.storageLimitMb*1048576<used)throw new HttpError(409,'QUOTA_BELOW_USAGE','站点存储上限不能低于已用空间。');
  ledger.saveSettings(next);accounts.audit(actor,'settings.update',null,{fields:Object.keys(input)});return next;
 }
 return async function control(req,res,url){
  const route=url.pathname,method=req.method;
  if(!route.startsWith('/api/auth/')&&!route.startsWith('/api/admin/')&&!route.startsWith('/api/me/'))return false;
  if(route==='/api/auth/session'&&method==='GET'){const session=config.adminEnabled?accounts.session(req,now()):null;json(res,200,{enabled:config.adminEnabled,emailLoginEnabled:false,user:session?.user||null,csrfToken:session?.csrfToken||null});return true;}
  if(route==='/api/auth/login'&&method==='POST'){
   const result=await accounts.login(req,await readJson(req,16384),now());res.setHeader('Set-Cookie',accounts.cookie(result.token));json(res,200,{user:result.user,csrfToken:result.csrfToken});return true;
  }
  if(route==='/api/auth/email/request'&&method==='POST'){if(req.headers.origin!==config.origin)throw new HttpError(403,'ORIGIN_DENIED','来源不匹配。');throw new HttpError(503,'EMAIL_LOGIN_NOT_CONFIGURED','邮箱登录尚未启用，需接入发信服务与验证码验证。');}
  if(route==='/api/auth/logout'&&method==='POST'){accounts.require(req,{mutation:true});accounts.logout(req);res.setHeader('Set-Cookie',accounts.cookie('',true));json(res,200,{ok:true});return true;}
  const admin=route.startsWith('/api/admin/'),mutation=!['GET','HEAD'].includes(method),session=accounts.require(req,{admin,mutation}),user=session.user;
  if(route==='/api/me/usage'&&method==='GET'){json(res,200,ledger.usage(now(),user.id));return true;}
  if(route==='/api/me/storage'&&method==='GET'){json(res,200,storage.metrics(settings(),user.id));return true;}
  if(route==='/api/me/files'&&method==='POST'){
   if(storage.active>=2)throw new HttpError(429,'STORAGE_BUSY','正在上传备份，请稍后再试。');
   const limits=settings();storage.active++;try{const body=await readJson(req,limits.maxBackupMb*1048576);let name;try{name=decodeURIComponent(req.headers['x-backup-name']||'');}catch{throw new HttpError(400,'INVALID_NAME','备份名称无效。');}json(res,201,await storage.put(user,body,name,settings(),now()));}finally{storage.active--;}return true;
  }
  const file=/^\/api\/(me|admin)\/files\/([a-f0-9-]{36})$/.exec(route);
  if(file&&file[1]==='me'&&method==='GET'){const bytes=await storage.download(file[2],user);res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="light-notebook-backup.json"','Cache-Control':'no-store'});res.end(bytes);return true;}
  if(file&&method==='DELETE'){await storage.remove(file[2],user,admin);accounts.audit(user,'storage.delete',file[2]);json(res,200,{ok:true});return true;}
  if(route==='/api/admin/overview'&&method==='GET'){
   json(res,200,{usage:ledger.usage(now()),users:accounts.list(),storage:storage.metrics(settings()),service:{uptimeSeconds:Math.round(process.uptime()),memoryBytes:process.memoryUsage().rss,aiKeyConfigured:!!config.key,settings:settings(),emailLoginEnabled:false}});return true;
  }
  if(route==='/api/admin/users'&&method==='GET'){json(res,200,{users:accounts.list()});return true;}
  if(route==='/api/admin/users'&&method==='POST'){json(res,201,{user:await accounts.create(await readJson(req,16384),user)});return true;}
  const edit=/^\/api\/admin\/users\/([a-f0-9-]{36})$/.exec(route);
  if(edit&&method==='PATCH'){json(res,200,{user:await accounts.update(edit[1],await readJson(req,16384),user)});return true;}
  if(route==='/api/admin/settings'&&method==='GET'){json(res,200,{settings:settings(),aiKeyConfigured:!!config.key});return true;}
  if(route==='/api/admin/settings'&&method==='PATCH'){json(res,200,{settings:saveSettings(await readJson(req,16384),user)});return true;}
  if(route==='/api/admin/usage'&&method==='GET'){json(res,200,ledger.usage(now(),url.searchParams.get('userId')||null));return true;}
  if(route==='/api/admin/storage'&&method==='GET'){json(res,200,storage.metrics(settings()));return true;}
  if(route==='/api/admin/maintenance'&&method==='POST'){
   const input=await readJson(req,16384);if(input.action!=='prune-history')throw new HttpError(400,'INVALID_ACTION','维护操作无效。');
   const removed=ledger.cleanup(settings().retentionDays,now());ledger.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(now());ledger.db.prepare('DELETE FROM audit WHERE created_at<?').run(now()-90*86400000);accounts.audit(user,'history.prune',null,{removed});json(res,200,{removed});return true;
  }
  if(route==='/api/admin/audit'&&method==='GET'){json(res,200,{entries:ledger.db.prepare('SELECT id,actor_id actorId,action,target_id targetId,created_at createdAt,details FROM audit ORDER BY created_at DESC LIMIT 100').all()});return true;}
  throw new HttpError(404,'NOT_FOUND','接口不存在。');
 };
}
