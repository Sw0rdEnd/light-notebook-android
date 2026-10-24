const base=process.argv[2]||'http://127.0.0.1:8080';
for(const route of ['/api/health','/api/ai/status','/','/ai-http.js','/motion.css','/admin/','/account/','/console/app.js']){
 const response=await fetch(new URL(route,base),{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`${route} 检查失败：${response.status}`);
 if(route==='/api/health'&&(await response.json()).status!=='ok')throw new Error('健康检查失败');
 console.log(`PASS ${route}`);
}
