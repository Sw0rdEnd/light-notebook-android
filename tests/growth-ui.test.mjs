import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {stats,recommend} from '../app/src/main/assets/www/core.js';
import {THEMES} from '../app/src/main/assets/www/tasks.js';
import {renderGrowthPage} from '../app/src/main/assets/www/growth-ui.js';

function page(sessions=[],photos=[]){
  const window=new Window(),document=window.document;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.body.innerHTML=renderGrowthPage({st:stats(sessions,photos),rec:recommend(sessions,photos),themes:THEMES,esc,icon:name=>`<i data-icon="${name}"></i>`,btn:(label,action,cls='',attrs='')=>`<button data-action="${action}" ${attrs}>${label}</button>`,cell:p=>`<article data-photo="${p.id}">${esc(p.name)}</article>`});
  return {window,document,$:query=>document.querySelector(query),$$:query=>[...document.querySelectorAll(query)]};
}
const session=(id,theme='composition',extra={})=>({id,theme,status:'done',createdAt:`2026-10-${String(id).padStart(2,'0')}T12:00:00Z`,issues:[],...extra});
const photo=(id,focal,extra={})=>({id:`p${id}`,name:`照片${id}.jpg`,day:`2026-10-${String(id).padStart(2,'0')}`,exif:{focal},...extra});

test('empty growth consolidates missing samples and excludes demo content from all metrics',()=>{
  const {window,$,$$}=page([session(1,'composition',{demo:true})],[photo(1,35,{demo:true,liked:true,star:true})]);
  assert.deepEqual($$('.growth-metric strong').map(el=>el.textContent),['0','0','0']);
  assert.equal($$('.growth-insight-empty').length,1);assert.equal($$('.growth-chart-card').length,0);
  assert.equal($('.growth-progress').getAttribute('aria-valuenow'),'0');assert.equal($('[data-action="stars"]'),null);
  assert.equal($('[data-action="nav"]').dataset.tab,'photos');assert.equal($('[data-action="recommended"]').dataset.theme,'composition');
  window.happyDOM.abort();
});

test('partial records show actual progress without premature distribution charts',()=>{
  const {window,$,$$}=page([session(1),session(2,'focal'),session(3,'light',{status:'review'})],[photo(1,35),photo(2,null),photo(3,85)]);
  assert.deepEqual($$('.growth-metric strong').map(el=>el.textContent),['2','3','0']);
  assert.equal($('.growth-progress').getAttribute('aria-valuenow'),'2');assert.equal($$('.growth-progress .done').length,2);
  assert.match($('.growth-insight-empty').textContent,/再完成 1 次复盘/);assert.equal($$('.growth-bars').length,0);
  window.happyDOM.abort();
});

test('each distribution unlocks independently and excludes unknown focal lengths',()=>{
  const {window,$,$$}=page([session(1),session(2,'focal')],[photo(1,35),photo(2,35),photo(3,85),photo(4,null,{liked:true})]);
  assert.equal($('.growth-insight-empty'),null);assert.equal($('[data-chart="themes"]').classList.contains('growth-chart-pending'),true);
  assert.equal($('[data-chart="focal"] .growth-bars')!==null,true);assert.equal($$('[data-chart="focal"] .growth-bar-row').length,2);
  assert.match($('[data-chart="focal"] .growth-chart-note').textContent,/1 张焦距未知/);
  assert.equal($('[data-chart="liked"]').classList.contains('growth-chart-pending'),true);
  assert.match($('[data-chart="liked"]').textContent,/0\/3/);assert.equal($$('.growth-metric[data-metric="photos"] strong')[0].textContent,'4');
  window.happyDOM.abort();
});

test('sufficient real records retain all distributions and chronological representative photos',()=>{
  const photos=[photo(3,85,{liked:true,star:true}),photo(1,24,{liked:true,star:true}),photo(2,35,{liked:true}),photo(4,200,{demo:true,liked:true,star:true})];
  const {window,$,$$}=page([session(1),session(2),session(3,'focal'),session(4,'light',{demo:true})],photos);
  assert.deepEqual($$('.growth-metric strong').map(el=>el.textContent),['3','3','2']);assert.equal($$('.growth-bars').length,3);
  assert.equal($$('.growth-chart-pending').length,0);assert.deepEqual($$('[data-photo]').map(el=>el.dataset.photo),['p1','p3']);
  assert.ok($('[data-action="stars"]'));assert.ok(THEMES[$('[data-action="recommended"]').dataset.theme]);
  assert.doesNotMatch($('.growth-page').textContent,/能力评分/);
  window.happyDOM.abort();
});
