package cn.xiaohuang.lightjournal;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Locale;

/** Local intent expansion; no additional model call, inferred facts or credential access. */
final class AiPrompt {
    private static final String[][] FOCUSES={
        {"构图与主体","构图","主体","背景","机位","视角","composition"},
        {"光线与曝光","光线","曝光","逆光","暗","亮","快门","光圈","iso","exposure"},
        {"清晰度与拍摄稳定性","清晰","对焦","失焦","模糊","抖","focus"},
        {"色彩与氛围","色彩","颜色","白平衡","氛围","color"},
        {"后期与裁切","后期","调色","裁切","剪裁","修图","后製"},
        {"双图取舍","选片","对比","比较","取舍","哪张"}
    };
    static JSONObject brief(String note,boolean compare) throws Exception {
        String question=AiProtocol.text(note,1000).replaceAll("[\\x00-\\x1f\\x7f]+"," ").replaceAll("[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+"," ").trim(),lower=question.toLowerCase(Locale.ROOT);
        JSONArray focus=new JSONArray();boolean selection=false,editing=false;
        for(String[] rule:FOCUSES)for(int i=1;i<rule.length;i++)if(lower.contains(rule[i])){focus.put(rule[0]);selection|="双图取舍".equals(rule[0]);editing|="后期与裁切".equals(rule[0]);break;}
        if(focus.length()==0)focus.put("构图与主体").put("光线与曝光").put("色彩与氛围");
        if(compare&&!selection)focus.put("双图取舍");
        JSONArray steps=new JSONArray().put("先回答原问题，引用相关画面证据，不预设用户提到的问题一定存在。")
            .put("按优先级给出2–3项改进，每项说明怎么做，以及预期画面变化。")
            .put("给出1项下次可实拍验证的练习，缺失参数不虚构。");
        if(editing)steps.put("分别说明现场重拍与后期可改善的范围，不编造精确调色数值。");
        return new JSONObject().put("schema","light-journal.ai-brief.v1").put("question",question)
            .put("goal",compare?"结合原问题逐项比较A/B，说明取舍理由。":"结合原问题分析这张照片，给出具体拍摄改进建议。")
            .put("focus",focus).put("steps",steps);
    }
}
