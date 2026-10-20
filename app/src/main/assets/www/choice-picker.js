// One accessible picker for every select. Native controls keep the form contract;
// the visible interaction uses a searchable list / mobile bottom sheet.
const bindings=new WeakMap();
let active=null,sequence=0;
const fold=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/α/g,'a').replace(/[\s\-–—_|()./]/g,'');
const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
const check='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

function titleFor(select){
  if(select.dataset.pickerTitle)return select.dataset.pickerTitle;
  const label=select.labels?.[0];
  if(label){const copy=label.cloneNode(true);copy.querySelectorAll('select,input,button,.choice-control').forEach(n=>n.remove());const title=copy.textContent.trim();if(title)return title;}
  return select.getAttribute('aria-label')||'请选择';
}
function sync(select){
  const binding=bindings.get(select);if(!binding)return;
  const labels=[...select.selectedOptions].map(o=>o.label||o.textContent);
  binding.value.textContent=labels.join('、')||(select.multiple?'选择分组':'请选择');
  binding.button.disabled=select.disabled;
  binding.button.setAttribute('aria-label',`${binding.title}：${labels.join('、')||'未选择'}`);
}
export function enhanceSelects(root=document){
  for(const select of root.querySelectorAll('select')){
    if(bindings.has(select)){sync(select);continue;}
    const title=titleFor(select),wrapper=document.createElement('span'),button=document.createElement('button'),value=document.createElement('span');
    wrapper.className='choice-control'+(select.multiple?' choice-multiple':'');
    button.type='button';button.className='choice-trigger field';button.dataset.pickerFor=select.id||`choice-${++sequence}`;
    button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');value.className='choice-value';
    button.append(value);button.insertAdjacentHTML('beforeend',arrow);
    select.before(wrapper);wrapper.append(select,button);select.classList.add('choice-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    const binding={button,value,title};bindings.set(select,binding);sync(select);
    select.addEventListener('change',()=>sync(select));
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openPicker(select);});
    button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();openPicker(select);}});
  }
}
export function closePicker(restoreFocus=true){
  if(!active)return false;
  const previous=active;active=null;previous.dialog.close();previous.dialog.remove();
  previous.button.setAttribute('aria-expanded','false');
  if(restoreFocus&&previous.button.isConnected)previous.button.focus({preventScroll:true});
  return true;
}
export function pickerOpen(){return !!active;}
function openPicker(select){
  closePicker(false);const binding=bindings.get(select);if(!binding||select.disabled)return;
  const dialog=document.createElement('dialog');dialog.id='choice-dialog';dialog.className='choice-dialog';dialog.setAttribute('aria-label',binding.title);
  const surface=document.createElement('section');surface.className='choice-surface';
  const head=document.createElement('header');head.className='choice-head';
  const heading=document.createElement('h2');heading.textContent=binding.title;
  const cancel=document.createElement('button');cancel.type='button';cancel.className='icon-btn';cancel.setAttribute('aria-label','关闭选择');cancel.textContent='×';cancel.onclick=()=>closePicker();
  head.append(heading,cancel);surface.append(head);
  const hint=document.createElement('p');hint.className='choice-hint';hint.textContent=select.multiple?'可选择多个分组，完成后确认':`${select.options.length} 个选项 · 点击即可选择`;surface.append(hint);
  const list=document.createElement('div');list.className='choice-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',binding.title);if(select.multiple)list.setAttribute('aria-multiselectable','true');
  const selected=new Set([...select.selectedOptions].map(o=>o.index));
  const options=[...select.options];let search;
  function paint(query=''){
    list.replaceChildren();const term=fold(query);let count=0;
    for(const option of options){
      if(option.hidden||term&&!fold(option.label+' '+(option.dataset.search||'')).includes(term))continue;
      const row=document.createElement('button');row.type='button';row.className='choice-option';row.setAttribute('role','option');row.setAttribute('aria-selected',String(selected.has(option.index)));row.disabled=option.disabled||option.parentElement?.disabled;
      const text=document.createElement('span');text.textContent=option.label||option.textContent;row.append(text);row.insertAdjacentHTML('beforeend',check);
      row.addEventListener('click',()=>{if(select.multiple){selected.has(option.index)?selected.delete(option.index):selected.add(option.index);row.setAttribute('aria-selected',String(selected.has(option.index)));}else{selected.clear();selected.add(option.index);commit();}});
      list.append(row);count++;
    }
    if(!count){const empty=document.createElement('p');empty.className='choice-empty';empty.textContent='没有找到，试试其他型号或关键词';list.append(empty);}
  }
  if(options.length>=8){search=document.createElement('input');search.className='field choice-search';search.type='search';search.placeholder='搜索选项 / 型号';search.setAttribute('aria-label','搜索'+binding.title);search.addEventListener('input',()=>paint(search.value));surface.append(search);}
  surface.append(list);
  function commit(){
    closePicker(false);if(!select.isConnected)return;
    for(const option of options)option.selected=selected.has(option.index);
    sync(select);select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));
    const updated=select.id?document.getElementById(select.id):select;bindings.get(updated)?.button.focus({preventScroll:true});
  }
  if(select.multiple){const foot=document.createElement('footer');foot.className='choice-foot';const clear=document.createElement('button');clear.type='button';clear.className='btn';clear.textContent='清除选择';clear.onclick=()=>{selected.clear();paint(search?.value);};const done=document.createElement('button');done.type='button';done.className='btn primary';done.textContent='确认选择';done.onclick=commit;foot.append(clear,done);surface.append(foot);}
  dialog.append(surface);document.body.append(dialog);
  const rect=binding.button.getBoundingClientRect();dialog.style.setProperty('--choice-left',Math.max(16,Math.min(rect.left,innerWidth-440))+'px');dialog.style.setProperty('--choice-top',Math.max(16,Math.min(rect.bottom+8,innerHeight-560))+'px');
  active={dialog,button:binding.button};binding.button.setAttribute('aria-expanded','true');
  dialog.addEventListener('cancel',e=>{e.preventDefault();closePicker();});
  dialog.addEventListener('click',e=>{if(e.target===dialog)closePicker();});
  dialog.addEventListener('keydown',e=>{const buttons=[...list.querySelectorAll('button:not(:disabled)')];const current=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?(current+1)%buttons.length:(current-1+buttons.length)%buttons.length;buttons[next]?.focus();}});
  paint();dialog.showModal();
  if(search&&matchMedia('(min-width:701px)').matches)search.focus();else (list.querySelector('[aria-selected="true"]')||list.querySelector('button')||cancel).focus({preventScroll:true});
}
