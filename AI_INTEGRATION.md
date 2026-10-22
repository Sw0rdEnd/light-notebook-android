# AI 评价扩展约定 · v1（含服务器预备实现）

当前已发布的0.2.2 Site和APK仍只预留接口。2026-10-21的本地服务器预备版新增server/及ai-http.js/ai-ui.js：配置完成后，用户确认上传才将选定副本提交DeepSeek。未配置时明确返回尚未启用；真实密钥调用尚未验收。

## 已实现的调用路径

1. 照片详情/双图比较 → `ai-review` 事件。
2. 用户填写问题并主动发起，`ai.js` 的 `buildEvaluationRequest(photos,{session,note,catalog})` 生成 1–2 张照片的请求；浏览和导入不发起评价。
3. `requestEvaluation(request,{provider})`：
   - 显式传入 provider 时调用 `provider.evaluate(request)`，用于后续提供商适配。
   - APK 默认调用 `AndroidStorage.request('aiEvaluate', JSON.stringify({request}))` → `LocalStore` → `AiEvaluationService.evaluate`。
   - 浏览器默认直接返回同样的 not_configured 结果。
4. `validateEvaluationResult` 验证 schema、请求 ID、状态、观察结论与下一步建议等字段。

## 请求

```json
{
  "schema": "light-journal.ai-evaluation.v1",
  "requestId": "UUID",
  "createdAt": "ISO-8601",
  "mode": "single 或 compare",
  "equipment": null,
  "evidenceRules": {
    "exif": "原始文件元数据，不据此断言照片好坏",
    "corrections": "用户修正，与EXIF分开",
    "observation": "可从画面观察的事实",
    "inference": "模型推测必须明确标注"
  },
  "learningContext": {"theme": "focal", "scene": "street", "tasks": [], "summary": ""},
  "note": "用户补充，可空",
  "photos": [{
    "id": "PHOTO_ID",
    "label": "A",
    "filename": "DSC00001.jpg",
    "width": 6000,
    "height": 4000,
    "exif": {"focal": 35, "aperture": 5.6, "iso": 100, "exposure": 0.004},
    "equipment": {"body": null, "lens": null},
    "corrections": {},
    "reviewNote": "用户保存的复盘，可空",
    "localPreview": {"available": true, "file": "UUID.jpg", "mime": "image/jpeg"},
    "userMarks": {"liked": false, "improve": false, "star": false, "cull": "undecided", "tags": [], "reasons": []}
  }]
}
```

顶层`equipment`为练习创建时保存的设备组合快照，没有关联练习时为null；不能用默认设备冒充照片的拍摄设备。逐图`equipment`为资料库匹配或用户选择的机身/镜头记录，识别不出时为null；`corrections`独立保存用户修正和设备快照，`exif`保留原始内容。`note`是本次用户问题，`reviewNote`是先前复盘。

`learningContext`可为null。`localPreview.file`是**设备本地引用**，不是远程服务可读取的URL；浏览器中可能为null，而照片Blob仍可用。
将来 provider 需要通过照片 ID 在本地 Store 中解析 preview 数据、组织实际传输；不要把本地文件名直接交给远端让其猜测，也不要自动上传原图。

## 未接入返回（当前真实行为）

```json
{
  "schema": "light-journal.ai-result.v1",
  "requestId": "与请求一致",
  "status": "not_configured",
  "code": "AI_NOT_CONFIGURED",
  "message": "AI 评价服务尚未接入，照片没有发送。"
}
```

## 成功返回（仅接口示例，本版不产生）

```json
{
  "schema": "light-journal.ai-result.v1",
  "requestId": "与请求一致",
  "status": "ok",
  "summary": "对照片取舍的简短说明",
  "observations": [
    {"aspect": "composition", "basis": "observation", "text": "具体画面观察及对应照片标签"},
    {"aspect": "exposure", "basis": "exif", "text": "明确引用原始曝光参数，不单凭参数判定好坏"},
    {"aspect": "intent", "basis": "inference", "text": "可能的拍摄意图，明确属于推测"}
  ],
  "nextSteps": ["下一次可以现场完成的一项建议"],
  "preferred": "A"
}
```

`preferred`可为A、B、tie或null；单张评价使用null。`basis`只接受observation、exif和inference；旧provider未填写时降为inference，非法类别拒绝。请求ID/schema不符、结构错误会被拒绝。后续结果界面必须显示证据类别并转义文字，不能将第三方HTML插入页面。

## 后续接入待验证

- 服务器网页版已实现以下适配，但真实服务器、域名HTTPS、DeepSeek账户模型权限/余额及真实图片分析尚未联调，不自动重试付费请求。
- APK当前无网络权限，若要原生联网需另行加入INTERNET权限和对应传输路径、隐私说明，并用原签名重新构建。
- 不把服务端 API Key 写进前端、APK 或版本库。
- 当前正式Site和APK没有AI结果界面更新；服务器预备版已保存到对应照片，真实服务验证通过后才部署上线。

回归测试中的示例 provider 只验证接口契约，不是可用的在线评价服务。

## 2026-10-21服务器实现

- 原buildEvaluationRequest/provider/validateEvaluationResult契约保留；默认requestEvaluation仍不自动联网。新网页UI先访问同源GET /api/ai/status，启用后经访问口令与上传同意，显式选择HTTP provider。
- POST /api/ai/evaluate使用light-journal.ai-upload.v1协议，实际传输1–2个JPEG data URL；过滤GPS、原文件名与本地路径，只发送相关参数、修正、问题与练习上下文。
- 服务端固定调用https://api.deepseek.com/chat/completions，默认deepseek-flash、thinking.type=disabled、response_format=json_object，按官方Vision/JSON Output协议传真实image_url块。客户端不能指定上游URL，服务端不抓取客户端外部图片URL。
- 模型返回经请求ID、schema、结构和证据类别检查后，转义显示并保存在照片aiReview字段，重新查看不再调用。备份包含该普通元数据字段，旧版本UI不显示AI结果。
- 独立共享AI访问口令在当前页面内存中使用，不写入照片、备份或浏览器持久存储；DeepSeek API Key只在服务器环境中。默认AI关闭、日50次/分钟6次/并发2；台账持久化，失败尝试也计入保守次数。
- 未申请APK联网权限，因此APK仍走尚未接入提示；本次不要将其描述为原生AI上线。
- 完整操作、限制与部署见SERVER_DEPLOYMENT.md；本轮模拟接口/网页测试与真实付费服务验证分别记录。

## 2026-10-22后台与账户扩展

服务器0.4.0新增账户Cookie+CSRF方式调用AI；登录状态从同源status接口获取，单次上传同意仍保留。个人与全站次数同时限制，停用/撤销权限后不能继续新请求。旧共享口令可由管理员显式启用，归为无个人归属的共享调用。

提供商返回usage在解析模型结果前记录，输入/输出/缓存token分开保存；超时等没有完整usage时标为未知，不能据此推断未计费。元数据升级保留旧调用记录；token字段未知的旧记录不补造数值。

账户、云备份、管理界面和初始化/运维见ADMIN_SYSTEM.md；当前正式Site和APK仍未更新，真实服务待联调。
