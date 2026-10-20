# 光影练习册 · 0.2.0

在原有 Android 工程上增量升级的摄影训练、照片整理与作品复盘应用。电脑预览与 APK 共用前端；手机和电脑的数据各自保存在本机，暂不自动共享，使用备份迁移。

代码仓库：[Sw0rdEnd/light-notebook-android](https://github.com/Sw0rdEnd/light-notebook-android)。接续工作先读 [PROJECT_STATUS.md](PROJECT_STATUS.md) 和 [AGENTS.md](AGENTS.md)。各阶段实际完成情况、资料限制与操作验收见 [UPGRADE_ACCEPTANCE.md](UPGRADE_ACCEPTANCE.md)。

## 直接运行电脑预览

需要 Node 20+。在本目录执行：

```powershell
npm run dev
```

打开 http://127.0.0.1:5173/preview/ 切换手机/电脑尺寸，或直接打开 http://127.0.0.1:5173/ 使用桌面布局。预览无需先安装依赖。VS Code 按 F5 可选择 Chrome/Edge；保存应用文件后自动刷新。端口被占用时使用 `npm run dev -- --port 5174`。不同端口属于不同浏览器存储区域，数据需要备份迁移。

## 这次能用什么

- 照片 → 管理分组：新建、重命名、简介、组内封面、上移/下移和删除。照片可加入多个组，删除分组不删除照片。
- 导入可选择分组或直接新建；默认未归组。支持逐张进度、内容指纹去重、失败原因、最近一批与历史导入记录。RAW/HEIC/PNG 需先导出为 JPG。
- 批量加入/移出/移动分组、保留/待定/淘汰；名称、标签、设备、实际焦距及拍摄日期筛选。标签、所属练习与活动分组分别保存。
- 对比页参数并排对齐、缺失项显示未知；两侧联动放大/位置，直接保存选片结果和原因。用的是复盘副本，未实现像素级图像配准。
- 设置 → 我的设备 / 设备资料库：多机身、多镜头、手机、已拥有/想了解、停用/移出、可选购买记录、命名组合和默认组合。
- 标准 JPEG EXIF 逐张匹配设备别名，歧义保留未识别；手动修正独立保存原始 EXIF 与历史快照。不会给无 EXIF 照片套上默认机身。
- 新任务参考启用的已拥有默认组合，给出实际可用焦段与保守光圈；手机、定焦或未核实规格使用对应的通用练习。
- v2 备份恢复分组、设备组合、任务、导入历史、选片与复盘。仅记录备份不含任何图片；含照片备份包括压缩副本，不包括原图。仅记录恢复不会覆盖本机已有图片，再导入同指纹原文件可补回缺失副本。
- AI 保留可替换 provider 接口与用户问题输入，未配置时明确提示不发送照片，不生成伪评价；见 [AI_INTEGRATION.md](AI_INTEGRATION.md)。

## 设备资料与图片边界

本地资料快照核对日期为 2026-10-20，首批8品牌、13个按卡口区分的条目。所有来源直接保存在资料条目中：Sony、Canon、Nikon、Fujifilm、Panasonic、OM SYSTEM、Sigma、Tamron。

已核实 Sigma 镜头完整型号为 **20–200mm F3.5–6.3 DG | Contemporary（C025）**，分别收录 Sony E（540g）和 L（550g）。添加默认 A7C II 组合前需要用户核对自己的镜身/包装，确认 Sony E 卡口。

Sigma 999 USD 为2025-09-09美国官方发布价；Tamron A071 129800 JPY为日本官方建议零售价（含税，2026-04-01资料）。不混同当前售价、市场促销价和中国指导价。其余未核实的官方价格明确显示未知；部分 OM 镜头规格仍标注未核实。

首批没有取得可离线分发的官方图片许可，统一使用明确占位和官网链接，没有AI设备图。图片机制支持维护者确认许可后的浏览器缓存和 APK 内置授权图片；普通浏览只读本地资料及已有缓存，不实时抓取官网。APK目前不联网下载图片。用户增量资料包不会自动取得“官方核验”或图片许可状态。

## 存储、迁移与安装

| 项目 | 当前版本 |
| --- | --- |
| APK | `release/光影练习册_Android_v0.2.0.apk` |
| 包名 / 升级版本 | `cn.xiaohuang.lightjournal` / versionCode 5 |
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

真实浏览器测试自动选择本机 Chrome 或 Edge，使用隔离测试数据；其他机器可设置 `BROWSER_PATH`，或安装 Playwright 的 Chromium。手机尺寸393×852，桌面1440×1000，截图在 `release/qa/`。本次本机另备有 `.tools/runtime/node_modules/node/bin/node.exe` 可执行 Node24。

APK 构建支持 Windows 和 Linux x86_64，需要 Python3、Java17+：

```powershell
python build_apk.py
python tests/test_picker.py .tools/ecj.jar
python scripts/verify-apk.py "release/光影练习册_Android_v0.2.0.apk" --baseline "release/光影练习册_Android_R0_v0.1.3.apk"
```

构建脚本下载官方API35平台、对应系统Build Tools35和ECJ。Java需在PATH中；本机验证使用已有 IntelliJ 自带Java21和工程内便携Python。`--prepared-sdk`与`--ecj`可复用已准备工具。

`signing/`必须使用原私有升级签名并另行备份，不提交到GitHub。缺少签名时构建会明确停止，不生成替代签名。源代码修改不会自动更新已安装APK，需要重新构建并覆盖安装。

本次验证：28项Node测试、2条真实Edge完整流程（桌面/手机尺寸）、10项Java选图检查；APK编译、签名、zipalign、资产一致性及原签名核对分别记录在验收文档。按用户要求先交付APK，安卓真机运行验收留待设备连接后进行。

## 主要代码位置

| 文件 | 用途 |
| --- | --- |
| `app/src/main/assets/www/app.js` | 原应用入口、任务与页面事件 |
| `organize.js` / `workspace-ui.js` | 分组、迁移、批量整理与导入界面 |
| `equipment-data.js` / `equipment.js` / `equipment-ui.js` | 官方来源快照、设备规则与设备界面 |
| `equipment-tasks.js` / `comparison-ui.js` | 任务适配、联动对比与选片复盘 |
| `backup.js` / `backup-v2.js` | 版本化备份、完整验证与原子恢复 |
| `browser-store.js` / `native.js` | 浏览器和Android存储适配 |
| `app/src/main/java/cn/xiaohuang/lightjournal/LocalStore.java` | SQLite及JPEG持久存储 |

表中JS文件均位于 `app/src/main/assets/www/`。历史Android交接见 `ANDROID_HANDOFF.md`；原网页R0 Site不随本地仓库自动部署。示例照片来自Unsplash，图标Lucide/ISC，许可见 `assets/LUCIDE-LICENSE`。
