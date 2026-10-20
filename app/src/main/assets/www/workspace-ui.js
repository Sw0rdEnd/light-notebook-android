import {saveGroup,assignPhotos,deleteGroup,deletePhotos,groupStats} from './organize.js';

export function createWorkspaceUI(ctx) {
  const {state,store,esc,btn,url,cell,render,reload,toast,dialogFrame,closeDialog} = ctx;
  const ui = {view:'photos',group:'all',groupSearch:'',cull:'all',importGroup:null};
  const groups = () => (state.groups||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const options = (selected='') => groups().map(g=>`<option value="${g.id}" ${g.id===selected?'selected':''}>${esc(g.name)}</option>`).join('');
  let indexedLinks=null,groupsByPhoto=new Map();
  const photoGroups = pid => {if(indexedLinks!==state.memberships){indexedLinks=state.memberships;groupsByPhoto=new Map();for(const m of indexedLinks||[]){if(!groupsByPhoto.has(m.photoId))groupsByPhoto.set(m.photoId,[]);groupsByPhoto.get(m.photoId).push(m.groupId);}}return groupsByPhoto.get(pid)||[];};
  function filteredPhotos() {
    return state.photos.filter(p=>
      (ui.group==='all'||ui.group==='unassigned'?! (ui.group==='unassigned'&&photoGroups(p.id).length):photoGroups(p.id).includes(ui.group))&&
      (!state.recentOnly||(state.lastImport?.ids||[]).includes(p.id))&&
      (state.sessionFilter==='all'||p.sessionId===state.sessionFilter||state.sessionFilter==='unassigned'&&!p.sessionId)&&
      (!state.photoSearch||[p.name,p.day,...(p.tags||[])].some(v=>String(v||'').toLowerCase().includes(state.photoSearch.toLowerCase())))&&
      (ui.cull==='all'||ui.cull==='pending'&&!p.reviewedAt||p.cull===ui.cull)&&
      (state.filter==='all'||state.filter==='real'&&!p.demo||state.filter==='demo'&&p.demo||p[state.filter])&&
      (!ctx.deviceFilter||ctx.deviceFilter(p)));
  }
  function photosPage() {
    if(ui.view==='groups') return groupsPage();
    const photos=filteredPhotos(),group=groups().find(g=>g.id===ui.group);
    return `<section><div class="page-title between"><div><span class="eyebrow">CONTACT SHEETS</span><h1>${group?esc(group.name):'作品库'}</h1><p>${group?esc(group.description):'整理活动用分组，描述画面用标签。原图请自行保管。'}</p></div>${btn('管理分组','groups')}</div>
      <div class="photo-toolbar">${btn('导入照片','import','primary')}${btn(state.selecting?'退出多选':'批量整理 / 对比','toggle-select')}<select id="group-filter" class="field" aria-label="按分组筛选"><option value="all">全部分组</option><option value="unassigned" ${ui.group==='unassigned'?'selected':''}>未归组</option>${options(ui.group)}</select></div>
      <div class="row quick-filters">${btn('未归组','quick-ungrouped','chip')}${btn('待复盘','quick-review','chip')}${btn('最近导入','quick-recent','chip')}${btn('导入记录','import-history','chip')}</div>
      <details class="mark-filters"><summary>喜欢、代表作等标记筛选</summary><div class="row">${[['all','全部'],['real','真实记录'],['liked','喜欢'],['improve','待改进'],['star','代表作'],['demo','演示']].map(([v,n])=>btn(n,'photo-filter',`chip ${state.filter===v?'selected':''}`,`data-filter="${v}"`)).join('')}</div></details>
      <label class="photo-search">搜索照片 / 标签<input id="photo-search" type="search" class="field" value="${esc(state.photoSearch)}" placeholder="文件名、拍摄日期或标签"></label>
      <div class="photo-toolbar"><label>选片状态 <select id="cull-filter" class="field"><option value="all">全部状态</option>${[['keep','保留'],['undecided','待定'],['reject','淘汰'],['pending','待复盘']].map(([v,n])=>`<option value="${v}" ${ui.cull===v?'selected':''}>${n}</option>`).join('')}</select></label>${ctx.deviceFilters?.()||''}</div>
      ${state.lastImport?`<div class="import-receipt"><span>最近导入：成功 ${state.lastImport.ids.length} 张 / 重复 ${state.lastImport.duplicates?.length||0} 张 / 失败 ${state.lastImport.errors.length} 张</span>${btn('查看这批','recent-import')}${btn('导入详情','import-details')}</div>`:''}
      <p class="small muted">${btn('显示全部','reset-photos','ghost')} ${photos.length} 张${group?` · ${groupStats(group,state.photos,state.memberships).pending} 张待复盘`:''} · ${state.selecting?'可多选整理，选择恰好两张进入对比。':'点击查看完整画幅。'}</p>
      ${state.selecting?`<div class="batch-toolbar panel"><strong>已选 ${state.selected.length} 张</strong>${btn('全选当前结果','select-all')}${btn('清除选择','clear-select')}${btn('开始对比','compare','primary',state.selected.length===2?'':'disabled')}<select id="batch-group" class="field" aria-label="批量操作目标分组"><option value="">选择目标分组</option>${options()}</select>${btn('加入分组','batch-add')}${btn('移动至该分组','batch-move','',group?'':'disabled')}${btn('移出当前分组','batch-remove','',group?'':'disabled')}${[['keep','保留'],['undecided','待定'],['reject','淘汰']].map(([v,n])=>btn(n,'batch-cull','',`data-value="${v}"`)).join('')}${btn('删除照片','batch-delete','danger',state.selected.length?'':'disabled')}</div>`:''}
      ${photos.length?`<div class="photo-grid">${photos.map(cell).join('')}</div>`:'<div class="empty"><h3>还没有符合条件的照片</h3><p>可导入 JPG / JPEG，或显示全部。</p></div>'}</section>`;
  }
  function groupsPage() {
    return `<section><div class="page-title between"><div><h1>自定义分组</h1><p>一张照片可以出现在多个活动或作品集中，只保存一份副本。</p></div>${btn('返回照片','library')}</div><div class="row">${btn('新建分组','group-new','primary')}<input id="group-search" type="search" class="field" aria-label="搜索分组名称" placeholder="搜索分组名称" value="${esc(ui.groupSearch)}"></div><div class="group-grid">${groups().filter(g=>g.name.toLowerCase().includes(ui.groupSearch.toLowerCase())).map(g=>{const info=groupStats(g,state.photos,state.memberships),cover=info.photos.find(p=>p.id===g.coverPhotoId)||info.photos[0];return `<article class="group-card panel">${cover&&url(cover)?`<img src="${url(cover)}" alt="${esc(g.name)}封面" loading="lazy">`:'<div class="group-cover">暂无封面</div>'}<h2>${esc(g.name)}</h2><p>${esc(g.description)}</p><p class="small muted">${info.count} 张 · ${info.pending} 张待复盘<br>${info.from?`${info.from} — ${info.to}`:'拍摄日期未知 / 尚无照片'}</p><div class="row">${btn('打开 / 对比','group-open','primary',`data-id="${g.id}"`)}${btn('编辑','group-edit','',`data-id="${g.id}"`)}${btn('上移','group-sort','',`data-id="${g.id}" data-direction="-1"`)}${btn('下移','group-sort','',`data-id="${g.id}" data-direction="1"`)}${btn('删除分组','group-delete','danger',`data-id="${g.id}"`)}</div></article>`;}).join('')}</div></section>`;
  }
  function editGroup(group=null,sessionId=null) {
    const members=group?groupStats(group,state.photos,state.memberships).photos:[];
    dialogFrame(group?'编辑分组':'新建分组',`<div class="form-stack"><label>名称<input id="group-name" class="field" maxlength="80" value="${esc(group?.name||'')}"></label><label>简介<textarea id="group-description" class="field" maxlength="500">${esc(group?.description||'')}</textarea></label><label>封面<select id="group-cover" class="field"><option value="">自动使用分组内第一张照片</option>${members.map(p=>`<option value="${p.id}" ${group.coverPhotoId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></div>`,btn('保存分组','group-save','primary',`data-id="${group?.id||''}" data-session="${sessionId||group?.sessionId||''}"`));
  }
  function viewerEditor(p) {
    const assigned=photoGroups(p.id);
    return `<section class="form-stack viewer-organize"><h3>整理与复盘</h3><label>分组（可多选）<select class="field" id="photo-groups" multiple size="4">${groups().map(g=>`<option value="${g.id}" ${assigned.includes(g.id)?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label><label>选片状态<select id="photo-cull" class="field">${[['undecided','待定'],['keep','保留'],['reject','淘汰']].map(([v,n])=>`<option value="${v}" ${p.cull===v?'selected':''}>${n}</option>`).join('')}</select></label><label>画面标签（逗号分隔）<input id="photo-tags" class="field" maxlength="300" placeholder="逆光, 夜景, 构图" value="${esc((p.tags||[]).join(', '))}"></label><label>简短复盘<textarea id="photo-review" class="field" maxlength="1000">${esc(p.reviewNote||'')}</textarea></label>${btn('保存整理与复盘','photo-organize-save','primary',`data-id="${p.id}"`)}${ctx.equipmentEditor?.(p)||''}</section>`;
  }
  function importResult(result) {
    ui.lastResult=result;
    dialogFrame('本批导入结果',`<p>已保存 ${result.photos.length} 张照片 · 重复跳过 ${result.duplicates?.length||0} 张 · 失败 ${result.errors.length} 张</p><p class="small muted">${result.photos.some(p=>!p.day)?'部分照片拍摄日期未知，不猜测日期。':''}未选择分组时保持未归组。旧版未保存文件指纹的照片，首次重复检测无法追溯原始文件。</p><label>把新照片加入分组<select class="field" data-group-index="0"><option value="">保持当前分组</option>${options()}</select></label><label>或新建分组<input id="result-new-group" class="field" maxlength="80" placeholder="例如：阳澄湖周末"></label><div class="error-list">${[...result.errors.map(e=>`${e.name}：${e.error}`),...(result.duplicates||[]).map(d=>`${d.name}：内容相同，已跳过`)].map(t=>`<p>${esc(t)}</p>`).join('')}</div>`,btn('查看本批照片','view-imported')+btn('确认归组','confirm-groups','primary'));
  }
  const reset = () => {ui.group='all';ui.cull='all';ui.view='photos';ctx.resetDeviceFilters?.();};
  async function action(el) {
    const a=el.dataset.action, pid=el.dataset.id;
    switch(a) {
      case 'groups':ui.view='groups';render();return true;
      case 'library':ui.view='photos';render();return true;
      case 'group-new':editGroup();return true;
      case 'group-edit':editGroup(groups().find(g=>g.id===pid));return true;
      case 'group-save':{const group=await saveGroup(store,{name:document.querySelector('#group-name').value,description:document.querySelector('#group-description').value,coverPhotoId:document.querySelector('#group-cover').value,sessionId:el.dataset.session||null},groups().find(g=>g.id===pid));if(group.sessionId)await assignPhotos(store,state.photos.filter(p=>p.sessionId===group.sessionId).map(p=>p.id),group.id);closeDialog();await reload();render();toast('分组已保存。');return true;}
      case 'group-open':ui.view='photos';ui.group=pid;ui.cull='all';state.sessionFilter='all';state.recentOnly=false;state.photoSearch='';state.selecting=false;render();return true;
      case 'group-sort':{const sorted=groups(),i=sorted.findIndex(g=>g.id===pid),j=i+Number(el.dataset.direction);if(j<0||j>=sorted.length)return true;[sorted[i],sorted[j]]=[sorted[j],sorted[i]];await store.merge({groups:sorted.map((g,order)=>({...g,order}))});await reload();render();return true;}
      case 'group-delete':{const g=groups().find(g=>g.id===pid);dialogFrame('删除分组？',`<p>删除「${esc(g.name)}」的分组信息和归组关系。${groupStats(g,state.photos,state.memberships).count} 张照片及其在其他分组中的关系会保留。</p>`,btn('取消','close')+btn('确认删除分组','group-delete-confirm','danger',`data-id="${pid}"`));return true;}
      case 'group-delete-confirm':await deleteGroup(store,pid);closeDialog();await reload();if(ui.group===pid)ui.group='all';render();return true;
      case 'quick-ungrouped':reset();ui.group='unassigned';state.sessionFilter='all';state.recentOnly=false;render();return true;
      case 'quick-review':reset();ui.cull='pending';state.sessionFilter='all';state.recentOnly=false;render();return true;
      case 'quick-recent':case 'recent-import':reset();state.sessionFilter='all';state.recentOnly=true;state.photoSearch='';render();return true;
      case 'reset-photos':reset();return false;
      case 'select-photo':state.selected=state.selected.includes(pid)?state.selected.filter(id=>id!==pid):[...state.selected,pid];render();return true;
      case 'select-all':state.selected=filteredPhotos().map(p=>p.id);render();return true;
      case 'batch-add':case 'batch-move':case 'batch-remove':{if(!state.selected.length)throw new Error('请先选择照片。');const target=a==='batch-remove'?ui.group:document.querySelector('#batch-group').value;if(!target||['all','unassigned'].includes(target))throw new Error('请选择目标分组。');await assignPhotos(store,state.selected,target,{remove:a==='batch-remove',moveFrom:a==='batch-move'?ui.group:null});await reload();render();toast('归组关系已保存，照片副本未重复保存。');return true;}
      case 'batch-cull':{await store.merge({photos:state.photos.filter(p=>state.selected.includes(p.id)).map(p=>({...p,cull:el.dataset.value}))});await reload();render();toast('选片状态已保存。');return true;}
      case 'batch-delete':dialogFrame('删除所选照片？',`<p>将删除 ${state.selected.length} 张复盘副本、EXIF、复盘记录及所有分组中的关联。外部原图不受影响。</p>`,btn('取消','close')+btn('确认删除照片','batch-delete-confirm','danger'));return true;
      case 'delete-photo':dialogFrame('删除这张复盘照片？',`<p>将删除本地复盘副本、EXIF、标记、复盘记录及 ${photoGroups(pid).length} 个分组中的关联。外部原图不受影响。</p>`,btn('取消','close')+btn('确认删除照片','confirm-delete-photo','danger',`data-id="${pid}"`));return true;
      case 'batch-delete-confirm':await deletePhotos(store,state.selected);state.selected=[];closeDialog();ctx.resetUrls();await reload();render();return true;
      case 'confirm-delete-photo':await deletePhotos(store,[pid]);closeDialog();ctx.resetUrls();await reload();state.selected=state.selected.filter(id=>id!==pid);render();return true;
      case 'photo-organize-save':{const p=state.photos.find(p=>p.id===pid),chosen=[...document.querySelector('#photo-groups').selectedOptions].map(o=>o.value),old=photoGroups(pid);for(const gid of old.filter(g=>!chosen.includes(g)))await assignPhotos(store,[pid],gid,{remove:true});for(const gid of chosen)await assignPhotos(store,[pid],gid);await store.put('photos',{...p,cull:document.querySelector('#photo-cull').value,tags:[...new Set(document.querySelector('#photo-tags').value.split(/[,，]/).map(s=>s.trim().slice(0,40)).filter(Boolean))].slice(0,20),reviewNote:document.querySelector('#photo-review').value,reviewedAt:new Date().toISOString()});await reload();render();ctx.showPhoto(pid);toast('整理与复盘已保存。');return true;}
      case 'import':{state.importTarget=el.dataset.session||null;dialogFrame('导入照片',`<p>支持 JPG / JPEG，每批最多 200 张。RAW、HEIC 和 PNG 请先导出为 JPG。按文件内容识别重复，不按文件名。</p><label>选择分组<select id="import-group" class="field"><option value="">未归组</option>${options(groups().some(g=>g.id===ui.group)?ui.group:'')}</select></label><label>或直接新建分组<input id="import-new-group" class="field" maxlength="80" placeholder="例如：夜景练习"></label>`,btn('选择照片','begin-import','primary'));return true;}
      case 'begin-import':{const name=document.querySelector('#import-new-group').value.trim();ui.importGroup=name?(await saveGroup(store,{name})).id:document.querySelector('#import-group').value||null;await reload();closeDialog();document.querySelector('#photo-input').click();return true;}
      case 'confirm-groups':{let target=document.querySelector('[data-group-index]')?.value;const name=document.querySelector('#result-new-group')?.value.trim();if(name)target=(await saveGroup(store,{name})).id;if(target)await assignPhotos(store,(ui.lastResult?.photos||[]).map(p=>p.id),target);closeDialog();await reload();render();return true;}
      case 'view-imported':closeDialog();reset();state.recentOnly=true;state.sessionFilter='all';state.photoSearch='';render();return true;
      case 'import-history':dialogFrame('导入记录',`<div class="stack">${(state.imports||[]).slice().sort((a,b)=>b.at.localeCompare(a.at)).map(r=>`<article class="panel"><h3>${esc(new Date(r.at).toLocaleString('zh-CN'))}</h3><p>成功 ${r.ids.length} / 重复 ${r.duplicates?.length||0} / 失败 ${r.errors.length}</p>${r.errors.map(e=>`<p class="small">${esc(e.name)}：${esc(e.error)}</p>`).join('')}${btn('查看本批','import-open','',`data-id="${r.id}"`)}</article>`).join('')||'<p>尚无导入记录。</p>'}</div>`,btn('关闭','close'));return true;
      case 'import-open':state.lastImport=state.imports.find(r=>r.id===pid);closeDialog();reset();state.recentOnly=true;state.sessionFilter='all';render();return true;
      case 'session-group':{const s=state.sessions.find(s=>s.id===pid);dialogFrame('为本次练习整理照片',`<label>关联已有分组<select id="session-group-select" class="field"><option value="">创建同名分组</option>${options()}</select></label>`,btn('关联照片','session-group-save','primary',`data-id="${pid}"`));return true;}
      case 'session-group-save':{const s=state.sessions.find(s=>s.id===pid),target=document.querySelector('#session-group-select').value||(await saveGroup(store,{name:`${s.day} · ${ctx.sessionName(s)}`,sessionId:s.id})).id;await assignPhotos(store,state.photos.filter(p=>p.sessionId===s.id).map(p=>p.id),target);const g=await store.get('groups',target);await store.put('groups',{...g,sessionId:s.id});closeDialog();await reload();render();toast('已关联本次练习的照片。之后从此练习导入的照片也会加入关联分组。');return true;}
      default:return ctx.deviceAction?ctx.deviceAction(el):false;
    }
  }
  function input(target) {if(target.id!=='group-search')return false;ui.groupSearch=target.value;const pos=target.selectionStart;render();const input=document.querySelector('#group-search');input.focus();input.setSelectionRange(pos,pos);return true;}
  async function change(target) {if(target.id==='group-filter'){ui.group=target.value;state.sessionFilter='all';state.selected=[];render();return true;}if(target.id==='cull-filter'){ui.cull=target.value;state.selected=[];render();return true;}return ctx.deviceChange?ctx.deviceChange(target):false;}
  return {photosPage,filteredPhotos,viewerEditor,importResult,action,input,change,reset,ui,options,photoGroups};
}
