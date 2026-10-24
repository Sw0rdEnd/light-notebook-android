// Local-only browser test server: disposable accounts, synthetic provider, no paid calls.
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {readConfig} from '../../server/config.mjs';import {createApp} from '../../server/app.mjs';
const directory=await mkdtemp(path.join(tmpdir(),'light-admin-browser-'));
const config=readConfig({ADMIN_ENABLED:'true',AI_ENABLED:'true',AI_ALLOW_SHARED_TOKEN:'false',DEEPSEEK_API_KEY:'browser-test-key',DATA_DIR:directory,HOST:'127.0.0.1',PORT:'5191',PUBLIC_ORIGIN:'http://127.0.0.1:5191'});
const app=createApp(config,{fetchImpl:async()=>Response.json({usage:{prompt_tokens:600,completion_tokens:150,prompt_cache_hit_tokens:20},choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'浏览器测试：画面主体集中',observations:[{aspect:'构图',basis:'observation',text:'主体周围有留白'}],nextSteps:['保持位置，改变焦段再拍一张'],preferred:null})}}]})});
await app.accounts.create({username:'owner',displayName:'测试管理员',password:'browser-test-password',role:'admin'},null,{bootstrap:true});
app.server.listen(config.port,config.host,()=>console.log('Admin browser test server ready'));
let stopped=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{if(stopped)return;stopped=true;await app.close();await rm(directory,{recursive:true,force:true});process.exit(0);});
