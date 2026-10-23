import {cp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const {version:androidVersion}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
await cp(path.join(root,'app/src/main/assets/www'),dist,{recursive:true});
await cp(path.join(root,'web/console'),dist,{recursive:true});
const update=async(file,change)=>writeFile(path.join(dist,file),change(await readFile(path.join(dist,file),'utf8')));
const replaceRequired=(source,from,to)=>{if(!source.includes(from))throw new Error(`服务器网页适配未找到源文案：${from}`);return source.replaceAll(from,to);};
await update('browser-store.js',s=>replaceRequired(s,"constructor(name='light-journal-browser-v1')","constructor(name='light-notebook-r0')"));
await update('app.js',s=>{
 const replacements=[
  ['电脑预览 · 浏览器 IndexedDB','当前浏览器 · 本地保存'],
  ['预览中的练习、照片和标记保存于当前浏览器的 IndexedDB','网页版中的练习、照片和标记保存在当前浏览器'],
  ['界面、任务库和示例照片已打包进 APK，可断网打开。照片不上传，无需登录；不申请联网、定位、相机或所有文件访问权限。仅在你主动导入或导出时使用系统文件选择器。','照片和练习默认保存在当前浏览器。AI分析需要联网：仅在你主动确认后，将所选照片的压缩副本、拍摄参数及问题发送给DeepSeek。'],
  ['服务尚未接入','按需联网 · 需管理员启用'],
  ['照片详情与双图对比中已预留评价入口。当前不生成评价、不发送照片；你可以继续使用全部本地复盘功能。','在照片详情或双图对比中主动发起AI摄影复盘。管理员启用服务后，填写AI访问口令并确认上传即可分析；未启用时仍可使用全部本地复盘功能。'],
  ['离线任务库覆盖 6 种场景 × 5 个主题，每次 3–5 项。全部操作由本地规则完成，AI 评价已预留入口与接口，目前尚未接入服务；没有照片上传、定位或厂商接口。','任务库覆盖 6 种场景 × 5 个主题，每次 3–5 项。任务和统计使用本地规则；可选AI摄影复盘由服务器转发至DeepSeek，结果保存到当前浏览器。'],
  [`${androidVersion} / 离线练习`,'0.4.0 / 摄影练习'],
  [`光影练习册 / Android ${androidVersion}`,'光影练习册 / 服务器预备版 0.4.0'],
  ['<h2>照片与存储</h2>','<h2>照片与存储</h2><p class="small"><a href="/account/">账户与云备份</a> · <a href="/admin/">管理中心</a></p>'],
  ['填写AI访问口令并确认上传即可分析','登录账户或填写管理员允许的共享口令，确认上传后即可分析']
 ];
 return replacements.reduce((source,[from,to])=>replaceRequired(source,from,to),s);
});
await update('sw.js',s=>s.replace(/const CACHE='[^']+'/,"const CACHE='light-notebook-server-0.4.0'"));
console.log('服务器网页已生成到 dist/；原网页数据库名称保留。');
