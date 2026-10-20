// Adapt newly-created task snapshots only. Historical tasks remain as recorded.
export function adaptTasks(tasks,equipment) {
  const out=tasks.map(t=>({...t})),lens=equipment?.lens,phone=equipment?.body?.type==='phone';
  const known=lens?.focal&&lens.maxAperture&&['native','crop'].includes(equipment?.check?.kind);
  const low=known?lens.focal[0]:null,high=known?lens.focal[1]:null,prime=low===high;
  const aperture=known?Math.max(8,...lens.maxAperture):null;
  for(const task of out){
    if(!known)task.start=phone?'手机先用默认拍照模式；光圈不可调时通过光线、机位和曝光补偿比较，不要求模拟单反参数。':'先选设备支持的自动曝光；光圈、焦距未核实前不指定数值，注意快门、光线和主体运动。';
    else task.start=task.start.replace(/f\/5\.6(?:–8)?/g,`f/${aperture}`).replace(/50mm|24–35mm/g,`${Math.min(high,Math.max(low,50))}mm`);
    if(task.id.includes('-focal-0')){
      task.action=known&&!prime?`对同一主体保持机位不变，用实际焦距 ${[...new Set([low,Math.min(high,Math.max(low,50)),high])].join('、')}mm 拍同一方向，比较取景范围。等效焦距只描述视角，不改变实际焦距。`:known?`这支镜头为 ${low}mm 定焦。对同一主体在安全范围内改变距离，比较画面元素和背景关系，不要求变焦。`:'选同一主体，在设备支持的镜头或倍率间比较取景范围；只有一个焦段时改变安全距离。手机数字倍率不一定是光学焦段。';
    }
    if(task.id.includes('-focal-1'))task.action=known&&!prime?`用实际焦距 ${low}mm 拍一张，再换 ${high}mm 并安全后退，让主体大小接近，比较背景关系。透视改变来自机位移动。`:'同一焦段，尝试两个安全机位，比较背景、前后层次和主体大小。';
    if(task.id.includes('-exposure-2')){task.title=phone?'同一主体，比较曝光补偿':'同一焦段，不同光圈';task.action=known?`固定实际焦距 ${Math.min(high,Math.max(low,50))}mm、机位和主体，分别用 f/${aperture} 与 f/${Math.round(aperture*1.4)} 拍摄；通过快门或 ISO 维持主体亮度接近，再比较景深。`:phone?'保持机位与主体，用手机支持的曝光补偿拍两张，比较重要亮部与暗部。':'固定焦段与机位；设备支持可调光圈时选择两个实际可用光圈，维持亮度接近比较景深；不可调时改为曝光补偿对比。';}
  }
  return out;
}
