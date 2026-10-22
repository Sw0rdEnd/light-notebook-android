import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import sharp from 'sharp';
import {createAiUI} from '../app/src/main/assets/www/ai-ui.js';
test('AI screen requires explicit upload consent, sends selected copies, escapes output and saves/reopens local review',async()=>{
 const page=new Window({url:'http://localhost:8080'});
 for(const key of ['window','document','FileReader','Blob'])Object.defineProperty(globalThis,key,{value:key==='window'?page:page[key],configurable:true});
 const jpeg=await sharp({create:{width:64,height:48,channels:3,background:'#47686a'}}).jpeg().toBuffer();
 globalThis.createImageBitmap=async blob=>({width:64,height:48,buffer:Buffer.from(await blob.arrayBuffer()),close(){}});
 page.HTMLCanvasElement.prototype.getContext=function(){return {drawImage:image=>this.image=image};};
 page.HTMLCanvasElement.prototype.toBlob=function(callback){sharp(this.image.buffer).resize(this.width,this.height).jpeg().toBuffer().then(bytes=>callback(new Blob([bytes],{type:'image/jpeg'})));};
 const state={photos:['a','b'].map(id=>({id,name:id+'.jpg',preview:new Blob([jpeg],{type:'image/jpeg'}),exif:{focal:35},reasons:[]})),sessions:[]};
 const records=new Map(state.photos.map(p=>[p.id,p]));let enabled=false,uploads=0,returned=false;
 const originalFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{
  if(url==='/api/ai/status')return Response.json({enabled,message:'AI未配置，照片没有发送。'});
  uploads++;const body=JSON.parse(options.body);assert.equal(body.photos.length,2);assert.ok(body.photos.every(p=>p.image.startsWith('data:image/jpeg;base64,')));
  return Response.json({schema:'light-journal.ai-result.v1',requestId:body.requestId,status:'ok',summary:'<img src=x onerror=alert(1)>',observations:[{aspect:'构图',basis:'observation',text:'A中的主体更集中'}],nextSteps:['改变机位再拍一组'],preferred:'A'});
 };
 const ui=createAiUI({state,store:{get:async(_s,id)=>records.get(id),merge:async({photos})=>photos.forEach(p=>records.set(p.id,p))},esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),btn:(label,action)=>`<button data-action="${action}">${label}</button>`,dialogFrame:(title,body,foot)=>document.body.innerHTML=`<h2>${title}</h2>${body}${foot}`,showPhoto(){returned=true;},showCompare(){returned=true;},reload:async()=>{state.photos=[...records.values()];},render(){},toast(){}});
 const el=(action,ids='a,b')=>({dataset:{action,ids},closest:()=>null});
 try{
  await ui.action(el('ai-review'));assert.match(document.body.textContent,/照片没有发送/);assert.equal(uploads,0);
  enabled=true;await ui.action(el('ai-review'));document.querySelector('#ai-access-code').value='access-code';
  await ui.action(el('ai-submit'));assert.equal(uploads,0);assert.equal(document.querySelector('#ai-consent').checked,false);
  document.querySelector('#ai-consent').checked=true;await ui.action(el('ai-submit'));assert.equal(uploads,1,document.body.textContent);
  assert.equal(document.querySelectorAll('img').length,0);assert.match(document.body.textContent,/<img src=x/);assert.equal(records.get('a').aiReview.result.preferred,'A');
  assert.ok(ui.entry(['a','b']).includes('查看上次分析'));await ui.action(el('ai-last'));assert.equal(uploads,1,document.body.textContent);await ui.action(el('ai-back'));assert.equal(returned,true);
  state.photos[0].aiReview={photoIds:{join:'broken'}};assert.doesNotThrow(()=>ui.entry(['a','b']));
 }finally{ui.cancel();globalThis.fetch=originalFetch;delete globalThis.createImageBitmap;await page.happyDOM.abort();}
});
