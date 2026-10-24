import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server/app.mjs';
import {readConfig} from '../server/config.mjs';
const password='test-only-password-2026',ownerInput={username:'owner',displayName:'小黄',password,role:'admin'},userInput={username:'friend',displayName:'朋友',password,dailyLimit:1,storageQuotaMb:1};
const modelBody={usage:{prompt_tokens:100,completion_tokens:25,prompt_cache_hit_tokens:20},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'主体更集中',observations:[{aspect:'构图',basis:'observation',text:'留白更多'}],nextSteps:['换个机位'],preferred:null})}}]};
const ai=()=>({schema:'light-journal.ai-upload.v1',requestId:crypto.randomUUID(),photos:[{label:'A',image:'data:image/jpeg;base64,/9j/2Q=='}]});
const backup=()=>({app:'light-notebook',version:2,dataVersion:2,exportedAt:new Date().toISOString(),includesPhotos:false,originals:false,sessions:[],photos:[],settings:[],groups:[],memberships:[],imports:[],equipment:[],kits:[],catalog:[]});
async function fixture(t,extra={}){
 const directory=await mkdtemp(path.join(tmpdir(),'light-admin-'));let time=Date.now(),calls=0;
 const config={...readConfig({ADMIN_ENABLED:'true',AI_ENABLED:'true',AI_ALLOW_SHARED_TOKEN:'false',DEEPSEEK_API_KEY:'test-server-only-key',DATA_DIR:directory,PUBLIC_ORIGIN:'http://localhost:8080'}),...extra};
 const app=createApp(config,{now:()=>time,fetchImpl:async()=>{calls++;return Response.json(modelBody);}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
 const call=(method,route,body,login,headers={})=>fetch(base+route,{method,headers:{Origin:config.origin,...(body?{'Content-Type':'application/json'}:{}),...(login?{Cookie:login.cookie,'X-CSRF-Token':login.csrfToken}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 const login=async(username='owner')=>{const response=await call('POST','/api/auth/login',{username,password});assert.equal(response.status,200);return {...await response.json(),cookie:response.headers.get('set-cookie').split(';')[0],cookieHeader:response.headers.get('set-cookie')};};
 await app.accounts.create(ownerInput,null,{bootstrap:true});
 t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 return {...app,base,config,directory,call,login,get calls(){return calls;},setTime:value=>time=value};
}
test('admin bootstrap, cookie security, CSRF, expiry and standard-user authorization are enforced',async t=>{
 const app=await fixture(t,{origin:'https://photos.example.test'}),owner=await app.login();assert.match(owner.cookieHeader,/HttpOnly/);assert.match(owner.cookieHeader,/SameSite=Strict/);assert.match(owner.cookieHeader,/Secure/);
 assert.equal((await app.call('GET','/api/admin/overview')).status,401);
 assert.equal((await app.call('POST','/api/admin/users',userInput,owner,{'X-CSRF-Token':'wrong'})).status,403);
 assert.equal((await app.call('POST','/api/auth/login',{username:'owner',password},null,{Origin:'https://other.example'})).status,403);
 assert.equal((await app.call('POST','/api/admin/users',userInput,owner)).status,201);const friend=await app.login('friend');assert.equal((await app.call('GET','/api/admin/overview',null,friend)).status,403);
 assert.equal((await app.call('GET','/api/me/usage',null,friend)).status,200);
 await assert.rejects(()=>app.accounts.create({...ownerInput,username:'second'},null,{bootstrap:true}),/已有管理员/);
 const dbText=JSON.stringify(app.ledger.db.prepare('SELECT * FROM accounts').all());assert.ok(!dbText.includes(password));assert.ok(!JSON.stringify(app.ledger.db.prepare('SELECT * FROM auth_sessions').all()).includes(owner.cookie.slice(11)));
 const audit=await (await app.call('GET','/api/admin/audit',null,owner)).text();assert.ok(!audit.includes(password));assert.ok(!audit.includes('test-server-only-key'));
 app.setTime(Date.now()+9*3600000);assert.equal((await app.call('GET','/api/admin/overview',null,owner)).status,401);
});
test('last admin is protected; disabling users and resetting passwords revoke existing sessions',async t=>{
 const app=await fixture(t),owner=await app.login();const created=await (await app.call('POST','/api/admin/users',userInput,owner)).json(),friend=await app.login('friend');
 assert.equal((await app.call('PATCH','/api/admin/users/'+owner.user.id,{status:'disabled'},owner)).status,409);
 assert.equal((await app.call('PATCH','/api/admin/users/'+created.user.id,{status:'disabled'},owner)).status,200);assert.equal((await app.call('GET','/api/me/usage',null,friend)).status,401);
 await app.call('PATCH','/api/admin/users/'+created.user.id,{status:'active'},owner);const newLogin=await app.login('friend');
 assert.equal((await app.call('PATCH','/api/admin/users/'+created.user.id,{password:'new-password-for-friend'},owner)).status,200);assert.equal((await app.call('GET','/api/me/usage',null,newLogin)).status,401);
 assert.equal((await app.call('POST','/api/auth/logout',null,owner)).status,200);assert.equal((await app.call('GET','/api/admin/overview',null,owner)).status,401);
});
test('per-user AI quotas and real usage recording distinguish personal, global and missing provider usage',async t=>{
 const app=await fixture(t),owner=await app.login();await app.call('POST','/api/admin/users',userInput,owner);const friend=await app.login('friend');
 assert.equal((await app.call('POST','/api/ai/evaluate',ai(),friend,{'X-CSRF-Token':'wrong'})).status,403);
 assert.equal((await app.call('POST','/api/ai/evaluate',ai(),friend)).status,200);
 assert.equal((await app.call('POST','/api/ai/evaluate',ai(),friend)).status,429);assert.equal(app.calls,1);
 assert.equal((await app.call('POST','/api/ai/evaluate',ai(),owner)).status,200);
 const own=await (await app.call('GET','/api/me/usage',null,friend)).json(),all=await (await app.call('GET','/api/admin/usage',null,owner)).json();assert.equal(own.totals.attempts,1);assert.equal(all.totals.attempts,2);assert.equal(own.totals.inputTokens,100);assert.equal(own.totals.outputTokens,25);assert.equal(own.totals.cachedTokens,20);assert.equal(own.totals.unknownUsage,0);
 const pending=crypto.randomUUID();app.ledger.reserve(pending,{dailyLimit:100,perMinute:60,model:'deepseek-flash'});app.ledger.complete(pending,'provider_error',10);
 assert.equal((await (await app.call('GET','/api/admin/usage',null,owner)).json()).totals.unknownUsage,1);
 const status=await (await app.call('GET','/api/ai/status',null,friend)).json();assert.equal(status.signedIn,true);assert.equal(status.accountRequired,true);assert.equal(status.csrfToken,friend.csrfToken);
 const paused=await app.call('PATCH','/api/admin/settings',{aiEnabled:false},owner);assert.equal(paused.status,200);assert.equal((await app.call('POST','/api/ai/evaluate',ai(),owner)).status,503);
});
test('settings validate boundaries, reject secret fields, persist, and email login stays explicitly unavailable',async t=>{
 const app=await fixture(t),owner=await app.login();
 assert.equal((await app.call('PATCH','/api/admin/settings',{concurrency:9},owner)).status,400);assert.equal((await app.call('PATCH','/api/admin/settings',{apiKey:'never-store-this'},owner)).status,400);
 assert.equal((await app.call('PATCH','/api/admin/settings',{sharedTokenEnabled:true},owner)).status,409);
 assert.equal((await app.call('PATCH','/api/admin/settings',{dailyLimit:30,storageLimitMb:500,retentionDays:10},owner)).status,200);
 const saved=JSON.parse(app.ledger.db.prepare('SELECT value FROM runtime_settings').get().value);assert.equal(saved.dailyLimit,30);assert.equal(saved.storageLimitMb,500);
 assert.equal((await app.call('POST','/api/auth/email/request',{email:'example@example.test'})).status,503);
 const overview=await (await app.call('GET','/api/admin/overview',null,owner)).json();assert.equal(overview.service.emailLoginEnabled,false);assert.ok(!JSON.stringify(overview).includes('test-server-only-key'));
 const noKey=await fixture(t,{key:'',enabled:false});const login=await noKey.login();assert.equal((await noKey.call('PATCH','/api/admin/settings',{aiEnabled:true},login)).status,409);
});
test('cloud backups validate content, isolate owners, survive quota rejection and support admin removal',async t=>{
 const app=await fixture(t),owner=await app.login();await app.call('POST','/api/admin/users',userInput,owner);const friend=await app.login('friend');
 assert.equal((await app.call('POST','/api/me/files',{private:'not a backup'},friend)).status,400);
 const uploaded=await app.call('POST','/api/me/files',backup(),friend,{'X-Backup-Name':encodeURIComponent('我的复盘.json')});assert.equal(uploaded.status,201);const file=await uploaded.json();
 assert.equal((await app.call('GET','/api/me/files/'+file.id,null,owner)).status,404);
 assert.equal((await app.call('DELETE','/api/me/files/'+file.id,null,owner)).status,404);
 const downloaded=await app.call('GET','/api/me/files/'+file.id,null,friend);assert.equal(downloaded.status,200);assert.equal((await downloaded.json()).app,'light-notebook');assert.match(downloaded.headers.get('cache-control'),/no-store/);
 const own=await (await app.call('GET','/api/me/storage',null,friend)).json();assert.equal(own.files,1);assert.equal(own.bytes,file.size);
 assert.equal((await app.call('PATCH','/api/admin/users/'+friend.user.id,{storageQuotaMb:0},owner)).status,409);
 const large={...backup(),padding:'x'.repeat(1048576)};assert.equal((await app.call('POST','/api/me/files',large,friend)).status,409);assert.equal((await readdir(path.join(app.directory,'objects'))).length,1);
 assert.equal((await app.call('DELETE','/api/admin/files/'+file.id,null,owner)).status,200);assert.equal((await app.call('GET','/api/me/files/'+file.id,null,friend)).status,404);assert.equal((await readdir(path.join(app.directory,'objects'))).length,0);
 const insert=app.ledger.db.prepare('INSERT INTO cloud_files VALUES(?,?,?,?,?,?)');for(let n=0;n<200;n++)insert.run(crypto.randomUUID(),friend.user.id,'synthetic.json',0,'synthetic',Date.now());
 const capped=await app.call('POST','/api/me/files',backup(),friend);assert.equal(capped.status,409);assert.equal((await capped.json()).code,'BACKUP_COUNT_LIMIT');assert.equal((await readdir(path.join(app.directory,'objects'))).length,0);
});
test('concurrent cloud uploads cannot exceed personal or global capacity',async t=>{
 const app=await fixture(t),owner=await app.login();await app.call('POST','/api/admin/users',userInput,owner);const friend=await app.login('friend');
 const body={...backup(),padding:'x'.repeat(650000)},responses=await Promise.all([app.call('POST','/api/me/files',body,friend),app.call('POST','/api/me/files',body,friend)]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
 const stats=await (await app.call('GET','/api/me/storage',null,friend)).json();assert.equal(stats.files,1);assert.ok(stats.bytes<1048576);assert.equal((await readdir(path.join(app.directory,'objects'))).length,1);
});
test('login attempts are throttled and disabling the whole account service blocks protected endpoints',async t=>{
 const app=await fixture(t);for(let n=0;n<10;n++)assert.equal((await app.call('POST','/api/auth/login',{username:'owner',password:'wrong'})).status,401);
 assert.equal((await app.call('POST','/api/auth/login',{username:'owner',password})).status,429);
 const off=await fixture(t,{adminEnabled:false});assert.equal((await off.call('GET','/api/admin/overview')).status,503);const status=await (await off.call('GET','/api/auth/session')).json();assert.equal(status.enabled,false);assert.equal(status.user,null);
});
test('old usage database migrates without losing paid attempts; admin assets have CSP and stay outside service worker cache',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'light-old-ledger-'));t.after(()=>rm(dir,{recursive:true,force:true}));const db=new DatabaseSync(path.join(dir,'usage.sqlite'));db.exec("CREATE TABLE attempts(request_id TEXT PRIMARY KEY,day TEXT NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL)");db.prepare('INSERT INTO attempts VALUES(?,?,?,?)').run('old-paid-request','2026-10-22',Date.now(),'ok');db.close();
 const app=createApp(readConfig({DATA_DIR:dir}));await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());assert.equal(app.ledger.db.prepare('SELECT request_id FROM attempts').get().request_id,'old-paid-request');
 const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/admin/');assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(response.headers.get('cache-control'),'no-store');
 const worker=await readFile('dist/sw.js','utf8');assert.ok(!worker.includes("'./admin/"));assert.ok(!worker.includes("'./account/"));
});
