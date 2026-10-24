// Local review brief. Keep in sync with AiPrompt.java; shared fixtures cover both.
const focuses=[
 ['构图与主体',['构图','主体','背景','机位','视角','composition']],
 ['光线与曝光',['光线','曝光','逆光','暗','亮','快门','光圈','iso','exposure']],
 ['清晰度与拍摄稳定性',['清晰','对焦','失焦','模糊','抖','focus']],
 ['色彩与氛围',['色彩','颜色','白平衡','氛围','color']],
 ['后期与裁切',['后期','调色','裁切','剪裁','修图','后製']],
 ['双图取舍',['选片','对比','比较','取舍','哪张']]
];
export function createReviewBrief(note='',mode='single'){
 const question=String(note??'').slice(0,1000).replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim(),lower=question.toLowerCase();
 const focus=focuses.filter(([,words])=>words.some(word=>lower.includes(word))).map(([label])=>label);
 if(!focus.length)focus.push('构图与主体','光线与曝光','色彩与氛围');
 if(mode==='compare'&&!focus.includes('双图取舍'))focus.push('双图取舍');
 const steps=['先回答原问题，引用相关画面证据，不预设用户提到的问题一定存在。','按优先级给出2–3项改进，每项说明怎么做，以及预期画面变化。','给出1项下次可实拍验证的练习，缺失参数不虚构。'];
 if(focus.includes('后期与裁切'))steps.push('分别说明现场重拍与后期可改善的范围，不编造精确调色数值。');
 return {schema:'light-journal.ai-brief.v1',question,goal:mode==='compare'?'结合原问题逐项比较A/B，说明取舍理由。':'结合原问题分析这张照片，给出具体拍摄改进建议。',focus,steps};
}
