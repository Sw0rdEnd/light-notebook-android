// Audited local snapshot. No website scraping occurs when browsing the library.
import {commonPresets} from './equipment-presets.js';
export const CATALOG_REVISION = 20261021;
const checkedAt='2026-10-20';
const item=(id,type,brand,model,mount,format,crop,spec,source,aliases=[])=>({
  id,type,brand,model,mount,format,crop,aliases,revision:CATALOG_REVISION,checkedAt,provenance:'official-specification',
  weightG:null,weightBasis:type==='body'?'含电池和存储卡':'不含盖及遮光罩',sensorMm:null,megapixels:null,stabilization:null,
  focal:null,maxAperture:null,minFocus:null,magnification:null,filterMm:null,
  price:{amount:null,region:null,currency:null,type:'unverified',asOf:checkedAt,note:'暂未查到官方价格'},
  image:{url:null,cacheAllowed:false,rights:'产品参考图随应用单独维护；来源与版权说明见设备详情',officialPage:source},
  sources:[{url:source,title:'品牌官方规格 / 产品资料',checkedAt}],...spec
});
const sigmaSource='https://www.sigma-global.com/en/lenses/c025_20_200_35_63/';
const sigmaPriceSource='https://press.sigmaphoto.com/product/09/sigma-announces-worlds-first-20-200mm-10x-zoom-lens-for-full-frame-mirrorless-cameras/';
const sigma=(mount,weight)=>item(`sigma-c025-${mount==='Sony E'?'e':'l'}`,'lens','Sigma','20–200mm F3.5–6.3 DG | Contemporary (C025)',mount,'全画幅',1,{
  weightG:weight,focal:[20,200],maxAperture:[3.5,6.3],stabilization:false,minFocus:'20mm端 0.25m / 200mm端 0.65m；28mm时 0.165m',magnification:'0.5×（28–85mm）',filterMm:72,
  price:{amount:999,region:'美国',currency:'USD',type:'official-launch',asOf:'2025-09-09',checkedAt,note:'官方美国发布零售价；不代表当前售价或其他地区指导价',source:sigmaPriceSource}
},sigmaSource,['SIGMA 20-200mm F3.5-6.3 DG','20-200mm F3.5-6.3 DG','Sigma 20-200mm F3.5-6.3 DG | Contemporary']);
export const SEED_CATALOG=[
  item('sony-ilce7cm2','body','Sony','α7C II (ILCE-7CM2)','Sony E','全画幅',1,{sensorMm:[35.9,23.9],megapixels:33,weightG:514,stabilization:true},'https://www.sony.com/electronics/support/e-mount-body-ilce-7-series/ilce-7cm2/specifications',['ILCE-7CM2','Sony A7C II','A7CII','Alpha 7C II']),
  item('canon-eosr8','body','Canon','EOS R8','Canon RF','全画幅',1,{sensorMm:[36,24],megapixels:24.2,weightG:461,stabilization:false},'https://www.usa.canon.com/support/p/eos-r8',['Canon EOS R8']),
  item('nikon-z50ii','body','Nikon','Z50II','Nikon Z','APS-C',1.5,{sensorMm:[23.5,15.7],megapixels:20.9,weightG:495,stabilization:false,notes:'无传感器位移防抖；VR镜头防抖与视频电子防抖不能当作IBIS。'},'https://www.nikonusa.com/p/z50ii/1788/overview',['NIKON Z50_2','NIKON Z50II','NIKON Z50 II','Z50 II']),
  item('fujifilm-xt5','body','Fujifilm','X-T5','Fujifilm X','APS-C',1.5,{sensorMm:[23.5,15.7],megapixels:40.2,weightG:557,stabilization:true},'https://www.fujifilm-x.com/en-us/products/cameras/x-t5/specifications/',['FUJIFILM X-T5']),
  item('panasonic-s5ii','body','Panasonic','LUMIX S5II (DC-S5M2)','L-Mount','全画幅',1,{sensorMm:[35.6,23.8],megapixels:24.2,weightG:740,stabilization:true},'https://help.na.panasonic.com/answers/specifications-sheet-lumix-s-series-dc-s5m2/',['DC-S5M2','LUMIX DC-S5M2','S5II']),
  item('om-om1ii','body','OM SYSTEM','OM-1 Mark II','Micro Four Thirds','M4/3',2,{sensorMm:[17.4,13],megapixels:20.4,weightG:599,stabilization:true,notes:'尺寸采用官方说明书17.4×13.0mm；部分官网营销表写17.3×13.0mm，等效换算按系统标称2×。',sources:[{url:'https://download.omsystem.com/pages/inst/om1m2/manual_om1m2_v1.2_ENU.pdf',title:'官方说明书规格，p.504',checkedAt},{url:'https://explore.omsystem.com/us/en/om-1-mark-ii-body',title:'官方产品页（有效像素约20.4MP、重量含电池卡599g）',checkedAt}]},'https://explore.omsystem.com/us/en/om-1-mark-ii-body',['OM-1MarkII','OM-1 Mark II']),
  sigma('Sony E',540),sigma('L-Mount',550),
  item('tamron-a071-e','lens','Tamron','28–200mm F/2.8–5.6 Di III RXD (A071)','Sony E','全画幅',1,{weightG:575,focal:[28,200],maxAperture:[2.8,5.6],stabilization:false,minFocus:'0.19m（28mm）/ 0.8m（200mm）',magnification:'1:3.1（广角）/ 1:3.8（长焦）',filterMm:67,price:{amount:129800,region:'日本',currency:'JPY',type:'official-msrp',asOf:'2026-04-01',checkedAt,note:'希望小売価格，含税；不折算为中国指导价',source:'https://www.tamron.com/jp/consumer/lenses/a071/spec.html'}},'https://www.tamron.com/global/consumer/lenses/a071/',['28-200mm F2.8-5.6','TAMRON 28-200mm F2.8-5.6 Di III RXD A071']),
  item('fujifilm-xf35f2','lens','Fujifilm','FUJINON XF35mmF2 R WR','Fujifilm X','APS-C',1.5,{weightG:170,focal:[35,35],maxAperture:[2,2],stabilization:false,minFocus:'0.35m',magnification:'0.135×',filterMm:43},'https://www.fujifilm-x.com/en-ca/products/lenses/xf35mmf2-r-wr/specifications/',['XF35mmF2 R WR','XF35mmF2 R WR.']),
  item('nikon-zdx1650','lens','Nikon','NIKKOR Z DX 16–50mm f/3.5–6.3 VR','Nikon Z','APS-C',1.5,{weightG:135,focal:[16,50],maxAperture:[3.5,6.3],stabilization:true,minFocus:'0.20m（24mm）/ 0.23m（35mm）/ 0.25m（16mm）/ 0.30m（50mm）',magnification:'0.2×',filterMm:46},'https://www.nikonusa.com/p/nikkor-z-dx-16-50mm-f35-63-vr/20084/overview',['NIKKOR Z DX 16-50mm f/3.5-6.3 VR']),
  item('panasonic-s2060','lens','Panasonic','LUMIX S 20–60mm F3.5–5.6 (S-R2060)','L-Mount','全画幅',1,{weightG:350,focal:[20,60],maxAperture:[3.5,5.6],stabilization:false,minFocus:'0.15m（20–26mm）/ 0.4m（60mm）',magnification:'0.43×（26mm）',filterMm:67},'https://help.na.panasonic.com/wp-content/uploads/2023/02/SR2060_DVQX2110ZA_ENG_FRE_ESP_CHI_GER_ITA_RUS_TAI.pdf',['S-R2060','LUMIX S 20-60/F3.5-5.6']),
  item('om-1245f4','lens','OM SYSTEM','M.Zuiko Digital ED 12–45mm F4.0 PRO','Micro Four Thirds','M4/3',2,{weightG:254,focal:[12,45],maxAperture:[4,4],stabilization:null,minFocus:'最近0.12m（广角）；长焦端待核实',magnification:null,filterMm:58,notes:'尚未从本次抓取的官方页面核实防抖和最大倍率，保留未知，不推断。'},'https://explore.omsystem.com/us/en/m-zuiko-ed-12-45mm-f4-0-pro-black',['OLYMPUS M.12-45mm F4.0','M.12-45mm F4.0'])
  , ...commonPresets(item)
];
