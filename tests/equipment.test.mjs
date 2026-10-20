import test from 'node:test';
import assert from 'node:assert/strict';
import {SEED_CATALOG} from '../app/src/main/assets/www/equipment-data.js';
import {compatibility,focalPractice,matchExif,photoEquipment,defaultEquipment,validateCatalogPackage} from '../app/src/main/assets/www/equipment.js';
import {createSession} from '../app/src/main/assets/www/core.js';
const get=id=>SEED_CATALOG.find(r=>r.id===id);
test('audited local catalog keeps mount variants, dates, unknown prices and image rights explicit',()=>{
 assert.equal(SEED_CATALOG.length,13);assert.equal(new Set(SEED_CATALOG.map(r=>r.brand)).size,8);
 for(const r of SEED_CATALOG){assert.ok(r.sources.length);assert.ok(r.sources.every(s=>s.url.startsWith('https://')));assert.equal(r.checkedAt,'2026-10-20');assert.equal(r.image.url,null);assert.equal(r.image.cacheAllowed,false);if(r.price.amount===null)assert.equal(r.price.type,'unverified');}
 assert.equal(get('sigma-c025-e').weightG,540);assert.equal(get('sigma-c025-l').weightG,550);assert.equal(get('sigma-c025-e').price.type,'official-launch');assert.equal(get('tamron-a071-e').price.type,'official-msrp');
});
test('compatibility uses mount and coverage, treats adapters and unknown data conservatively',()=>{
 const sony=get('sony-ilce7cm2'),sigma=get('sigma-c025-e');assert.equal(compatibility(sony,sigma).kind,'native');assert.equal(compatibility(sony,get('sigma-c025-l')).kind,'unknown');
 assert.equal(compatibility(get('canon-eosr8'),{mount:'Canon EF',crop:1}).kind,'adapter');
 const fullNikon={...get('nikon-z50ii'),crop:1};assert.equal(compatibility(fullNikon,get('nikon-zdx1650')).kind,'crop');assert.equal(focalPractice(fullNikon,get('nikon-zdx1650')).equivalent,'24–75mm');
 assert.equal(compatibility({...sony,provenance:'manual'},sigma).kind,'unknown');assert.equal(compatibility({type:'phone'},null).kind,'native');
});
test('wish-list, inactive and removed devices never participate in default recommendations',()=>{
 const body={id:'body',snapshot:get('sony-ilce7cm2'),ownership:'owned',active:true},lens={id:'lens',snapshot:get('sigma-c025-e'),ownership:'owned',active:true},kits=[{id:'kit',bodyId:'body',lensId:'lens'}];
 assert.ok(defaultEquipment([body,lens],kits,'kit'));assert.equal(defaultEquipment([body,{...lens,ownership:'curious'}],kits,'kit'),null);assert.equal(defaultEquipment([body,{...lens,active:false}],kits,'kit'),null);assert.equal(defaultEquipment([body],kits,'kit'),null);
 const manual=defaultEquipment([body,{...lens,snapshot:{...lens.snapshot,provenance:'manual'}}],kits,'kit');assert.equal(manual.check.kind,'unknown');assert.match(createSession({equipment:manual}).tasks[0].start,/未核实/);
});
test('EXIF matching preserves ambiguity, uses body mount, and never substitutes a default',()=>{
 const exif={camera:'ILCE-7CM2',lens:'20-200mm F3.5-6.3 DG',focal:85};assert.equal(matchExif(exif).lens.id,'sigma-c025-e');assert.equal(matchExif({lens:exif.lens}).lens,null);assert.equal(matchExif({camera:'mystery'}).body,null);
 const photo={exif,corrections:{body:get('fujifilm-xt5')}};assert.equal(photoEquipment(photo).body.id,'fujifilm-xt5');assert.equal(photo.exif.camera,'ILCE-7CM2');assert.equal(photoEquipment({exif:{}}).body,null);
});
test('catalog packages are versioned data and cannot declare imported images or specs audited',()=>{
 assert.throws(()=>validateCatalogPackage({app:'light-journal-equipment',schema:1,revision:1,records:[]}));
 const data={app:'light-journal-equipment',schema:1,revision:20261021,records:[get('sony-ilce7cm2')]};const [r]=validateCatalogPackage(data);assert.equal(r.provenance,'user-import');assert.equal(r.image.url,null);assert.equal(r.image.cacheAllowed,false);
 data.records[0]={...data.records[0],crop:-1};assert.throws(()=>validateCatalogPackage(data));
});
test('training uses real owned lens ranges and feasible apertures, retains historical snapshot',()=>{
 const gear={name:'我的变焦',body:get('sony-ilce7cm2'),lens:get('sigma-c025-e'),check:compatibility(get('sony-ilce7cm2'),get('sigma-c025-e'))};
 const focal=createSession({theme:'focal',equipment:gear});assert.match(focal.tasks[0].action,/20、50、200mm/);assert.ok(!JSON.stringify(focal.tasks).includes('f/1.4'));assert.match(focal.tasks[0].start,/f\/8/);
 const exposure=createSession({theme:'exposure',equipment:gear});assert.match(exposure.tasks[2].action,/f\/8 与 f\/11/);
 gear.name='更改后的组合';assert.equal(focal.equipment.name,'我的变焦');
 const prime=createSession({theme:'focal',equipment:{...gear,body:get('fujifilm-xt5'),lens:get('fujifilm-xf35f2')}});assert.match(prime.tasks[0].action,/定焦/);assert.ok(!prime.tasks[0].action.includes('200'));
 const phone=createSession({theme:'exposure',equipment:{body:{type:'phone'}}});assert.match(phone.tasks[2].action,/手机/);assert.ok(!JSON.stringify(phone.tasks).includes('f/1.4'));
});
