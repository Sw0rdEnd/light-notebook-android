import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {readConfig,MAX_BODY} from '../server/config.mjs';
import {createApp} from '../server/app.mjs';
import {Ledger} from '../server/ledger.mjs';
import {validateInput} from '../server/deepseek.mjs';
const token='test-access-code-'.repeat(3),jpeg='data:image/jpeg;base64,/9j/2Q==';
const request=(count=2)=>({schema:'light-journal.ai-upload.v1',requestId:crypto.randomUUID(),note:'比较背景和光线',learningContext:{theme:'composition',scene:'park',tasks:[]},photos:Array.from({length:count},(_,i)=>({label:i?'B':'A',image:jpeg,exif:{focal:i?85:35,GPSLatitude:'private'},corrections:{},reviewNote:''}))});
const output=(preferred='A')=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'A的背景更简洁',observations:[{aspect:'构图',basis:'observation',text:'A的主体周围留白更多'}],nextSteps:['下次在相同位置比较35mm和50mm'],preferred})}}]});
async function fixture(t,{enabled=true,fetchImpl=async()=>Response.json(output()),...overrides}={}){
 const dir=await mkdtemp(path.join(tmpdir(),'light-server-')),config={...readConfig({AI_ENABLED:String(enabled),DEEPSEEK_API_KEY:'test-provider-key',AI_ACCESS_TOKEN:token,PUBLIC_ORIGIN:'http://localhost:8080',DATA_DIR:dir,STATIC_DIR:path.resolve('dist')}),...overrides};
 const logs=[],app=createApp(config,{fetchImpl,logger:line=>logs.push(line)});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 return {...app,base,config,logs,post:(body=request(),headers={})=>fetch(base+'/api/ai/evaluate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify(body)})};
}
test('disabled service serves the real web app and safe status without sending photos or exposing env/source',async t=>{
 let calls=0;const app=await fixture(t,{enabled:false,fetchImpl:async()=>{calls++;throw new Error('not allowed');}});
 assert.equal((await (await fetch(app.base+'/api/health')).json()).status,'ok');assert.equal((await (await fetch(app.base+'/api/ai/status')).json()).enabled,false);
 assert.match(await (await fetch(app.base+'/')).text(),/motion.css/);assert.equal((await fetch(app.base+'/ai-ui.js')).status,200);
 const source=await (await fetch(app.base+'/app.js')).text();assert.match(source,/需管理员启用/);assert.match(source,/发送给DeepSeek/);assert.match(source,/服务器预备版 0.4.0/);assert.ok(!source.includes('照片不上传'));
 for(const route of ['/.env','/server/index.mjs','/%2e%2e%2f.env'])assert.equal((await fetch(app.base+route)).status,404);
 const response=await app.post();assert.equal(response.status,503);assert.equal((await response.json()).code,'AI_NOT_CONFIGURED');assert.equal(calls,0);
 assert.ok(!JSON.stringify(app.logs).includes('test-provider-key'));
});
test('auth, origin and image input failures never reach provider or consume paid-attempt quota',async t=>{
 let calls=0;const app=await fixture(t,{fetchImpl:async()=>{calls++;return Response.json(output());}});
 assert.equal((await app.post(request(),{Authorization:'Bearer invalid'})).status,401);
 assert.equal((await app.post(request(),{Origin:'https://other.example'})).status,403);
 assert.equal((await app.post(request(),{'Sec-Fetch-Site':'cross-site'})).status,403);
 const external=request();external.photos[0].image='http://169.254.169.254/latest/meta-data';assert.equal((await app.post(external)).status,400);
 const tooMany=request(3);assert.equal((await app.post(tooMany)).status,400);
 const bad=request();bad.photos[0].image='data:image/jpeg;base64,YmFk';assert.equal((await app.post(bad)).status,400);
 const huge={...request(),note:'x'.repeat(MAX_BODY)};assert.equal((await app.post(huge)).status,413);
 assert.equal(app.ledger.db.prepare('SELECT count(*) AS n FROM attempts').get().n,0);assert.equal(calls,0);
});
test('valid two-image request reaches DeepSeek as actual image blocks, produces structured result, rejects duplicates and respects daily cap',async t=>{
 let sent;const app=await fixture(t,{dailyLimit:1,fetchImpl:async(url,options)=>{sent={url,...options,body:JSON.parse(options.body)};return Response.json(output());}});
 const body=request(),response=await app.post(body);assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.requestId,body.requestId);assert.equal(result.preferred,'A');assert.equal(result.observations[0].basis,'observation');
 assert.equal(sent.url,'https://api.deepseek.com/chat/completions');assert.equal(sent.headers.Authorization,'Bearer test-provider-key');assert.equal(sent.body.model,'deepseek-flash');assert.deepEqual(sent.body.thinking,{type:'disabled'});
 assert.equal(sent.body.messages[1].content.filter(c=>c.type==='image_url').length,2);assert.ok(!JSON.stringify(sent.body).includes('GPSLatitude'));
 assert.equal((await app.post(body)).status,409);assert.equal((await app.post(request())).status,429);
 assert.equal(app.ledger.db.prepare('SELECT status FROM attempts').get().status,'ok');assert.ok(!JSON.stringify(app.logs).includes('image/jpeg'));
});
test('concurrency does not queue extra image requests or reserve their quota',async t=>{
 let start,release;const started=new Promise(resolve=>start=resolve),gate=new Promise(resolve=>release=resolve);
 const app=await fixture(t,{concurrency:1,fetchImpl:async()=>{start();await gate;return Response.json(output());}});
 const first=app.post();await started;const next=await app.post();assert.equal(next.status,429);assert.equal((await next.json()).code,'AI_BUSY');
 release();assert.equal((await first).status,200);assert.equal(app.ledger.db.prepare('SELECT count(*) AS n FROM attempts').get().n,1);
});
test('provider timeout and malformed/truncated output return real failures, never fabricated evaluations',async t=>{
 const timeout=await fixture(t,{timeoutMs:50,fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 const response=await timeout.post();assert.equal(response.status,504);assert.equal((await response.json()).code,'AI_TIMEOUT');
 const invalid=await fixture(t,{fetchImpl:async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{"summary":"half'}}]})});
 const r=await invalid.post();assert.equal(r.status,502);assert.equal((await r.json()).summary,undefined);
 const single=await fixture(t,{fetchImpl:async()=>Response.json(output('B'))});assert.equal((await single.post(request(1))).status,502);
});
test('client disconnect aborts upstream wait and records cancellation',async t=>{
 let start,aborted;const started=new Promise(resolve=>start=resolve),cancelled=new Promise(resolve=>aborted=resolve);
 const app=await fixture(t,{fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>{start();signal.addEventListener('abort',()=>{aborted();reject(signal.reason);},{once:true});})});
 const controller=new AbortController(),pending=fetch(app.base+'/api/ai/evaluate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(request()),signal:controller.signal});
 await started;controller.abort();await assert.rejects(pending);await cancelled;
 await new Promise(resolve=>setTimeout(resolve,30));assert.equal(app.ledger.db.prepare('SELECT status FROM attempts').get().status,'cancelled');
});
test('quota persists after reopening, snapshots restore consistently, and Shanghai midnight resets daily count',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'light-ledger-'));t.after(()=>rm(dir,{recursive:true,force:true}));let ledger=new Ledger(dir);
 const config={dailyLimit:1,perMinute:6},time=Date.parse('2026-10-21T15:59:00Z');ledger.reserve('before-midnight',config,time);ledger.complete('before-midnight','ok');
 const snapshot=path.join(dir,'snapshot.sqlite');await ledger.snapshot(snapshot);ledger.close();
 const copy=new DatabaseSync(snapshot,{readOnly:true});assert.equal(copy.prepare('SELECT count(*) AS n FROM attempts').get().n,1);copy.close();
 ledger=new Ledger(dir);assert.throws(()=>ledger.reserve('same-day',config,time+1000),/额度/);ledger.reserve('next-day',config,time+120000);ledger.close();
});
test('static serving prevents symlink escape and startup rejects incomplete/unsafe AI config',async t=>{
 const app=await fixture(t),secret=path.join(app.config.dataDir,'outside.js');await writeFile(secret,'private');const link=path.join(app.config.staticDir,'test-private-link.js');await symlink(secret,link);t.after(()=>rm(link,{force:true}));
 assert.equal((await fetch(app.base+'/test-private-link.js')).status,404);
 assert.throws(()=>readConfig({AI_ENABLED:'true'}),/启用AI/);
 assert.throws(()=>readConfig({AI_ENABLED:'true',DEEPSEEK_API_KEY:'key',AI_ACCESS_TOKEN:token,PUBLIC_ORIGIN:'http://public.example'}),/HTTPS/);
 assert.throws(()=>validateInput({...request(),requestId:'bad id'}),/标识/);
});
