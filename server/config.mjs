import path from 'node:path';
export const MAX_BODY=6*1024*1024, MAX_IMAGE=2*1024*1024;
export class HttpError extends Error {
 constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
export function readConfig(env=process.env){
 const number=(key,fallback,min,max)=>{const n=Number(env[key]||fallback);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${key} 配置范围为 ${min}–${max}`);return n;};
 if(env.AI_ENABLED&&!['true','false'].includes(env.AI_ENABLED))throw new Error('AI_ENABLED 只能是 true 或 false');
 const enabled=env.AI_ENABLED==='true',key=env.DEEPSEEK_API_KEY||'',accessToken=env.AI_ACCESS_TOKEN||'',adminEnabled=env.ADMIN_ENABLED==='true',allowSharedToken=env.AI_ALLOW_SHARED_TOKEN!=='false';
 for(const name of ['ADMIN_ENABLED','AI_ALLOW_SHARED_TOKEN','TRUST_PROXY'])if(env[name]&&!['true','false'].includes(env[name]))throw new Error(`${name} 只能是 true 或 false`);
 const origin=env.PUBLIC_ORIGIN||'http://localhost:8080';let parsed;
 try{parsed=new URL(origin);}catch{throw new Error('PUBLIC_ORIGIN 必须是完整网址');}
 if(parsed.origin!==origin||parsed.username||parsed.password||!['http:','https:'].includes(parsed.protocol))throw new Error('PUBLIC_ORIGIN 只填写来源，例如 https://photos.example.com，不带末尾斜杠');
 if(/[\r\n]/.test(key)||/[\r\n]/.test(accessToken)||enabled&&(!key||allowSharedToken&&accessToken.length<32))throw new Error('启用AI需要DEEPSEEK_API_KEY；启用共享口令时还需至少32字符的AI_ACCESS_TOKEN');
 if((enabled||adminEnabled||key)&&parsed.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))throw new Error('公网账户与AI服务需要HTTPS；本地调试可使用localhost');
 const model=env.DEEPSEEK_MODEL||'deepseek-flash';if(!/^[a-zA-Z0-9._-]{1,100}$/.test(model))throw new Error('DEEPSEEK_MODEL 格式无效');
 return {enabled,key,accessToken,origin,model,adminEnabled,allowSharedToken,trustProxy:env.TRUST_PROXY==='true',host:env.HOST||'127.0.0.1',port:number('PORT',8080,1,65535),dataDir:path.resolve(env.DATA_DIR||'data'),staticDir:path.resolve(env.STATIC_DIR||'dist'),dailyLimit:number('AI_DAILY_LIMIT',50,1,10000),perMinute:number('AI_PER_MINUTE',6,1,60),concurrency:number('AI_CONCURRENCY',2,1,4),timeoutMs:number('AI_TIMEOUT_MS',45000,1000,65000),maxTokens:number('AI_MAX_TOKENS',1800,128,4096)};
}
