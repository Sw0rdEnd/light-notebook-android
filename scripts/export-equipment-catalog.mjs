// Documentation is generated from the very same records bundled in the app.
import {writeFile} from 'node:fs/promises';
import {SEED_CATALOG,CATALOG_REVISION} from '../app/src/main/assets/www/equipment-data.js';
const rows=SEED_CATALOG,models=new Set(rows.map(r=>r.brand+r.model));
const clean=s=>String(s||'').replaceAll('|','／');
let text=`# 内置设备型号清单 · 0.2.1\n\n核对日期：2026-10-20。资料修订号：${CATALOG_REVISION}（单调递增，不是发布日期）。共${rows.length}个按卡口区分的条目，${models.size}个具体型号：${rows.filter(r=>r.type==='body').length}台机身、${rows.filter(r=>r.type==='lens').length}个镜头卡口版本，8个品牌。\n\n这些资料随应用预置，升级后自动可选，无需用户导入。入口：设置 → 我的设备 → 添加设备 → 类型、品牌、具体型号。未收录或冷门设备仍可手动添加；资料包入口仅为可选补充。\n\n不同卡口的重量、画幅覆盖独立记录；不是靠品牌相同判断兼容。详情页保留规格、重量口径、官方来源和核对日期，空值明确显示未核实。官方价格缺失不估算，已收录价格也不能视为本地实时售价。未取得官方产品图分发许可，类别图标明确标注「非产品照片」。\n\n`;
for(const brand of [...new Set(rows.map(r=>r.brand))]){
 text+=`## ${brand}\n\n| 类型 | 具体型号 | 原生卡口 | 画幅 | 关键参数 | 官方来源 |\n| --- | --- | --- | --- | --- | --- |\n`;
 for(const r of rows.filter(r=>r.brand===brand))text+=`| ${r.type==='body'?'机身':'镜头'} | ${clean(r.model)} | ${r.mount} | ${r.format} | ${r.type==='body'?`${r.megapixels} MP`:`${r.focal.join('–')}mm · f/${r.maxAperture.join('–')}`} | ${r.sources.map((s,i)=>`[资料${i+1}](${s.url})`).join(' ')} |\n`;
 text+='\n';
}
text+=`## 保留的限制与维护方式\n\n- 这是一批常见设备，并非所有品牌、所有历史型号的完整目录；不要宣称覆盖全部器材。\n- 部分OM镜头的光学防抖等字段本轮仍未明确核实，显示未知；不把「无协同防抖」等同于「无镜头防抖」。\n- Sony ZV-E10 II采用官方页明确列出的292g仅机身口径；其他机身主要为含电池与卡口径，详情逐条说明。\n- Canon RF24–105mm F4 L IS USM最大放大倍率采用新加坡官方规格0.19×；不能与EF同名焦段镜头混用。\n- Sigma999 USD为美国官方发布价；Tamron A071129800 JPY为日本官方建议价。新增Canon R6 II及RF24–70mm F2.8 L的SGD价格为新加坡官网RRP，未扣促销或返现，不代表中国指导价。\n- 增加或校正内置条目时编辑equipment-data.js / equipment-presets.js，核对品牌官方来源、卡口和代际，递增CATALOG_REVISION，再执行node scripts/export-equipment-catalog.mjs生成本文档。\n- 我的设备、历史照片修正和练习快照不会被新版预置数据重写；新增预置资料不要求删除或迁移用户照片。\n`;
await writeFile(new URL('../EQUIPMENT_CATALOG.md',import.meta.url),text,'utf8');
console.log(`Generated EQUIPMENT_CATALOG.md: ${rows.length} entries / ${models.size} models`);
