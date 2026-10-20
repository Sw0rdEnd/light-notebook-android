package cn.xiaohuang.lightjournal;

import org.json.JSONArray;
import org.json.JSONObject;

/** Future provider integration point. No network transport is configured in this release. */
final class AiEvaluationService {
    static JSONObject evaluate(JSONObject request) throws Exception {
        if(!"light-journal.ai-evaluation.v1".equals(request.optString("schema")))throw new IllegalArgumentException("AI 评价请求版本无效");
        JSONArray photos=request.optJSONArray("photos");
        if(photos==null||photos.length()<1||photos.length()>2)throw new IllegalArgumentException("AI 评价需要 1 至 2 张照片");
        return new JSONObject().put("schema","light-journal.ai-result.v1").put("requestId",request.getString("requestId")).put("status","not_configured").put("code","AI_NOT_CONFIGURED").put("message","AI 评价服务尚未接入，照片没有发送。");
    }
}
