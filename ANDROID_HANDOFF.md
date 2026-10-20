# Android R0 交接 · 2026-10-20

用户新增请求：「做成 apk 文件，使用安卓手机存储」。本轮保持原有 R0 功能，仅将本地存储、文件选择与导出适配到 Android。

## 本地版本关系

- 原网页 Site 保持原版本，未修改，依然是浏览器 IndexedDB。
- 安卓包是独立工程，已内置同一套 R0 UI，并覆盖 native.js/db.js 和部分 app.js 文案/调用。
- Android 数据使用 SQLite + 文件，不与网页自动同步；R0 JSON 备份双向兼容。

## 核心约定

- 包名 `cn.xiaohuang.lightjournal`，versionCode 3，versionName 0.1.2，min API 28，target API 35。
- 私人签名保存在本交接包的 signing 目录。后续必须复用，密码不写入日志或公开版本控制。
- `LocalStore.java`：SQLiteOpenHelper + @JavascriptInterface request(action,input)。SQLite records 的三类 store 名为 sessions / photos / settings。
- `NativeStore`：将 photo Blob 逐块编码并发送给 Java；成功后只保存 `previewFile/previewSize`、`thumbFile/thumbSize` 引用。读取照片得到轻量 LocalPhoto，展示直接读取本地 URL，备份才按张读数据。
- JPEG 暂写 .part，完成后 fsync + rename 为 UUID.jpg。先写照片，再一次 SQLite 事务提交元数据。未引用的文件在事务提交后及启动时清理；staged 文件在事务前受保护。
- 图片不能放在 cache：cache 仅用于准备用户导出的 JSON。
- `MainActivity` 在虚拟 HTTPS origin 下拦截 APK assets 与私有照片请求；外部资源/导航拦截，file access=false，Content access=true 仅用于系统选择文件。
- 原生保存 JSON 先分块写临时文件，再 ACTION_CREATE_DOCUMENT；写完所选 URI 后通过 `android-save-finished` 返回成功/取消/失败，前端按结果显示，不提前声称下载成功。
- WebChromeClient.onShowFileChooser 使用 ACTION_OPEN_DOCUMENT；onActivityResult 必须使用 FileSelection.parse，同时收集 ClipData 和 data。不要退回 FileChooserParams.parseResult（会漏掉 ClipData 多选）。取消返回 null 并提示。
- Android 30+ 显式 edge-to-edge 并给根容器应用系统栏/键盘 insets；Android 28–29 使用 fitsSystemWindows。
- Android 返回键：先关弹窗，再回首页，首页返回将应用置后台。暂停时尝试保存 pending 输入。
- 未申请 INTERNET 或广泛存储访问；不应为方便而添加 file:// 或任意 origin 的桥接访问。

## 自动测试

建议 Node 24：

```bash
npm install
npm test
```

测试依赖 happy-dom、sharp，另外使用 Node 内置 node:sqlite。桥接 fixture 使用 SQLite + 实际文件系统；它不是安卓运行时，不能替代设备验证。UI 测试覆盖现有任务/导入/未知 EXIF/分组/比较/标记/复盘/备份/恢复。原网页的 EXIF、任务组合等 11 项测试已在上一轮通过，详见旧项目报告；本轮只对改变的安卓路径进行回归。

## 更新与后续

- 每次修改 Java/内置 UI 都需要重建 APK；网页站点部署不会更新已安装应用。
- 下一版增加 versionCode，使用相同签名覆盖安装，保留 SQLite schema；必要时通过 onUpgrade 显式迁移。
- 若用户反馈安装问题，先记录具体系统安装提示；若是白屏，检查系统 WebView 版本、CSP 和本地资源 MIME。
- 首轮真机优先验证：飞行模式启动、批量 JPG 系统选择、多选取消、备份保存到下载、备份保存取消、恢复、关闭重开、键盘和底部导航遮挡。
- 没有真机/模拟器连接，不得声称已完成真机验收。

## 0.1.2 修复交接

用户反馈：APK 导入照片无反应、查不到导入内容、无法对比。
根因定位：旧 onActivityResult 直接调用 WebView FileChooserParams.parseResult，只读 data 的实现会遗漏 ClipData。修正为 FileSelection.java，加入结果提示；未扩大存储权限。

前端导入成功后强制打开全部照片、清除旧筛选。settings/last-import 保存 {at,ids,errors} 供查询最近一批；仅此设备导入记录，不随备份恢复（原备份只恢复 appearance 设置）。photos 页面显示文件名和搜索框。手机 compareSide='both' 为默认，保留 A/B 单张视图。

本轮验证：5 项 Node SQLite/磁盘 + DOM 回归全部通过，另 10 项 Java 选图解析契约检查通过；APK 编译、v3 签名、zipalign、包名版本检查通过。证书摘要与 0.1.1 完全相同，数据库仍为 schema 1。未连接安卓真机/模拟器，不声称真机验收完成。

下一步先收集这次覆盖安装后的真实手机反馈；无需卸载、无需改网页 Site，不要改包名/签名/SQLite schema。源码包保留 signing 供覆盖升级，勿公开上传。

## 0.1.3 + PC 开发预览交接（当前权威状态）

用户在手机反馈首页过长、底栏被遮挡、参数不便对比，要求预留 AI 评价接口；后在 PC 要求拿到源码并使用 VS Code 预览。

已完成：原生 MainActivity 采用 WebView 高度 0 + weight=1，原生 64dp 四项底栏固定在 WebView 外，系统栏/键盘 insets 留在根布局。网页原生模式隐藏 sidebar，前端 render 的 setNavigation 同步高亮与主题；android-navigation 从原生回传。不要退回 MATCH_PARENT WebView 挤占底栏。

首页收紧，参数表为同框 3 列（参数/A/B）、7 行，已知差异高亮。AI 的 ai.js/AiEvaluationService.java 为真实可调用的未配置接口，无网络权限、无评价输出；详细协议见 AI_INTEGRATION.md。

新增 BrowserStore/Store 门面，存在 AndroidStorage 时仍用 NativeStore；普通浏览器用 IndexedDB。新增无依赖 Node 预览服务、设备尺寸页、保存后刷新和 VS Code F5 配置。PC 与 APK 不自动同步，通过 JSON 备份迁移。

最新版本 versionCode 4/versionName 0.1.3，包名和签名不变，schema 1 不变。12 项 Node 测试、10 项 Java 选图检查、API35 编译/D8/签名/对齐通过；未进行浏览器截图和安卓真机验收。以 README.md 为启动入口。文件包内 signing 请本人保留，不要公开提交。
