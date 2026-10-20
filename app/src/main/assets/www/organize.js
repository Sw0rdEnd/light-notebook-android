// Versioned metadata, independent of the browser/native photo binary storage.
export const STORES = ['sessions','photos','settings','groups','memberships','imports','equipment','kits','catalog'];
export const DATA_VERSION = 2;
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
export const membershipId = (groupId, photoId) => `${groupId}_${photoId}`;
export async function migrateData(store) {
  const version = await store.get('settings','data-version');
  if ((version?.value || 1) > DATA_VERSION) throw new Error('本地数据来自更新版本，请升级应用后打开。');
  if (version?.value === DATA_VERSION) return;
  const [sessions, photos] = await Promise.all([store.all('sessions'),store.all('photos')]);
  const groups = [], memberships = [];
  for (const session of sessions) {
    const linked = photos.filter(p => p.sessionId === session.id);
    if (!linked.length) continue;
    const group = {id:`legacy-${session.id}`,name:`${session.day} · ${session.summary?.slice(0,30) || '摄影练习'}`,description:'从旧版所属练习迁移，原练习关联保留。',sessionId:session.id,coverPhotoId:linked[0].id,order:groups.length,createdAt:session.createdAt,demo:!!session.demo};
    groups.push(group);
    for (const p of linked) memberships.push({id:membershipId(group.id,p.id),groupId:group.id,photoId:p.id});
  }
  const last = await store.get('settings','last-import');
  await store.merge({groups,memberships,photos:photos.map(p=>({...p,cull:p.cull || (p.liked?'keep':'undecided'),tags:p.tags||[],corrections:p.corrections||{}})),imports:last?.value?[{id:'legacy-last-import',...last.value,duplicates:[]}]:[],settings:[{id:'data-version',value:DATA_VERSION}]});
}
export async function saveGroup(store, input, existing = null) {
  const name = String(input.name || '').trim().slice(0,80);
  if (!name) throw new Error('请填写分组名称。');
  const groups = await store.all('groups');
  const group = {...existing,id:existing?.id||uid(),name,description:String(input.description||'').slice(0,500),coverPhotoId:input.coverPhotoId||null,order:existing?.order??(Math.max(-1,...groups.map(g=>g.order||0))+1),createdAt:existing?.createdAt||now(),updatedAt:now(),sessionId:input.sessionId??existing?.sessionId??null};
  if (group.coverPhotoId) {
    const links = await store.all('memberships');
    if (!links.some(m=>m.groupId===group.id&&m.photoId===group.coverPhotoId)) throw new Error('请从分组内选择封面照片。');
  }
  await store.put('groups',group); return group;
}
export async function assignPhotos(store, photoIds, target, {moveFrom=null,remove=false}={}) {
  if (!(await store.get('groups',target))) throw new Error('分组已不存在，请刷新后重试。');
  const photos = await store.all('photos'), ids = [...new Set(photoIds)].filter(id=>photos.some(p=>p.id===id));
  const memberships = remove?[]:ids.map(photoId=>({id:membershipId(target,photoId),groupId:target,photoId}));
  const deletions = {memberships:ids.flatMap(pid=>[...(remove?[membershipId(target,pid)]:[]),...(moveFrom&&moveFrom!==target?[membershipId(moveFrom,pid)]:[])])};
  const groups = (await store.all('groups')).filter(g=>(remove&&g.id===target||moveFrom&&g.id===moveFrom&&moveFrom!==target)&&ids.includes(g.coverPhotoId)).map(g=>({...g,coverPhotoId:null}));
  await store.merge({memberships,groups,deletions});
}
export async function deleteGroup(store, groupId) {
  const links = await store.all('memberships');
  await store.merge({deletions:{groups:[groupId],memberships:links.filter(m=>m.groupId===groupId).map(m=>m.id)}});
}
export async function deletePhotos(store, ids) {
  const [links,groups] = await Promise.all([store.all('memberships'),store.all('groups')]);
  await store.merge({groups:groups.filter(g=>ids.includes(g.coverPhotoId)).map(g=>({...g,coverPhotoId:null})),deletions:{photos:ids,memberships:links.filter(m=>ids.includes(m.photoId)).map(m=>m.id)}});
}
export function groupStats(group,photos,links) {
  const ids = new Set(links.filter(m=>m.groupId===group.id).map(m=>m.photoId));
  const members = photos.filter(p=>ids.has(p.id));
  const days = members.map(p=>p.day).filter(Boolean).sort();
  return {photos:members,count:members.length,pending:members.filter(p=>!p.reviewedAt).length,from:days[0]||null,to:days.at(-1)||null};
}
