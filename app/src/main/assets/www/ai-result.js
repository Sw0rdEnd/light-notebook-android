export function reviewResultHTML(result,esc){
 const basis={observation:'画面观察',exif:'拍摄参数',inference:'推测'};
 return `<p class="note">${esc(result.summary)}</p>${result.preferred?`<p style="margin-top:12px"><strong>选片建议：${result.preferred==='tie'?'两张各有所长':esc(result.preferred)}</strong></p>`:''}<div class="stack" style="margin-top:20px">${result.observations.map(o=>`<article class="panel"><span class="badge">${basis[o.basis]||'推测'}</span><h3>${esc(o.aspect)}</h3><p>${esc(o.text)}</p></article>`).join('')}</div><h3 style="margin-top:20px">下次可以试试</h3><ul>${result.nextSteps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>${Number.isSafeInteger(result.usage?.total_tokens)?`<p class="small muted">服务返回用量：${result.usage.total_tokens} tokens</p>`:''}`;
}
