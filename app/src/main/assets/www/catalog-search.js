export const BRAND_NAMES={Sony:'索尼',Canon:'佳能',Nikon:'尼康',Fujifilm:'富士',Panasonic:'松下','OM SYSTEM':'奥之心 / 奥林巴斯',Sigma:'适马',Tamron:'腾龙'};
export const brandLabel=brand=>`${BRAND_NAMES[brand]||brand}${BRAND_NAMES[brand]?' '+brand:''}`;
const fold=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/α/g,'a').replace(/[\s\-–—_|()./]/g,'');
export const catalogSearchText=r=>[r.brand,BRAND_NAMES[r.brand],r.model,r.mount,...(r.aliases||[])].filter(Boolean).join(' ');
export function searchCatalog(records,filters={}){
  const {type='all',brand='all',format='all',mount='all',zoom='all',search='',focalMin='',focalMax=''}=filters;
  const terms=String(search).trim().split(/\s+/).map(fold).filter(Boolean);
  return records.filter(r=>(type==='all'||r.type===type)&&(brand==='all'||r.brand===brand)&&(format==='all'||r.format===format)&&(mount==='all'||r.mount===mount)&&terms.every(term=>fold(catalogSearchText(r)).includes(term))&&(zoom==='all'||r.focal&&(zoom==='prime'?r.focal[0]===r.focal[1]:r.focal[0]!==r.focal[1]))&&(!focalMin||r.focal&&r.focal[1]>=Number(focalMin))&&(!focalMax||r.focal&&r.focal[0]<=Number(focalMax)));
}
