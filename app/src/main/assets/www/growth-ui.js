const MIN_SAMPLE=3;

export function renderGrowthPage({st,rec,themes,btn,icon,esc,cell}) {
  const chartSpecs=[
    {key:'themes',title:'练习主题',rows:st.themes,count:st.count,unit:'次',pending:`再完成 ${Math.max(0,MIN_SAMPLE-st.count)} 次复盘后显示。`,note:'统计已保存复盘的真实练习。'},
    {key:'focal',title:'常用焦段',rows:st.focal,count:st.known,unit:'张',pending:`再积累 ${Math.max(0,MIN_SAMPLE-st.known)} 张含焦距信息的照片后显示。`,note:st.photoCount>st.known?`${st.photoCount-st.known} 张焦距未知，未计入分布。`:'按照片中的实际焦距统计。'},
    {key:'liked',title:'喜欢照片的焦段',rows:st.liked,count:st.likedKnown,unit:'张',pending:`再标记 ${Math.max(0,MIN_SAMPLE-st.likedKnown)} 张含焦距信息的喜欢照片后显示。`,note:'统计已标记喜欢、且有焦距信息的照片。'}
  ];
  const chart=spec=>{
    if(spec.count<MIN_SAMPLE)return `<article class="growth-chart-card growth-chart-pending" data-chart="${spec.key}"><div class="growth-chart-heading"><h3>${spec.title}</h3><span>积累中 · ${spec.count}/${MIN_SAMPLE}</span></div><p>${spec.pending}</p></article>`;
    const entries=Object.entries(spec.rows).sort((a,b)=>b[1]-a[1]),max=Math.max(...entries.map(([,value])=>value),1);
    return `<article class="growth-chart-card" data-chart="${spec.key}"><div class="growth-chart-heading"><h3>${spec.title}</h3><span>${spec.count} ${spec.unit}</span></div><div class="growth-bars">${entries.map(([key,value])=>`<div class="growth-bar-row"><span>${esc(themes[key]?.[0]||key)}</span><div class="growth-bar-track" aria-hidden="true"><span style="width:${value/max*100}%"></span></div><span class="growth-bar-value">${value}<small>${spec.unit}</small></span></div>`).join('')}</div><p class="growth-chart-note">${spec.note}</p></article>`;
  };
  const ready=chartSpecs.some(spec=>spec.count>=MIN_SAMPLE);
  return `<section class="growth-page">
    <header class="growth-heading"><h1>成长记录</h1><p>每一次复盘，都让下一次更有方向。</p></header>
    <dl class="growth-metrics" aria-label="真实记录概览">${[['sessions',st.count,'已复盘','次','notebook-pen'],['photos',st.photoCount,'复盘照片','张','images'],['stars',st.stars.length,'代表作','张','star']].map(([key,count,label,unit,symbol])=>`<div class="growth-metric" data-metric="${key}"><dt>${icon(symbol)}${label}</dt><dd><strong>${count}</strong><span>${unit}</span></dd></div>`).join('')}</dl>
    <section class="growth-recommend" aria-label="下一次练习"><div class="growth-recommend-heading"><h2>下次试试：${esc(themes[rec.theme][0])}</h2>${btn('去练习'+icon('arrow-up-right'),'recommended','primary',`data-theme="${esc(rec.theme)}"`)}</div><p>${esc(rec.text)}</p></section>
    <section class="growth-distribution" aria-labelledby="growth-distribution-title"><div class="growth-section-heading"><h2 id="growth-distribution-title">练习分布</h2><span>仅统计真实记录</span></div>${ready?`<div class="growth-chart-grid">${chartSpecs.map(chart).join('')}</div>`:`<div class="growth-insight-empty">${icon('chart-no-axes-column')}<div><h3>让记录慢慢积累</h3><p>再完成 ${MIN_SAMPLE-st.count} 次复盘，就能看到练习主题分布。</p><div class="growth-progress" role="progressbar" aria-label="练习主题统计所需复盘" aria-valuemin="0" aria-valuemax="${MIN_SAMPLE}" aria-valuenow="${st.count}"><div aria-hidden="true">${Array.from({length:MIN_SAMPLE},(_,i)=>`<span class="${i<st.count?'done':''}"></span>`).join('')}</div><span>已复盘 ${st.count} / ${MIN_SAMPLE} 次</span></div><small>焦段统计需至少 ${MIN_SAMPLE} 张含焦距信息的照片。</small></div></div>`}</section>
    <section class="growth-stars" aria-labelledby="growth-stars-title"><div class="growth-section-heading"><h2 id="growth-stars-title">代表作</h2>${st.stars.length?btn('查看全部'+icon('arrow-up-right'),'stars','ghost'):'<span>留给未来的对照</span>'}</div>${st.stars.length?`<div class="photo-grid">${st.stars.slice().sort((a,b)=>(a.day||a.importedAt).localeCompare(b.day||b.importedAt)).map(cell).join('')}</div><p class="growth-gallery-note">按拍摄日期从早到晚排列，点击查看照片与复盘。</p>`:`<div class="growth-star-empty">${icon('bookmark')}<div><h3>留一张值得回看的照片</h3><p>在照片详情中标记为代表作。</p></div>${btn('去挑选','nav','ghost','data-tab="photos"')}</div>`}</section>
    <details class="growth-data-note"><summary>统计口径</summary><p>演示内容不计入成长记录。练习主题需至少 ${MIN_SAMPLE} 次已保存复盘的真实练习；焦段分布需至少 ${MIN_SAMPLE} 张含实际焦距的真实照片；喜欢照片的焦段需至少 ${MIN_SAMPLE} 张满足同样条件且标记为喜欢的照片。未知焦距不会推测补齐，分布只描述练习与拍摄习惯。</p></details>
  </section>`;
}
