# AI 评价扩展约定 · v1（Android 0.2.8 / 服务器预备版）

0.2.8修复点评启动兼容问题：ai-task.js不依赖AbortSignal.any/timeout，异常直接在弹窗显示并释放任务。入口为「开始AI点评」，确认页勾选后启用「确认发送并分析」；等待反馈、错误码和用户原问题草稿保留。

ai-prompt.js在确认页预览本机整理的点评目标/关注方向/分析步骤；修改问题即时更新。AiPrompt.java根据原note和实际图片数重新生成reviewBrief，放入真实图片请求的文本块，同时保留question。整理不额外调用模型，不改写原意或把关键词当画面事实；输出结构与证据规则仍由系统提示约束。9组共享样例验证JS/Java的意图整理。服务器HTTP模板未修改；细节与实际边界见[AI_TRIGGER_ACCEPTANCE.md](AI_TRIGGER_ACCEPTANCE.md)。

Android 0.2.7新增个人密钥直连 DeepSeek，当前0.2.8原签名APK已构建，尚未使用真实密钥或安卓设备验收。原已发布0.2.2 Site没有更新；服务器预备版仍独立使用环境密钥、账户/口令和配额。两条路径都要求用户确认上传，不在浏览或导入时自动分析。

## Android 0.2.7 原生直连

- 设置 → AI 点评设置：保存并测试个人密钥。`AndroidAi.status()`只返回配置状态；`AndroidAi.request(id,action,json)`支持 configure / forget / test / evaluate，结果经 android-ai-result 事件异步返回。`cancel(id)`取消本地等待并尽力断开连接，已发送请求仍可能计费。
- `AiCredentials`使用 Android Keystore AES-256-GCM 和 AtomicFile，把加密值放在 getNoBackupFilesDir；密钥不回显、不进入 SQLite、WebView 持久存储、备份 JSON 或日志。清空全部本地数据同时移除密钥，导入备份不创建密钥。
- `test`只调用官方 GET /models，验证固定 deepseek-flash 的可用性；上游若返回 input_modalities，也验证包含 image。该检查不上传照片，不能证明余额充足或真实图片分析成功。
- `evaluate`要求单次 consent=true、1–2个安全照片 ID、A/B顺序及模式一致。原生重新读取保存的记录和复盘副本，最长边压到1600、重新编码 JPEG 并移除图片 EXIF，单图最多2MiB。只传画面、相关白名单拍摄参数、独立用户设备修正、问题与受限练习上下文，不发送 GPS、原文件名、路径或照片 ID。
- `DeepSeekClient`固定 https://api.deepseek.com，不允许页面指定上游、图片外链或重定向；Bearer密钥只在请求头。图片以真实 image_url / JPEG data URL 传入 deepseek-flash，thinking disabled、JSON输出、max_tokens1800。输出经完成状态、结构、证据类别和字数验证，丢弃额外字段并转义显示；实际返回的 usage 才显示，未知不补造。
- 网络在独立工作线程，单次任务65秒总期限、响应上限512KiB，无自动付费重试。密钥失效、余额、模型、限流、网络、超时和不完整输出有明确错误；取消后的晚到结果不能保存或重开弹窗。
- 结果写入照片 aiReview，保存前重读记录保留并发编辑。写入失败保留结果供「重试保存结果」，只重试本地保存。普通 v2 备份包含已保存点评，**不包含密钥**。
- 兼容包名、原签名、SQLite user_version2和备份版本2。新增 INTERNET，cleartext=false；WebView仍只加载受限本地资源，外部来源链接由系统浏览器打开，没有放开任意 origin 或网页 fetch 权限。

实现验证和手机步骤见 [AI_NATIVE_ACCEPTANCE.md](AI_NATIVE_ACCEPTANCE.md)。官方协议参考：[Vision](https://api-docs.deepseek.com/guides/vision/)、[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[Models](https://api-docs.deepseek.com/api/list-models/)、[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)、[Android Keystore](https://developer.android.com/privacy-and-security/keystore)，2026-10-24核对。

## 已实现的调用路径

1. 照片详情/双图比较 → 开始AI点评（`ai-review`事件）→ 确认页；原生页面可查看本机整理后的要求。
2. 用户填写问题并主动发起，`ai.js` 的 `buildEvaluationRequest(photos,{session,note,catalog})` 生成 1–2 张照片的请求；浏览和导入不发起评价。
3. `requestEvaluation(request,{provider})`：
   - 显式传入 provider 时调用 `provider.evaluate(request)`，用于后续提供商适配。
   - APK UI 经单次上传确认显式选择 native provider，`ai-native.js`仅将选定 ID / A或B标签 / 问题 / 上下文交给 `AndroidAi`；Java自行解析真实本地照片及参数。旧同步 `AndroidStorage.aiEvaluate` 仅返回未配置说明，避免同步数据库桥接阻塞网络或绕过确认。
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
上例是本地契约，不能直接当网络上传包。原生 provider 通过 ID 解析本机 JPEG 并构建白名单传输；浏览器 HTTP provider 则从本地 Store 编码副本。远端不接收本地文件引用，不自动上传原图。

## 未配置返回（默认接口或旧同步桥接）

```json
{
  "schema": "light-journal.ai-result.v1",
  "requestId": "与请求一致",
  "status": "not_configured",
  "code": "AI_NOT_CONFIGURED",
  "message": "AI 评价服务尚未接入，照片没有发送。"
}
```

## 成功返回（结构示例，文字不是实测评价）

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

## 真实服务待验证

- 服务器网页版已实现以下适配，但真实服务器、域名HTTPS、DeepSeek账户模型权限/余额及真实图片分析尚未联调，不自动重试付费请求。
- APK0.2.7已加入原生 HTTPS 及 INTERNET 并重建，真实 Android Keystore、系统网络、付费图片响应、覆盖安装和键盘仍需手机验收。
- 不把开发者或服务端 API Key 硬编码进前端、APK 或版本库；用户个人密钥只在手机设置输入并加密保管，不在聊天提供。
- 正式Site仍没有更新；Android和服务器结果界面已实现，分别等待真实服务验证。

回归测试中的示例 provider 只验证接口契约，不是可用的在线评价服务。

## 2026-10-21服务器实现

以下是服务器实现历史，关于「APK未联网」的描述指当时版本；当前以顶部 Android 0.2.7 为准。

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

账户、云备份、管理界面和初始化/运维见ADMIN_SYSTEM.md；这些服务器功能没有接入APK，原生个人密钥分析不依赖它们。真实服务仍待分别联调。
