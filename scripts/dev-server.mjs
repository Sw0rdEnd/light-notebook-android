import http from 'node:http';
import {readFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const www=path.join(project,'app/src/main/assets/www'),dev=path.join(project,'dev');
const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i>=0?args[i+1]:fallback;};
const port=Number(option('--port',process.env.PORT||'5173')),host=option('--host','127.0.0.1');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
async function version(dir){let latest=0;for(const entry of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);latest=Math.max(latest,entry.isDirectory()?await version(f):(await stat(f)).mtimeMs);}return latest;}
const client=`let version=null;setInterval(async()=>{try{const value=await (await fetch('/__dev/version',{cache:'no-store'})).text();if(version!==null&&version!==value)location.reload();version=value;}catch{}},1000);`;
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 if(url.pathname==='/__dev/version'){res.end(String(Math.max(await version(www),await version(dev))));return;}
 if(url.pathname==='/__dev/client.js'){res.setHeader('Content-Type',mime['.js']);res.end(client);return;}
 const preview=url.pathname==='/preview'||url.pathname.startsWith('/preview/');
 const root=preview?dev:www;let relative=decodeURIComponent(preview?url.pathname.replace(/^\/preview\/?/,''):url.pathname.slice(1));if(!relative)relative='index.html';
 const filename=path.resolve(root,relative);if(!filename.startsWith(root+path.sep)||relative.includes('\0')){res.writeHead(403);res.end();return;}
 let body=await readFile(filename);const ext=path.extname(filename);res.setHeader('Content-Type',mime[ext]||'application/octet-stream');
 if(ext==='.html')body=Buffer.from(body.toString('utf8').replace('</body>','<script type="module" src="/__dev/client.js"></script></body>'));
 res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(error.code==='ENOENT'?'Not found':'Preview server error');}});
server.on('error',error=>{process.stderr.write(error.code==='EADDRINUSE'?`端口 ${port} 已占用。可运行 npm run dev -- --port 5174\n`:`预览启动失败：${error.message}\n`);process.exitCode=1;});
server.listen(port,host,()=>{const activePort=server.address().port;console.log(`Light Journal preview ready: http://${host}:${activePort}/preview/`);console.log(`App: http://${host}:${activePort}/`);console.log('编辑 app/src/main/assets/www 后会自动刷新；按 Ctrl+C 停止。');});
