# AI 评价扩展约定 · v1

本版只预留接口。真实生产路径没有服务端、网络传输、API Key 或模型调用；照片不离开设备。

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

## 下一轮接入要补齐

- 选择实际服务并实现 provider 的二进制图片传输、超时/取消/重试与错误提示。
- APK 当前无网络权限，若要真实联网需在实现时加入 INTERNET 权限并提供对应传输路径；只修改 endpoint 字符串不会让本版联网。
- 不把服务端 API Key 写进前端、APK 或版本库。
- 将 ok 结果保存和展示在对应照片/练习中。本版只有未接入结果的 UI，不宣称完整 AI 功能已完成。

回归测试中的示例 provider 只验证接口契约，不是可用的在线评价服务。
