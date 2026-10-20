# AI 评价扩展约定 · v1

本版只预留接口。真实生产路径没有服务端、网络传输、API Key 或模型调用；照片不离开设备。

## 已实现的调用路径

1. 照片详情/双图比较 → `ai-review` 事件。
2. `ai.js` 的 `buildEvaluationRequest(photos,{session,note})` 生成 1–2 张照片的请求。
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
  "equipment": {"camera": "Sony A7C II", "lens": "Sigma 20–200mm"},
  "learningContext": {"theme": "focal", "scene": "street", "tasks": [], "summary": ""},
  "note": "用户补充，可空",
  "photos": [{
    "id": "PHOTO_ID",
    "label": "A",
    "filename": "DSC00001.jpg",
    "width": 6000,
    "height": 4000,
    "exif": {"focal": 35, "aperture": 5.6, "iso": 100, "exposure": 0.004},
    "localPreview": {"available": true, "file": "UUID.jpg", "mime": "image/jpeg"},
    "userMarks": {"liked": false, "improve": false, "star": false, "reasons": []}
  }]
}
```

`learningContext` 可为 null。`localPreview.file` 是**设备本地引用**，不是远程服务可读取的 URL；浏览器中可能为 null，而照片 Blob 仍可用。
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
    {"aspect": "composition", "text": "具体观察及对应照片标签"},
    {"aspect": "light", "text": "光线的具体观察"}
  ],
  "nextSteps": ["下一次可以现场完成的一项建议"],
  "preferred": "A"
}
```

`preferred` 可为 A、B、tie 或 null；单张评价使用 null。请求 ID/schema 不符、结构错误会被拒绝。结果渲染需要转义普通文字，不能将第三方 HTML 插入页面。

## 下一轮接入要补齐

- 选择实际服务并实现 provider 的二进制图片传输、超时/取消/重试与错误提示。
- APK 当前无网络权限，若要真实联网需在实现时加入 INTERNET 权限并提供对应传输路径；只修改 endpoint 字符串不会让本版联网。
- 不把服务端 API Key 写进前端、APK 或版本库。
- 将 ok 结果保存和展示在对应照片/练习中。本版只有未接入结果的 UI，不宣称完整 AI 功能已完成。

回归测试中的示例 provider 只验证接口契约，不是可用的在线评价服务。
