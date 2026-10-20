import test from 'node:test';
import assert from 'node:assert/strict';
import {SEED_CATALOG,CATALOG_REVISION} from '../app/src/main/assets/www/equipment-data.js';
import {searchCatalog} from '../app/src/main/assets/www/catalog-search.js';
import {catalogRecords,matchExif,compatibility,focalPractice} from '../app/src/main/assets/www/equipment.js';
const get=id=>SEED_CATALOG.find(r=>r.id===id);

test('common built-ins can be found by Chinese brand, model shorthand, focal range and mount without importing',()=>{
 assert.equal(SEED_CATALOG.filter(r=>r.type==='body').length,27);assert.equal(SEED_CATALOG.filter(r=>r.type==='lens').length,51);
 for(const [query,id] of [['索尼 A7M4','sony-ilce7m4'],['佳能 R6二代','canon-eosr6ii'],['尼康 Z6III','nikon-z6iii'],['富士 XS20','fujifilm-xs20']])assert.ok(searchCatalog(SEED_CATALOG,{search:query}).some(r=>r.id===id),query);
 const sigma=searchCatalog(SEED_CATALOG,{search:'适马 18-50',mount:'Canon RF'});assert.equal(sigma.length,1);assert.equal(sigma[0].id,'sigma-c021-1850-rf');
 const primes=searchCatalog(SEED_CATALOG,{type:'lens',zoom:'prime',focalMin:50,focalMax:60});assert.ok(primes.length>0);assert.ok(primes.every(r=>r.focal[0]===r.focal[1]));
 assert.equal(searchCatalog(SEED_CATALOG,{search:'不存在的测试型号'}).length,0);
});

test('expanded mount variants preserve crop factors, distinct mass and conservative EXIF ambiguity',()=>{
 const raw={camera:'Canon EOS R50',lens:'18-50mm F2.8 DC DN'};const match=matchExif(raw);assert.equal(match.lens.id,'sigma-c021-1850-rf');assert.equal(match.lens.weightG,300);
 assert.equal(matchExif({camera:'ILCE-6700',lens:raw.lens}).lens.id,'sigma-c021-1850-e');assert.equal(matchExif({lens:raw.lens}).lens,null);
 assert.equal(focalPractice(match.body,match.lens).equivalent,'28.8–80mm');assert.equal(focalPractice(get('fujifilm-xs20'),get('sigma-c021-1850-x')).equivalent,'27–75mm');
 assert.equal(compatibility(get('sony-ilce7m4'),get('sigma-c021-1850-e')).kind,'crop');assert.equal(compatibility(get('sony-ilce7m4'),get('sigma-c021-1850-rf')).kind,'unknown');
 assert.equal(get('tamron-a063-e').weightG,540);assert.equal(get('tamron-a063-z').weightG,550);assert.equal(get('canon-eosr6ii').price.type,'official-msrp');
 const old={...get('sony-ilce7m4'),model:'older local extension',revision:CATALOG_REVISION-1,provenance:'user-import'};assert.equal(catalogRecords([old]).find(r=>r.id===old.id).model,get(old.id).model);
 for(const r of SEED_CATALOG){assert.ok(r.model&&r.mount&&r.format);assert.ok(r.sources.every(s=>s.checkedAt==='2026-10-20'));if(r.type==='lens'){assert.ok(r.focal&&r.maxAperture);assert.ok(r.focal[0]<=r.focal[1]);}if(r.price.amount!=null)assert.ok(r.price.source&&r.price.region&&r.price.currency&&r.price.asOf);}
});
