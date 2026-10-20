// Maintained built-ins, checked against the linked manufacturer specifications.
// Null means not verified in this snapshot. Mount variants carry their own mass
// and coverage; a matching brand is never evidence of compatibility.
export function commonPresets(item){
  const body=(id,brand,model,mount,format,crop,sensorMm,megapixels,weightG,stabilization,source,aliases=[])=>item(id,'body',brand,model,mount,format,crop,{sensorMm,megapixels,weightG,stabilization},source,aliases);
  const lens=(id,brand,model,mount,format,crop,focal,maxAperture,weightG,stabilization,minFocus,magnification,filterMm,source,aliases=[],extra={})=>item(id,'lens',brand,model,mount,format,crop,{focal,maxAperture,weightG,stabilization,minFocus,magnification,filterMm,...extra},source,[model.replaceAll('–','-'),...aliases]);
  const sonyBody=code=>`https://www.sony.com/electronics/support/e-mount-body-ilce-${['6700','6400'].includes(code)?'6000':'7'}-series/ilce-${code}/specifications`;
  const sonyLens=code=>`https://www.sony.com/electronics/support/lenses-e-mount-lenses/${code}/specifications`;
  const canon=slug=>`https://sg.canon/en/consumer/${slug}/body/specification`;
  const canonLens=slug=>`https://sg.canon/en/consumer/${slug}/main/specification`;
  const nikon=slug=>`https://imaging.nikon.com/imaging/lineup/mirrorless/${slug}/`;
  const nikonLens=slug=>`https://imaging.nikon.com/imaging/lineup/lens/z-mount/${slug}/`;
  const fuji=(kind,slug)=>`https://www.fujifilm-x.com/en-us/products/${kind}/${slug}/specifications/`;
  const sigma=slug=>`https://www.sigma-global.com/en/lenses/${slug}/`;
  const tamron=code=>`https://www.tamron.com/global/consumer/lenses/${code}/spec.html`;
  const rows=[
    body('sony-ilce7m4','Sony','α7 IV (ILCE-7M4)','Sony E','全画幅',1,[35.9,23.9],33,658,true,sonyBody('7m4'),['ILCE-7M4','A7 IV','A7M4','A74','索尼A7四代']),
    body('sony-ilce7m3','Sony','α7 III (ILCE-7M3)','Sony E','全画幅',1,[35.6,23.8],24.2,650,true,sonyBody('7m3'),['ILCE-7M3','A7 III','A7M3','A73','索尼A7三代']),
    body('sony-ilce7rm5','Sony','α7R V (ILCE-7RM5)','Sony E','全画幅',1,[35.7,23.8],61,723,true,sonyBody('7rm5'),['ILCE-7RM5','A7R V','A7R5','A7RM5']),
    body('sony-ilce7cr','Sony','α7CR (ILCE-7CR)','Sony E','全画幅',1,[35.7,23.8],61,515,true,sonyBody('7cr'),['ILCE-7CR','A7CR']),
    body('sony-ilce6700','Sony','α6700 (ILCE-6700)','Sony E','APS-C',1.5,[23.3,15.5],26,493,true,sonyBody('6700'),['ILCE-6700','A6700','Sony a6700']),
    body('sony-ilce6400','Sony','α6400 (ILCE-6400)','Sony E','APS-C',1.5,[23.5,15.6],24.2,403,false,sonyBody('6400'),['ILCE-6400','A6400','Sony a6400']),
    body('sony-zve10m2','Sony','ZV-E10 II (ZV-E10M2)','Sony E','APS-C',1.5,[23.3,15.5],26,292,false,'https://www.sony.com/electronics/support/e-mount-body-zv-e-series/zv-e10m2/specifications',['ZV-E10M2','ZV-E10 II','ZVE10II']),
    body('canon-eosr6ii','Canon','EOS R6 Mark II','Canon RF','全画幅',1,[36,24],24.2,670,true,canon('eos-r6-mark-ii'),['Canon EOS R6m2','Canon EOS R6 Mark II','EOS R6 II','R6二代']),
    body('canon-eosr5ii','Canon','EOS R5 Mark II','Canon RF','全画幅',1,[36,24],45,746,true,canon('eos-r5-mark-ii'),['Canon EOS R5m2','Canon EOS R5 Mark II','EOS R5 II','R5二代']),
    body('canon-eosr7','Canon','EOS R7','Canon RF','APS-C',1.6,[22.3,14.8],32.5,612,true,canon('eos-r7'),['Canon EOS R7']),
    body('canon-eosr50','Canon','EOS R50','Canon RF','APS-C',1.6,[22.3,14.9],24.2,375,false,canon('eos-r50'),['Canon EOS R50']),
    body('nikon-z6iii','Nikon','Z6III','Nikon Z','全画幅',1,[35.9,23.9],24.5,760,true,nikon('z6_3'),['NIKON Z6_3','NIKON Z6III','NIKON Z6 III','Z6III','Z6三代']),
    body('nikon-z8','Nikon','Z8','Nikon Z','全画幅',1,[35.9,23.9],45.7,910,true,nikon('z_8'),['NIKON Z8','NIKON Z 8','Z 8']),
    body('nikon-zf','Nikon','Zf','Nikon Z','全画幅',1,[35.9,23.9],24.5,710,true,nikon('z_f'),['NIKON Z f','NIKON Zf','Z f']),
    body('nikon-zfc','Nikon','Zfc','Nikon Z','APS-C',1.5,[23.5,15.7],20.9,445,false,nikon('z_fc'),['NIKON Z fc','NIKON Zfc','Z fc']),
    body('fujifilm-xs20','Fujifilm','X-S20','Fujifilm X','APS-C',1.5,[23.5,15.6],26.1,491,true,fuji('cameras','x-s20'),['FUJIFILM X-S20','XS20']),
    body('fujifilm-xt50','Fujifilm','X-T50','Fujifilm X','APS-C',1.5,[23.5,15.7],40.2,438,true,fuji('cameras','x-t50'),['FUJIFILM X-T50','XT50']),
    body('fujifilm-xm5','Fujifilm','X-M5','Fujifilm X','APS-C',1.5,[23.5,15.6],26.1,355,false,fuji('cameras','x-m5'),['FUJIFILM X-M5','XM5']),
    body('panasonic-s9','Panasonic','LUMIX S9 (DC-S9)','L-Mount','全画幅',1,[35.6,23.8],24.2,486,true,'https://help.na.panasonic.com/answers/features-and-specifications-lumix-s-series-model-dc-s9k/',['DC-S9','LUMIX DC-S9','S9']),
    body('panasonic-g9ii','Panasonic','LUMIX G9II (DC-G9M2)','Micro Four Thirds','M4/3',2,[17.3,13],25.2,658,true,'https://help.na.panasonic.com/answers/specifications-sheet-for-lumix-g-series-dc-g9m2/',['DC-G9M2','LUMIX DC-G9M2','G9II','G9二代']),
    body('om-om5','OM SYSTEM','OM-5','Micro Four Thirds','M4/3',2,[17.3,13],20.4,414,true,'https://explore.omsystem.com/gb/en/om-5',['OM-5','OM SYSTEM OM-5']),

    lens('sony-sel2470gm2','Sony','FE 24–70mm F2.8 GM II (SEL2470GM2)','Sony E','全画幅',1,[24,70],[2.8,2.8],695,false,'0.21m（24mm）/ 0.30m（70mm）','0.32×',82,sonyLens('sel2470gm2'),['FE 24-70mm F2.8 GM II']),
    lens('sony-sel70200gm2','Sony','FE 70–200mm F2.8 GM OSS II (SEL70200GM2)','Sony E','全画幅',1,[70,200],[2.8,2.8],1045,true,'0.4m（70mm）/ 0.82m（200mm）','0.3×',77,sonyLens('sel70200gm2'),['FE 70-200mm F2.8 GM OSS II'],{weightBasis:'不含脚架环、镜头盖与遮光罩'}),
    lens('sony-sel35f18f','Sony','FE 35mm F1.8 (SEL35F18F)','Sony E','全画幅',1,[35,35],[1.8,1.8],280,false,'0.22m','0.24×',55,sonyLens('sel35f18f'),['FE 35mm F1.8']),
    lens('sony-sel85f18','Sony','FE 85mm F1.8 (SEL85F18)','Sony E','全画幅',1,[85,85],[1.8,1.8],371,false,'0.8m','0.13×',67,sonyLens('sel85f18'),['FE 85mm F1.8']),
    lens('sony-sel18135','Sony','E 18–135mm F3.5–5.6 OSS (SEL18135)','Sony E','APS-C',1.5,[18,135],[3.5,5.6],325,true,'0.45m','0.29×',55,sonyLens('sel18135'),['E 18-135mm F3.5-5.6 OSS']),
    lens('canon-rf2470f28','Canon','RF24–70mm F2.8 L IS USM','Canon RF','全画幅',1,[24,70],[2.8,2.8],900,true,'0.21m（广角端）','0.30×（32mm）',82,canonLens('rf24-70mm-f-2-8l-is-usm'),['RF24-70mm F2.8 L IS USM','RF24-70mm F2.8L IS USM']),
    lens('canon-rf24105f4','Canon','RF24–105mm F4 L IS USM','Canon RF','全画幅',1,[24,105],[4,4],700,true,'0.45m','0.19×',77,canonLens('rf24-105mm-f-4l-is-usm'),['RF24-105mm F4 L IS USM','RF24-105mm F4L IS USM']),
    lens('canon-rf50f18','Canon','RF50mm F1.8 STM','Canon RF','全画幅',1,[50,50],[1.8,1.8],160,false,'0.3m','0.25×',43,canonLens('rf50mm-f-1-8-stm'),['RF50mm F1.8 STM']),
    lens('canon-rf100400','Canon','RF100–400mm F5.6–8 IS USM','Canon RF','全画幅',1,[100,400],[5.6,8],635,true,'0.88m（200mm）；其他焦段不同','0.41×（400mm）',67,'https://sg.canon/en/pro-imaging/products/compare/rf100-400mm-f-5-6-8-is-usm?variant=main',['RF100-400mm F5.6-8 IS USM']),
    lens('nikon-z2470f4','Nikon','NIKKOR Z 24–70mm f/4 S','Nikon Z','全画幅',1,[24,70],[4,4],500,false,'0.3m','0.3×',72,nikonLens('z_24-70mmf4s'),['NIKKOR Z 24-70mm f/4 S']),
    lens('nikon-z24120f4','Nikon','NIKKOR Z 24–120mm f/4 S','Nikon Z','全画幅',1,[24,120],[4,4],630,false,'0.35m','0.39×',77,nikonLens('z_24-120mmf4s'),['NIKKOR Z 24-120mm f/4 S']),
    lens('nikon-z180600','Nikon','NIKKOR Z 180–600mm f/5.6–6.3 VR','Nikon Z','全画幅',1,[180,600],[5.6,6.3],1955,true,'1.3m（180mm）/ 2.4m（600mm）','0.25×',95,nikonLens('z_180-600mmf56-63_vr'),['NIKKOR Z 180-600mm f/5.6-6.3 VR'],{weightBasis:'不含脚架环；含环约2140g'}),
    lens('nikon-z40f2','Nikon','NIKKOR Z 40mm f/2','Nikon Z','全画幅',1,[40,40],[2,2],170,false,'0.29m','0.17×',52,nikonLens('z_40mmf2'),['NIKKOR Z 40mm f/2']),
    lens('fujifilm-xf1855','Fujifilm','FUJINON XF18–55mmF2.8–4 R LM OIS','Fujifilm X','APS-C',1.5,[18,55],[2.8,4],310,true,'微距模式0.30m（广角）/ 0.40m（长焦）','0.15×（长焦）',58,'https://www.fujifilm-x.com/zh-cn/products/lenses/xf18-55mmf28-4-r-lm-ois/specifications/',['XF18-55mmF2.8-4 R LM OIS']),
    lens('fujifilm-xf1655ii','Fujifilm','FUJINON XF16–55mmF2.8 R LM WR II','Fujifilm X','APS-C',1.5,[16,55],[2.8,2.8],410,false,'0.3m','0.21×（长焦）',72,'https://dl.fujifilm-x.com/support/manual/lenses/lens_xf16-55mmf28_r_lm_wr_ii_01.pdf',['XF16-55mmF2.8 R LM WR II']),
    lens('fujifilm-xf70300','Fujifilm','FUJINON XF70–300mmF4–5.6 R LM OIS WR','Fujifilm X','APS-C',1.5,[70,300],[4,5.6],580,true,'0.83m','0.33×（长焦；非35mm等效倍率）',67,fuji('lenses','xf70-300mmf4-56-r-lm-ois-wr'),['XF70-300mmF4-5.6 R LM OIS WR']),
    lens('panasonic-s24105','Panasonic','LUMIX S 24–105mm F4 MACRO O.I.S. (S-R24105)','L-Mount','全画幅',1,[24,105],[4,4],680,true,'0.3m','0.5×',77,'https://latam.connect.panasonic.com/br/en/products/lumix/s-r24105',['S-R24105','LUMIX S 24-105/F4']),
    lens('panasonic-s50f18','Panasonic','LUMIX S 50mm F1.8 (S-S50)','L-Mount','全画幅',1,[50,50],[1.8,1.8],300,false,'0.45m','0.14×',67,'https://help.na.panasonic.com/answers/features-and-specifications-lumix-lens-model-s-s50/',['S-S50','LUMIX S 50/F1.8']),
    lens('om-1240f28ii','OM SYSTEM','M.Zuiko Digital ED 12–40mm F2.8 PRO II','Micro Four Thirds','M4/3',2,[12,40],[2.8,2.8],382,null,'0.2m','0.3×',62,'https://explore.omsystem.com/c/en/m-zuiko-ed-12-40mm-f2-8-pro-ii',['OM M.12-40mm F2.8 II','M.12-40mm F2.8 II'],{notes:'镜头光学防抖未在本次官方规格页中明确确认，保留未核实；不可把机身防抖当作镜头防抖。'}),
    lens('om-40150f4','OM SYSTEM','M.Zuiko Digital ED 40–150mm F4.0 PRO','Micro Four Thirds','M4/3',2,[40,150],[4,4],382,null,'0.7m','0.21×',62,'https://explore.omsystem.com/in/en/m-zuiko-ed-40-150mm-f4-0-pro',['OM M.40-150mm F4.0','M.40-150mm F4.0'],{notes:'官方表标注Lens Sync IS为No；镜头光学防抖未进一步核实，保留未知。'})
  ];
  const addVariants=(base,brand,model,variants,format,focal,aperture,stabilization,minFocus,magnification,filter,source,aliases,extra={})=>{
    for(const [suffix,mount,weight,crop] of variants)rows.push(lens(`${base}-${suffix}`,brand,model,mount,format,crop,focal,aperture,weight,stabilization,minFocus,magnification,filter,source,aliases,extra));
  };
  addVariants('sigma-a024','Sigma','24–70mm F2.8 DG DN II | Art (A024)',[['e','Sony E',735,1],['l','L-Mount',745,1]],'全画幅',[24,70],[2.8,2.8],false,'0.17m（广角）/ 0.34m（长焦）','1:2.7（广角）/ 1:4（长焦）',82,sigma('a024_24_70_28_ii'),['SIGMA 24-70mm F2.8 DG DN II','24-70mm F2.8 DG DN II']);
  addVariants('sigma-c021-2870','Sigma','28–70mm F2.8 DG DN | Contemporary (C021)',[['e','Sony E',470,1],['l','L-Mount',470,1]],'全画幅',[28,70],[2.8,2.8],false,'0.19m（广角）/ 0.38m（长焦）','1:3.3（广角）/ 1:4.6（长焦）',67,sigma('c021_28_70_28'),['SIGMA 28-70mm F2.8 DG DN','28-70mm F2.8 DG DN']);
  addVariants('sigma-c021-1850','Sigma','18–50mm F2.8 DC DN | Contemporary (C021)',[['e','Sony E',290,1.5],['x','Fujifilm X',285,1.5],['rf','Canon RF',300,1.6],['l','L-Mount',290,1.5]],'APS-C',[18,50],[2.8,2.8],false,'0.121m（广角）/ 0.3m（长焦）','1:2.8（广角）/ 1:5（长焦）',55,sigma('c021_18_50_28'),['SIGMA 18-50mm F2.8 DC DN','18-50mm F2.8 DC DN']);
  addVariants('sigma-c018-56','Sigma','56mm F1.4 DC DN | Contemporary (C018)',[['e','Sony E',280,1.5],['x','Fujifilm X',280,1.5],['z','Nikon Z',295,1.5],['rf','Canon RF',290,1.6],['l','L-Mount',285,1.5]],'APS-C',[56,56],[1.4,1.4],false,'0.5m','1:7.4',55,sigma('c018_56_14'),['SIGMA 56mm F1.4 DC DN','56mm F1.4 DC DN']);
  rows.push(lens('sigma-c018-56-mft','Sigma','56mm F1.4 DC DN | Contemporary (C018)','Micro Four Thirds','M4/3',2,[56,56],[1.4,1.4],256,false,'0.5m','1:7.4',55,sigma('c018_56_14'),['SIGMA 56mm F1.4 DC DN','56mm F1.4 DC DN']));
  addVariants('tamron-a063','Tamron','28–75mm F/2.8 Di III VXD G2 (A063)',[['e','Sony E',540,1],['z','Nikon Z',550,1]],'全画幅',[28,75],[2.8,2.8],false,'0.18m（广角）/ 0.38m（长焦）','1:2.7（广角）/ 1:4.1（长焦）',67,tamron('a063'),['28-75mm F2.8 Di III VXD G2','TAMRON 28-75mm F2.8 Di III VXD G2 A063']);
  addVariants('tamron-a058','Tamron','35–150mm F/2–2.8 Di III VXD (A058)',[['e','Sony E',1165,1],['z','Nikon Z',1190,1]],'全画幅',[35,150],[2,2.8],false,'0.33m（广角）/ 0.85m（长焦）','1:5.7（广角）/ 1:5.9（长焦）',82,tamron('a058'),['35-150mm F2-2.8 Di III VXD','TAMRON 35-150mm F2-2.8 Di III VXD A058']);
  addVariants('tamron-b070','Tamron','17–70mm F/2.8 Di III-A VC RXD (B070)',[['e','Sony E',525,1.5],['x','Fujifilm X',530,1.5],['z','Nikon Z',540,1.5],['rf','Canon RF',530,1.6]],'APS-C',[17,70],[2.8,2.8],true,'0.19m（广角）/ 0.39m（长焦）','1:4.8（广角）/ 1:5.2（长焦）',67,tamron('b070'),['17-70mm F2.8 Di III-A VC RXD','TAMRON 17-70mm F2.8 Di III-A VC RXD B070']);
  addVariants('tamron-a057','Tamron','150–500mm F/5–6.7 Di III VC VXD (A057)',[['e','Sony E',1725,1],['z','Nikon Z',1720,1]],'全画幅',[150,500],[5,6.7],true,'0.6m（广角）/ 1.8m（长焦）','1:3.1（广角）/ 1:3.7（长焦）',82,tamron('a057'),['150-500mm F5-6.7 Di III VC VXD','TAMRON 150-500mm F5-6.7 Di III VC VXD A057'],{weightBasis:'不含脚架座；脚架座另约155g'});
  // Manufacturer regional RRP, kept separate from promotions and purchase prices.
  for(const [id,amount] of [['canon-eosr6ii',3199],['canon-rf2470f28',4049]]){
    const record=rows.find(r=>r.id===id);record.price={amount,region:'新加坡',currency:'SGD',type:'official-msrp',asOf:'2026-10-20',checkedAt:'2026-10-20',note:'佳能新加坡官网RRP；不是中国指导价，未扣除返现或促销',source:record.sources[0].url};
  }
  // Canon manuals provide exact sensor sizes; the regional pages provide body mass.
  for(const [id,url] of [['canon-eosr6ii','https://cam.start.canon/en/C012/manual/html/UG-10_Reference_0100.html'],['canon-eosr5ii','https://cam.start.canon/en/C017/manual/html/UG-10_Reference_0110.html'],['canon-eosr7','https://cam.start.canon/en/C005/manual/html/UG-10_Reference_0100.html'],['canon-eosr50','https://cam.start.canon/en/C011/manual/html/UG-10_Reference_0100.html']])rows.find(r=>r.id===id).sources.push({url,title:'官方使用说明书：传感器及卡口规格',checkedAt:'2026-10-20'});
  rows.find(r=>r.id==='canon-eosr50').weightBasis='黑色机身，含电池和存储卡；白色约376g';
  rows.find(r=>r.id==='sony-zve10m2').weightBasis='仅机身，不含电池和存储卡；采用本次官方页面明确列出的重量口径';
  rows.find(r=>r.id==='nikon-z6iii').notes='重量采用尼康全球官方规格（含电池和卡760g）；部分地区页面的670g是另一重量口径，不混用。';
  return rows;
}
