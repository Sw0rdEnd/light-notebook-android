import http from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash,timingSafeEqual} from 'node:crypto';
import {HttpError,MAX_BODY} from './config.mjs';
import {Ledger} from './ledger.mjs';
import {validateInput,evaluateDeepseek} from './deepseek.mjs';
import {Accounts} from './accounts.mjs';
import {CloudStorage} from './storage.mjs';
import {createControlApi} from './control-api.mjs';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const digest=value=>createHash('sha256').update(value).digest();
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function readJson(req,limit=MAX_BODY){return new Promise((resolve,reject)=>{
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return reject(new HttpError(415,'CONTENT_TYPE','请使用JSON请求。'));
 if(Number(req.headers['content-length'])>limit)return reject(new HttpError(413,'BODY_TOO_LARGE','请求超过大小限制。'));
 let size=0,done=false;const chunks=[];
 const fail=error=>{if(done)return;done=true;req.pause();reject(error);};
 req.on('aborted',()=>fail(new HttpError(400,'ABORTED','请求已取消。')));req.on('error',()=>fail(new HttpError(400,'INVALID_BODY','请求读取失败。')));
 req.on('data',chunk=>{if(done)return;size+=chunk.length;if(size>limit)return fail(new HttpError(413,'BODY_TOO_LARGE','请求超过大小限制。'));chunks.push(chunk);});
 req.on('end',()=>{if(done)return;done=true;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new HttpError(400,'INVALID_JSON','请求不是有效JSON。'));}});
});}
export function createApp(config,{fetchImpl=fetch,now=Date.now,logger=()=>{}}={}){
 const ledger=new Ledger(config.dataDir),storage=new CloudStorage(ledger.db,config.dataDir),accounts=new Accounts(ledger.db,config,{now});
 ledger.db.prepare("UPDATE attempts SET status='interrupted' WHERE status='pending'").run();
 const control=createControlApi({config,ledger,accounts,storage,readJson,json,now});let active=0;
 const server=http.createServer(async(req,res)=>{
  const started=Date.now();let requestId=null,abort;
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.on('finish',()=>logger({method:req.method,status:res.statusCode,durationMs:Date.now()-started}));
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{status:'ok',version:'0.4.0-admin-prep'});
   if(await control(req,res,url))return;
   const settings=ledger.settings(config),effective={...config,...settings,enabled:settings.aiEnabled&&!!config.key};
   if(url.pathname==='/api/ai/status'&&req.method==='GET'){
    const session=config.adminEnabled?accounts.session(req,now()):null;
    return json(res,200,{enabled:effective.enabled,requiresAccessCode:!session&&settings.sharedTokenEnabled,accountRequired:!settings.sharedTokenEnabled,signedIn:!!session,csrfToken:session?.csrfToken||null,maxPhotos:2,message:effective.enabled?'AI已配置，可主动提交。':'AI尚未启用，照片没有发送。'});
   }
   if(url.pathname==='/api/ai/evaluate'){
    if(req.method!=='POST')throw new HttpError(405,'METHOD_NOT_ALLOWED','此接口需要POST请求。');
    if(req.headers.origin&&req.headers.origin!==config.origin)throw new HttpError(403,'ORIGIN_DENIED','请求来源不匹配。');
    if(req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'ORIGIN_DENIED','请在本站发起AI分析。');
    if(!effective.enabled)throw new HttpError(503,'AI_NOT_CONFIGURED','AI尚未启用，照片没有转发。');
    const auth=req.headers.authorization||'';
    let user=null;
    if(auth){if(!settings.sharedTokenEnabled||auth.length>1024||!auth.startsWith('Bearer ')||!timingSafeEqual(digest(auth.slice(7)),digest(config.accessToken)))throw new HttpError(401,'ACCESS_DENIED','AI访问口令无效，请向站点管理员获取。');}
    else user=accounts.require(req,{mutation:true}).user;
    if(active>=effective.concurrency)throw new HttpError(429,'AI_BUSY','AI分析正在处理，请稍后再试。');
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new HttpError(415,'CONTENT_TYPE','请使用JSON请求。');
    if(Number(req.headers['content-length'])>MAX_BODY)throw new HttpError(413,'BODY_TOO_LARGE','图片请求过大。');
    active++;try{
     const input=validateInput(await readJson(req));requestId=input.requestId;const live={...effective,...ledger.settings(config)};
     if(!live.aiEnabled)throw new HttpError(503,'AI_NOT_CONFIGURED','AI已暂停，照片没有转发。');
     if(auth&&!live.sharedTokenEnabled)throw new HttpError(403,'SHARED_TOKEN_DISABLED','共享口令已关闭，请登录账户。');
     if(user)accounts.require(req,{mutation:true});
     ledger.reserve(requestId,live,now(),user);
     abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
     const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(live.timeoutMs)]);
     try{const result=await evaluateDeepseek(input,live,signal,fetchImpl,usage=>ledger.recordUsage(requestId,usage));ledger.complete(requestId,'ok',Date.now()-started);if(!res.destroyed)json(res,200,result);}
     catch(error){ledger.complete(requestId,signal.aborted?'cancelled':'provider_error',Date.now()-started);throw error;}
    }finally{active--;}
    return;
   }
   if(url.pathname.startsWith('/api/'))throw new HttpError(404,'NOT_FOUND','接口不存在。');
   if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'METHOD_NOT_ALLOWED','请求方法不支持。');
   let relative;try{relative=decodeURIComponent(url.pathname);}catch{throw new HttpError(400,'INVALID_PATH','路径无效。');}
   if(relative.includes('\0')||relative.split('/').some(segment=>segment.startsWith('.'))||relative.includes('\\'))throw new HttpError(404,'NOT_FOUND','文件不存在。');
   if(['/admin','/account'].includes(relative)){res.writeHead(302,{Location:relative+'/','Cache-Control':'no-store'});res.end();return;}
   const candidate=path.resolve(config.staticDir,'.'+(relative.endsWith('/')?relative+'index.html':relative));
   let file;try{file=await realpath(candidate);}catch{throw new HttpError(404,'NOT_FOUND','文件不存在。');}
   const root=await realpath(config.staticDir),type=mime[path.extname(file)];
   if(!file.startsWith(root+path.sep)||!type||!(await stat(file)).isFile())throw new HttpError(404,'NOT_FOUND','文件不存在。');
   const privateUi=relative.startsWith('/admin/')||relative.startsWith('/account/');
   if(privateUi)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
   res.writeHead(200,{'Content-Type':type,'Cache-Control':privateUi?'no-store':'no-cache'});if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch(error){if(!res.destroyed&&!res.headersSent){res.setHeader('Connection','close');json(res,error instanceof HttpError?error.status:500,{code:error instanceof HttpError?error.code:'INTERNAL_ERROR',message:error instanceof HttpError?error.message:'服务暂时不可用，请稍后再试。',...(requestId?{requestId}:{})});}}
 });
 server.requestTimeout=20000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
 return {server,ledger,accounts,storage,close:()=>new Promise(resolve=>{server.close(()=>{ledger.close();resolve();});server.closeIdleConnections();})};
}
