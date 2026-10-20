import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
test('dependency-free dev server serves the real app and device preview without exposing signing material',async()=>{
 const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/dev-server.mjs',import.meta.url)),'--port','0'],{stdio:['ignore','pipe','pipe']});
 try{
 const root=await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Preview server startup timeout')),5000);child.once('error',reject);child.stdout.on('data',data=>{output+=data;const match=output.match(/ready: (http:\/\/127\.0\.0\.1:\d+)\/preview/);if(match){clearTimeout(timeout);resolve(match[1]);}});child.once('exit',code=>reject(new Error('Preview exited '+code)));});
 for(const route of ['/','/preview/','/preview/preview.js','/styles.css','/db.js','/browser-store.js','/ai.js','/assets/lake.jpg','/__dev/version']){const response=await fetch(root+route);assert.equal(response.status,200,route);assert.equal(response.headers.get('cache-control'),'no-store');if(route==='/')assert.match(await response.text(),/__dev\/client.js/);}
 for(const route of ['/signing/password.txt','/README.md','/.git/config'])assert.equal((await fetch(root+route)).status,404,route);
 }finally{child.kill();await once(child,'exit');}
});
