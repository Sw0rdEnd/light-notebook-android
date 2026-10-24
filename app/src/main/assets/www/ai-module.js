import {cleanReviewRecord,REVIEW_STATUSES} from './ai-history.js';
import {reviewResultHTML} from './ai-result.js';

const localDay=value=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const time=value=>new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export function createAiModule(ctx){
 const {state,aiUI,esc,btn,url,dialogFrame,closeDialog,render,reload,toast,showPhoto}=ctx;
 const ui={composing:false,ids:[],note:'',query:'',status:'all',mode:'all',from:'',to:'',photoIds:[],limit:30,pickerQuery:'',pickerLimit:40,picking:[]};
 const records=()=>{const rows=[];let invalid=0;for(const row of state.aiReviews||[])try{rows.push(cleanReviewRecord(row));}catch{invalid++;}return {rows:rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)),invalid};};
 const capture=()=>{ui.note=document.querySelector('.ai-module .ai-question')?.value??aiUI.getDraft(ui.ids)??ui.note;};
 function image(photo,kind='thumb'){const src=photo&&url(photo,kind);return src?`<img src="${src}" alt="${esc(photo.name||'评审照片')}" loading="lazy">`:'<span class="ai-missing-photo">无副本</span>';}
 function card(record){
  const waiting=aiUI.unsavedId()===record.id;
  return `<button class="ai-history-card" data-action="ai-history-open" data-id="${record.id}"><span class="ai-history-thumbs">${record.photos.map(p=>image(state.photos.find(live=>live.id===p.id))).join('')}</span><span class="ai-history-copy"><span class="ai-history-meta"><span>${record.timeSource==='migration'?'旧记录 · 时间未记':esc(time(record.createdAt))}</span><span class="badge ai-status-${record.status}">${waiting?'结果待保存':REVIEW_STATUSES[record.status]}</span></span><strong>${esc(record.note||'全面点评')}</strong><span class="small muted">${record.mode==='compare'?'双图比较':'单张点评'} · ${esc(record.photos.map(p=>p.name).join(' / '))}</span><span class="small ai-history-summary">${esc(record.result?.summary||record.error?.message||'未确认分析完成，可查看记录状态。')}</span></span></button>`;
 }
 function filtered(rows){
  const query=ui.query.trim().toLowerCase();return rows.filter(r=>
   (ui.status==='all'||r.status===ui.status)&&(ui.mode==='all'||r.mode===ui.mode)&&
   (!ui.from||r.timeSource!=='migration'&&localDay(r.createdAt)>=ui.from)&&(!ui.to||r.timeSource!=='migration'&&localDay(r.createdAt)<=ui.to)&&
   (!ui.photoIds.length||ui.photoIds.every(id=>r.photos.some(p=>p.id===id)))&&
   (!query||[r.note,r.createdAt,...r.photos.map(p=>p.name),r.result?.summary,r.error?.message,...(r.result?.observations||[]).map(o=>o.text),...(r.result?.nextSteps||[])].join(' ').toLowerCase().includes(query)));
 }
 function page(){
  const {rows,invalid}=records(),list=filtered(rows),selected=ui.ids.map(id=>state.photos.find(p=>p.id===id)).filter(Boolean);
  return `<section class="ai-module"><header class="ai-module-heading"><div><h1>AI 点评</h1><p>每一次观察，单独留下记录。</p></div><div class="row">${btn('新建点评','ai-new','primary')}${aiUI.native?btn('AI 设置','ai-settings','ghost'):''}</div></header>${aiUI.unsavedId()?`<div class="note ai-unsaved"><p>有一份分析结果尚未保存，可以重试本地保存，无需重新分析。</p>${btn('保存当前结果','ai-save-result','primary')}</div>`:''}${ui.composing?`<section class="ai-composer"><div class="between"><h2>新建点评</h2>${btn('收起','ai-compose-close','ghost')}</div><p class="small muted">选择一张照片点评，或选择两张作 A / B 比较。</p><div class="ai-selected-photos">${selected.map((p,i)=>`<article>${image(p)}<div><strong>${i===0?'A':'B'} · ${esc(p.name)}</strong><button class="btn ghost" data-action="ai-selected-remove" data-id="${p.id}">移除</button></div></article>`).join('')}</div>${btn(selected.length?'更换 / 选择照片':'选择照片','ai-pick-photos','full')}${selected.length?aiUI.entry(ui.ids):'<p class="ai-compose-empty">先选择照片，再填写想问的问题。不会自动上传。</p>'}</section>`:''}<section class="ai-history"><div class="between"><h2>评审记录</h2><span class="small muted">${list.length} / ${rows.length} 次</span></div><label class="sr-only" for="ai-history-search">搜索评审记录</label><input class="field" id="ai-history-search" type="search" aria-label="搜索评审记录" placeholder="搜索照片名、问题或点评内容" value="${esc(ui.query)}"><details class="ai-history-filters" ${ui.status!=='all'||ui.mode!=='all'||ui.from||ui.to?'open':''}><summary>筛选记录</summary><div class="ai-filter-grid"><label>评审状态<select id="ai-history-status" class="field">${[['all','全部状态'],...Object.entries(REVIEW_STATUSES)].map(([v,label])=>`<option value="${v}" ${ui.status===v?'selected':''}>${label}</option>`).join('')}</select></label><label>评审类型<select id="ai-history-mode" class="field">${[['all','单图与双图'],['single','单张点评'],['compare','双图比较']].map(([v,label])=>`<option value="${v}" ${ui.mode===v?'selected':''}>${label}</option>`).join('')}</select></label><label>开始日期<input type="date" class="field" id="ai-history-from" value="${esc(ui.from)}"></label><label>结束日期<input type="date" class="field" id="ai-history-to" value="${esc(ui.to)}"></label></div></details>${ui.query||ui.status!=='all'||ui.mode!=='all'||ui.from||ui.to||ui.photoIds.length?`<div class="ai-active-filter"><span class="small muted">${ui.photoIds.length?'当前照片相关记录':'已应用搜索或筛选'}</span>${btn('清除筛选','ai-history-reset','ghost')}</div>`:''}${ui.from&&ui.to&&ui.from>ui.to?'<p class="error-banner">开始日期不能晚于结束日期。</p>':''}${invalid?`<p class="note">有${invalid}条记录格式异常，原数据保留，请先备份后联系排查。</p>`:''}<div class="ai-history-list">${list.slice(0,ui.limit).map(card).join('')}</div>${list.length>ui.limit?btn('加载更多记录','ai-history-more','full'):''}${!list.length?`<div class="ai-history-empty"><h3>${rows.length?'没有符合条件的记录':'从一次点评开始'}</h3><p>${rows.length?'试试其他关键词，或清除筛选。':'选择照片、提出问题，每次点评都会单独留存。'}</p>${btn(rows.length?'清除筛选':'新建点评',rows.length?'ai-history-reset':'ai-new','primary')}</div>`:''}<p class="small muted ai-history-footnote">记录保存在本机，并包含在应用备份中。删除原照片后，点评文字与当时的参数仍可查询。</p></section></section>`;
 }
 async function open(ids=[],{note='',historyOnly=false}={}){
  await aiUI.stop();closeDialog();await reload();state.tab='reviews';state.viewer=null;ui.ids=ids.filter(id=>state.photos.some(p=>p.id===id)).slice(0,2);ui.note=note;ui.composing=!historyOnly;ui.photoIds=historyOnly?[...ids]:[];ui.query='';ui.status=ui.mode='all';ui.from=ui.to='';ui.limit=30;aiUI.setDraft(ui.ids,note);render();globalThis.scrollTo?.(0,0);
 }
 function picker(){
  const q=ui.pickerQuery.toLowerCase(),photos=state.photos.filter(p=>!q||[p.name,...(p.tags||[])].join(' ').toLowerCase().includes(q));
  dialogFrame('选择点评照片',`<p class="small muted">按选择顺序标记 A / B，最多2张。已选 ${ui.picking.length} 张。</p><input id="ai-picker-search" type="search" class="field" aria-label="搜索可点评照片" placeholder="搜索照片名称或标签" value="${esc(ui.pickerQuery)}"><div class="ai-picker-grid">${photos.slice(0,ui.pickerLimit).map(p=>{const index=ui.picking.indexOf(p.id),available=!!p.preview;return `<button class="ai-picker-photo ${index>=0?'selected':''}" data-action="ai-picker-toggle" data-id="${p.id}" aria-pressed="${index>=0}" ${available?'':'disabled'}>${image(p)}<span>${index>=0?`<b>${index===0?'A':'B'}</b>`:''}${esc(p.name)}${available?'':' · 缺少副本'}</span></button>`;}).join('')}</div>${photos.length>ui.pickerLimit?btn('加载更多照片','ai-picker-more','full'):''}${photos.length?'':'<p class="note">没有找到照片，可先在照片页导入。</p>'}`,btn('取消','close','ghost')+btn('使用所选照片','ai-picker-done','primary',ui.picking.length?'':'disabled'),'ai-picker-modal');
 }
 function showRecord(id){
  const raw=(state.aiReviews||[]).find(r=>r.id===id);if(!raw)return toast('该评审记录已不存在，请刷新后重试。');let r;try{r=cleanReviewRecord(raw);}catch{return toast('这条评审记录格式异常，原数据仍保留。');}
  const photos=r.photos.map(p=>{const live=state.photos.find(v=>v.id===p.id);return `<article class="ai-detail-photo">${image(live,'preview')}<div><strong>${p.label} · ${esc(p.name)}</strong><p class="small muted">${live?'当前照片仍在作品库':'原照片已移除，点评文字保留'}</p>${live?btn('查看照片','ai-history-photo','ghost',`data-id="${p.id}"`):''}</div><details><summary>当时的拍摄参数</summary><pre>${esc(JSON.stringify({EXIF:p.exif,用户修正:p.corrections},null,2))}</pre></details></article>`;}).join('');
  dialogFrame('评审详情',`<div class="ai-detail-meta"><span class="badge">${REVIEW_STATUSES[r.status]}</span><span>${r.mode==='compare'?'双图比较':'单张点评'}</span><span>${r.timeSource==='migration'?'评审时间未记录':esc(time(r.createdAt))}</span></div><p class="small muted">${r.origin==='legacy'?'从旧版留存结果迁入；旧版曾覆盖的更早结果无法恢复。':`DeepSeek · ${esc(r.model||'服务未提供模型名称')}`}</p><div class="ai-detail-photos">${photos}</div><section class="ai-detail-question"><h3>当时的问题</h3><p>${esc(r.note||'未填写，做全面点评。')}</p><details><summary>${r.origin==='legacy'?'按旧问题补充的点评要求':'当时整理的点评要求'}</summary><p>${esc(r.brief.goal)}</p><p>重点：${r.brief.focus.map(esc).join('、')}</p><ol>${r.brief.steps.map(v=>`<li>${esc(v)}</li>`).join('')}</ol></details></section>${r.result?reviewResultHTML(r.result,esc):`<p class="note" role="status">${esc(r.error?.message||'这次分析尚未确认完成。已发送的请求仍可能计费。')}</p>${r.error?`<p class="small muted">错误码：${esc(r.error.code)}</p>`:''}`}<p class="small muted ai-history-footnote">图片来自当前作品库；问题、参数与结果保留当时版本。查看历史不会再次调用AI。</p>`,btn('返回记录','ai-history','ghost')+btn('按此问题新建','ai-history-repeat','primary',`data-id="${r.id}"`),'ai-history-detail');
 }
 async function action(el){
  switch(el.dataset.action){
   case 'ai-open-module':await open((el.dataset.ids||'').split(',').filter(Boolean));return true;
   case 'ai-open-history':await open((el.dataset.ids||'').split(',').filter(Boolean),{historyOnly:true});return true;
   case 'ai-new':capture();ui.composing=true;ui.ids=[];ui.note='';render();return true;
   case 'ai-compose-close':capture();ui.composing=false;render();return true;
   case 'ai-history':await aiUI.stop();closeDialog();await reload();state.tab='reviews';ui.composing=false;render();return true;
   case 'ai-history-open':showRecord(el.dataset.id);return true;
   case 'ai-history-photo':showPhoto(el.dataset.id);return true;
   case 'ai-history-repeat':{const r=records().rows.find(r=>r.id===el.dataset.id);if(r){const ids=r.photos.map(p=>p.id);await open(ids.every(id=>state.photos.some(p=>p.id===id))?ids:[],{note:r.note});}return true;}
   case 'ai-history-more':ui.limit+=30;render();return true;
   case 'ai-history-reset':ui.query='';ui.status=ui.mode='all';ui.from=ui.to='';ui.photoIds=[];ui.limit=30;render();return true;
   case 'ai-pick-photos':capture();ui.picking=[...ui.ids];ui.pickerQuery='';ui.pickerLimit=40;picker();return true;
   case 'ai-picker-toggle':{const id=el.dataset.id;if(ui.picking.includes(id))ui.picking=ui.picking.filter(v=>v!==id);else if(ui.picking.length<2)ui.picking.push(id);else {toast('最多选择2张，请先取消一张。');return true;}picker();return true;}
   case 'ai-picker-more':ui.pickerLimit+=40;picker();return true;
   case 'ai-picker-done':if(ui.picking.length){ui.ids=[...ui.picking];aiUI.setDraft(ui.ids,ui.note);closeDialog();render();}return true;
   case 'ai-selected-remove':capture();ui.ids=ui.ids.filter(id=>id!==el.dataset.id);aiUI.setDraft(ui.ids,ui.note);render();return true;
  }return false;
 }
 function input(el){
  if(el.id==='ai-picker-search'){const pos=el.selectionStart;ui.pickerQuery=el.value;ui.pickerLimit=40;picker();const field=document.querySelector('#ai-picker-search');field.focus();field.setSelectionRange?.(pos,pos);return true;}
  const fields={'ai-history-search':'query','ai-history-status':'status','ai-history-mode':'mode','ai-history-from':'from','ai-history-to':'to'};
  if(!fields[el.id])return false;const pos=el.selectionStart;ui[fields[el.id]]=el.value;ui.limit=30;render();const next=document.getElementById(el.id);next?.focus({preventScroll:true});if(pos!=null)next?.setSelectionRange?.(pos,pos);return true;
 }
 function reset(){Object.assign(ui,{composing:false,ids:[],note:'',query:'',status:'all',mode:'all',from:'',to:'',photoIds:[],limit:30,pickerQuery:'',pickerLimit:40,picking:[]});}
 return {page,open,action,input,reset,ui};
}
