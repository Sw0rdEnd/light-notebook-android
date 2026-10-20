// Bounded TIFF/EXIF reader. Reads standard JPEG APP1 tags, never MakerNotes or GPS.
export function readExif(input){
 const result={};try{
 const view=new DataView(input);if(view.byteLength<4||view.getUint16(0)!==0xffd8)return result;
 let p=2;while(p+4<=view.byteLength){
  if(view.getUint8(p)!==0xff)break;
  const mark=view.getUint8(p+1);if(mark===0xda||mark===0xd9)break;
  if(mark===0x01||(mark>=0xd0&&mark<=0xd7)){p+=2;continue;}
  const len=view.getUint16(p+2);if(len<2||p+2+len>view.byteLength)break;
  if(mark===0xe1&&len>=8&&view.getUint32(p+4)===0x45786966&&view.getUint16(p+8)===0){parseTiff(p+10,p+2+len);break;}
  p+=2+len;
 }
 function parseTiff(t,end){
  const little=view.getUint16(t)===0x4949;if(!little&&view.getUint16(t)!==0x4d4d)return;
  const check=(p,n=1)=>{if(p<t||p+n>end)throw new Error('EXIF bounds');};
  const u16=p=>{check(p,2);return view.getUint16(p,little);};const u32=p=>{check(p,4);return view.getUint32(p,little);};
  if(u16(t+2)!==42)return;
  const sizes={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};let sub;
  const val=e=>{const type=u16(e+2),count=u32(e+4),size=sizes[type];if(!size||count>65536)return null;const n=size*count,at=n<=4?e+8:t+u32(e+8);check(at,n);
   if(type===2){let str='';for(let i=0;i<count&&view.getUint8(at+i);i++)str+=String.fromCharCode(view.getUint8(at+i));return str.trim();}
   if(type===3)return u16(at);if(type===4)return u32(at);
   if(type===5||type===10){const a=type===5?u32(at):view.getInt32(at,little),b=type===5?u32(at+4):view.getInt32(at+4,little);return b?a/b:null;}return null;
  };
  const tags={0x010f:'make',0x0110:'camera',0x0132:'modifiedAt',0x9003:'takenAt',0x829a:'exposure',0x829d:'aperture',0x8827:'iso',0x920a:'focal',0xa434:'lens',0x0112:'orientation'};
  const seen=new Set();function ifd(offset){if(seen.has(offset))return;seen.add(offset);const at=t+offset,n=Math.min(u16(at),512);check(at+2,n*12);for(let i=0;i<n;i++){const e=at+2+i*12,k=u16(e),v=val(e);if(k===0x8769)sub=v;if(tags[k]&&v!=null&&v!=='')result[tags[k]]=v;}}
  ifd(u32(t+4));if(Number.isInteger(sub)&&sub>0)ifd(sub);
 }
 }catch{/* Malformed or truncated metadata must not prevent image import. */}
 for(const k of ['focal','aperture','exposure','iso','orientation'])if(result[k]!=null&&(!Number.isFinite(result[k])||result[k]<=0))delete result[k];
 for(const k of ['make','camera','lens','modifiedAt','takenAt'])if(result[k]!=null&&(typeof result[k]!=='string'||result[k].length>300))delete result[k];
 if(result.takenAt&&!/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(result.takenAt))delete result.takenAt;
 return result;
}
export function shootingDay(exif){if(!exif.takenAt)return null;const s=exif.takenAt.slice(0,10).replaceAll(':','-');const d=new Date(s+'T12:00:00');return Number.isNaN(+d)||d.toISOString().slice(0,10)!==s?null:s;}
export function formatExif(m={}){const u='未知';return [['拍摄时间',m.takenAt??u],['焦距',m.focal?`${+m.focal.toFixed(1)} mm`:u],['快门',m.exposure?(m.exposure<1?`1/${Math.round(1/m.exposure)} s`:`${+m.exposure.toFixed(2)} s`):u],['光圈',m.aperture?`f/${+m.aperture.toFixed(1)}`:u],['ISO',m.iso??u],['相机',m.camera??u],['镜头',m.lens??u]];}
