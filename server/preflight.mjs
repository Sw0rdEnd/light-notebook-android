import {access} from 'node:fs/promises';
import path from 'node:path';
import {readConfig} from './config.mjs';
const config=readConfig();
if(new URL(config.origin).hostname==='photos.example.com')throw new Error('请先把.env中的示例域名换成自己的域名，或按文档使用localhost隧道测试。');
for(const file of ['index.html','motion.js','ai-ui.js','ai-http.js','admin/index.html','account/index.html','console/app.js'])await access(path.join(config.staticDir,file));
console.log(JSON.stringify({configuration:'ok',aiEnabled:config.enabled}));
