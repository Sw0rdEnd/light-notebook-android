# 光影练习册 · 0.2.5（保存整理后关闭弹窗，待合并验收）

**后台与账户0.4.0已同步到GitHub任务分支** `feat/admin-console-20261022`（待合并）：访问`/admin/`管理用户、API token用量、额度和云空间；用户在`/account/`使用个人云备份，邮箱登录保留为待启用。管理员初始化和边界见[ADMIN_SYSTEM.md](ADMIN_SYSTEM.md)。用户补装ChatGPT Codex Connector后写入已恢复；电脑直接获取此远端分支，避免重复应用旧补丁。

**服务器部署准备已同步到同一任务分支**：Node24 + Caddy + Docker Compose，支持配置DeepSeek单图/双图分析。入口见[SERVER_DEPLOYMENT.md](SERVER_DEPLOYMENT.md)和[验收边界](SERVER_PREP_ACCEPTANCE.md)。真实服务器与密钥尚未提供；此次源码同步没有更新已发布摄影Site或APK。另有[后台交互预览](https://light-notebook-admin-preview.clever-ocean-1537.chatgpt.site)，仅所有者可访问，全部使用浏览器演示数据，正式后台待服务器部署。

在原有 Android 工程上增量升级的摄影训练、照片整理与作品复盘应用。电脑预览与 APK 共用前端；手机和电脑的数据各自保存在本机，暂不自动共享，使用备份迁移。

代码仓库：[Sw0rdEnd/light-notebook-android](https://github.com/Sw0rdEnd/light-notebook-android)。接续工作先读 [PROJECT_STATUS.md](PROJECT_STATUS.md) 和 [AGENTS.md](AGENTS.md)。各阶段实际完成情况、资料限制与操作验收见 [UPGRADE_ACCEPTANCE.md](UPGRADE_ACCEPTANCE.md)。

0.2.5本轮：修复「保存整理与复盘」成功后仍停留在照片弹窗的问题。写入并刷新成功后关闭弹窗、返回照片列表；失败时保留输入并提示原因，重试成功清除旧错误。已验证标签、选片状态、分组和复盘持久保存，原签名versionCode10 APK已构建。

0.2.4上一轮：成长页改为紧凑标题、对齐的三项统计、全宽练习建议和代表作入口。无足够数据时合并进度提示；主题、常用焦段和喜欢照片焦段达到各自门槛后独立显示真实分布。统计口径按需展开，保留演示排除、未知焦距处理和原有练习入口。原签名versionCode9 APK已构建，见[成长页验收](GROWTH_UI_ACCEPTANCE.md)。

0.2.3上一轮：作品库顶部只突出导入；搜索、快捷分类和分组/数量行保持紧凑，选片状态、照片标记、设备与日期统一收进可展开筛选区，生效数量与一键清除始终可见。多选时优先显示对比，其他批量操作按需展开；首次导入和筛选无结果分别提示。已构建原签名versionCode8 APK，先覆盖安装验收，再决定是否合并PR #1。验证与步骤见[照片页验收](PHOTO_LIBRARY_ACCEPTANCE.md)。

0.2.2上一轮：按钮收紧/轻回弹、导航背景追随、页面短过渡、手机选择面板弹性进退场及顶部下拉关闭；支持快速中断和系统减少动态效果。细节、实际验证与电脑验收见[MOTION_ACCEPTANCE.md](MOTION_ACCEPTANCE.md)。源码已同步上述GitHub任务分支，PR #1保持草稿。2026-10-22已从旧交付工程恢复原私有签名并生成**可安装的0.2.2/versionCode7 APK**，证书与旧版一致，待用户真机验收；此前缺签名和403是历史记录，以[当前进度](PROJECT_STATUS.md)为准。安装前导出含照片备份，然后覆盖安装。服务器后台、账户和AI联网功能尚未接入APK。

0.2.1新增：常见设备型号随应用预置，添加设备时按类型、品牌、具体型号直接选择；全局下拉框统一为手机底部面板 / 电脑浮层，支持搜索、选中状态和键盘操作。界面更新为浅色圆角卡片与玫红强调色，同时保留深色主题。详见[本次验收](UI_CATALOG_ACCEPTANCE.md)与[完整内置型号清单](EQUIPMENT_CATALOG.md)。

## 直接运行电脑预览

需要 Node 20+。在本目录执行：

```powershell
npm run dev
```

打开 http://127.0.0.1:5173/preview/ 切换手机/电脑尺寸，或直接打开 http://127.0.0.1:5173/ 使用桌面布局。预览无需先安装依赖。VS Code 按 F5 可选择 Chrome/Edge；保存应用文件后自动刷新。端口被占用时使用 `npm run dev -- --port 5174`。不同端口属于不同浏览器存储区域，数据需要备份迁移。

## 这次能用什么

- 照片 → 右上角更多 → 管理分组：新建、重命名、简介、组内封面、上移/下移和删除。照片可加入多个组，删除分组不删除照片。
- 导入可选择分组或直接新建；默认未归组。支持逐张进度、内容指纹去重、失败原因、最近一批与历史导入记录。RAW/HEIC/PNG 需先导出为 JPG。
- 批量加入/移出/移动分组、保留/待定/淘汰；名称、标签、设备、实际焦距及拍摄日期筛选。标签、所属练习与活动分组分别保存。
- 对比页参数并排对齐、缺失项显示未知；两侧联动放大/位置，直接保存选片结果和原因。用的是复盘副本，未实现像素级图像配准。
- 设置 → 我的设备 / 设备资料库：多机身、多镜头、手机、已拥有/想了解、停用/移出、可选购买记录、命名组合和默认组合。
- 标准 JPEG EXIF 逐张匹配设备别名，歧义保留未识别；手动修正独立保存原始 EXIF 与历史快照。不会给无 EXIF 照片套上默认机身。
- 新任务参考启用的已拥有默认组合，给出实际可用焦段与保守光圈；手机、定焦或未核实规格使用对应的通用练习。
- v2 备份恢复分组、设备组合、任务、导入历史、选片与复盘。仅记录备份不含任何图片；含照片备份包括压缩副本，不包括原图。仅记录恢复不会覆盖本机已有图片，再导入同指纹原文件可补回缺失副本。
- AI 保留可替换 provider 接口与用户问题输入，未配置时明确提示不发送照片，不生成伪评价；见 [AI_INTEGRATION.md](AI_INTEGRATION.md)。

## 设备资料与图片边界

本地资料快照核对日期为2026-10-20，内置8品牌、78个按卡口区分的条目（61个具体型号：27台机身、51个镜头卡口版本），无需自行导入。入口：设置 → 我的设备 → 添加设备。支持中文品牌和A7M4等型号简称搜索，未收录或冷门器材保留手动添加。所有来源直接保存在资料条目中：Sony、Canon、Nikon、Fujifilm、Panasonic、OM SYSTEM、Sigma、Tamron。

已核实 Sigma 镜头完整型号为 **20–200mm F3.5–6.3 DG | Contemporary（C025）**，分别收录 Sony E（540g）和 L（550g）。添加默认 A7C II 组合前需要用户核对自己的镜身/包装，确认 Sony E 卡口。

Sigma 999 USD为2025-09-09美国官方发布价；Tamron A071129800 JPY为日本官方建议零售价（含税，2026-04-01资料）。新增Canon R6 II与RF24–70mm F2.8 L的价格为新加坡官网RRP，未扣除促销与返现。不混同当前售价、市场促销价和中国指导价。其余未核实的官方价格明确显示未知；部分OM镜头规格仍标注未核实。

当前没有取得可离线分发的官方图片许可，使用明确标注「非产品照片」的设备类别图标和官网链接，没有AI设备图。图片机制支持维护者确认许可后的浏览器缓存和APK内置授权图片；普通浏览只读本地资料及已有缓存，不实时抓取官网。APK目前不联网下载图片。用户增量资料包不会自动取得“官方核验”或图片许可状态。

## 存储、迁移与安装

| 项目 | 当前版本 |
| --- | --- |
| APK | 0.2.5原签名可安装包已构建，待用户验收保存关闭行为 |
| 包名 / 升级版本 | `cn.xiaohuang.lightjournal` / versionCode10（0.2.4为9） |
| Android | 9+，target API 35；原生四项底部导航 |
| 数据版本 | IndexedDB 2 / SQLite user_version 2 / 语义版本2 |
| 手机存储 | 私有 SQLite 元数据 + `files/photos` JPEG |
| 电脑存储 | 当前浏览器当前 origin 的 IndexedDB |

升级保留原签名、数据库和照片路径。旧 `sessionId` 保留为练习关联；旧练习照片建立对应分组与多对多关联，迁移及版本标记原子提交。支持恢复 R0/v1 备份；旧版本应用不能读取新的数据库版本。安装前建议导出含照片备份，**覆盖安装，不先卸载**。

每批最多200张，每张最多40MB，保留最长边2400px复盘副本与400px缩略图；原图自行保管。含照片备份限已保存副本合计100MB，恢复文件限160MB。GitHub同步的是代码和文档，不同步用户照片和本机数据库。

## 开发与检查

功能测试需 Node 24、安装开发依赖：

```powershell
npm ci
npm test
npm run test:browser
```

真实浏览器测试自动选择本机Chrome或Edge，使用隔离测试数据；其他机器可设置`BROWSER_PATH`，或安装Playwright的Chromium。手机尺寸393×852，桌面1440×1000；原流程截图在`release/qa/`，本次界面/型号/多选面板截图在`release/qa-ui/`。本机另备有`.tools/runtime/node_modules/node/bin/node.exe`可执行Node24。

APK 构建支持 Windows 和 Linux x86_64，需要 Python3、Java17+：

```powershell
python build_apk.py
python tests/test_picker.py .tools/ecj.jar
python scripts/verify-apk.py "release/光影练习册_Android_v0.2.5.apk" --baseline "release/光影练习册_Android_v0.2.4.apk"
```

构建脚本下载官方API35平台、对应系统Build Tools35和ECJ。Java需在PATH中；本机验证使用已有 IntelliJ 自带Java21和工程内便携Python。`--prepared-sdk`与`--ecj`可复用已准备工具。

`signing/`必须使用原私有升级签名并另行备份，不提交到GitHub。缺少签名时构建会明确停止，不生成替代签名。源代码修改不会自动更新已安装APK，需要重新构建并覆盖安装。

0.2.1上轮验证记录：30项Node测试、6条真实Edge流程（桌面/手机尺寸）、10项Java选图检查；APK编译、签名、zipalign、资源一致性及原签名核对分别记录在验收文档。按用户要求先交付APK，安卓真机运行验收留待设备连接后进行。

## 主要代码位置

| 文件 | 用途 |
| --- | --- |
| `app/src/main/assets/www/app.js` | 原应用入口、任务与页面事件 |
| `organize.js` / `workspace-ui.js` | 分组、迁移、批量整理与导入界面 |
| `equipment-data.js` / `equipment.js` / `equipment-ui.js` | 官方来源快照、设备规则与设备界面 |
| `equipment-presets.js` / `catalog-search.js` | 常见具体型号、卡口版本和中文/简称搜索 |
| `growth-ui.js` / `growth.css` | 成长页统计、分布门槛、练习建议及紧凑布局 |
| `library.css` | 作品库紧凑布局、筛选、多选与空状态 |
| `motion.js` / `motion.css` | 全局轻回弹、导航/页面过渡与可中断弹窗和顶部手势 |
| `choice-picker.js` / `community.css` | 全局选择面板、照片卡片及深浅主题 |
| `equipment-tasks.js` / `comparison-ui.js` | 任务适配、联动对比与选片复盘 |
| `backup.js` / `backup-v2.js` | 版本化备份、完整验证与原子恢复 |
| `browser-store.js` / `native.js` | 浏览器和Android存储适配 |
| `app/src/main/java/cn/xiaohuang/lightjournal/LocalStore.java` | SQLite及JPEG持久存储 |

表中JS文件均位于 `app/src/main/assets/www/`。历史Android交接见 `ANDROID_HANDOFF.md`；原网页R0 Site不随本地仓库自动部署。示例照片来自Unsplash，图标Lucide/ISC，许可见 `assets/LUCIDE-LICENSE`。
