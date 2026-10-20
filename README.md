# 光影练习册 · 0.1.3

同一份界面代码同时支持 Android APK 和 VS Code 本地浏览器预览。
本次完成：手机首页收紧、安卓原生底部导航、A/B 参数表同框逐行比较、AI 评价接口预留，以及电脑开发预览。

## 手机与电脑接续开发

每次开始先读 [PROJECT_STATUS.md](PROJECT_STATUS.md)，完成后更新当前进度、验证结果和下一步，并将代码与进度文档一起提交、推送到 GitHub。AI 开发约定见 [AGENTS.md](AGENTS.md)。

代码仓库：[Sw0rdEnd/light-notebook-android](https://github.com/Sw0rdEnd/light-notebook-android)，稳定分支 `main`。电脑 Git 已完成首次同步，手机工作模式的私有仓库访问检查见进度文档。

手机 ChatGPT 项目的工作模式需要实际连接并获准访问代码仓库，才能读取或提交最新文件；旧聊天或上传文件不会自动成为仓库最新版本。无法写入仓库时，使用进度文档中的交接卡把需求带回电脑。

## 在电脑上最快启动

1. 解压源码包，用 VS Code **打开 `light-notebook-android` 文件夹**（能看到本 README、package.json、app 和 scripts）。
2. 电脑安装 Node.js。预览支持 Node 20+；运行自动测试建议 Node 24。
3. VS Code 菜单「终端 → 新建终端」，执行：

```bash
npm run dev
```

4. 浏览器打开 **http://127.0.0.1:5173/preview/**。

预览服务器只使用 Node 自带模块，**预览不需要先 npm install**。完整测试才需要安装开发依赖。
设备预览页可以切换 360/393/430 像素手机、折叠展开和电脑尺寸；修改应用文件并保存后会自动刷新。
正常电脑布局可单独打开 http://127.0.0.1:5173/。

已附 `.vscode/launch.json`：按 F5，选择 Chrome 或 Edge 的预览配置，会启动开发服务器并打开预览页。也可以一直使用终端命令启动。

端口被占用：

```bash
npm run dev -- --port 5174
```

此时打开 http://127.0.0.1:5174/preview/。浏览器按 origin 隔离存储，端口变化后数据不会自动出现；使用备份迁移即可。按 Ctrl+C 停止服务器。
不要直接双击 index.html，用 HTTP 地址打开 ES 模块。

## 代码从哪里改

| 文件/目录 | 内容 |
| --- | --- |
| `app/src/main/assets/www/app.js` | 首页、练习、照片列表、参数表、事件与 UI |
| `app/src/main/assets/www/styles.css` | 响应式样式、手机首页、参数表 |
| `app/src/main/assets/www/db.js` | 按运行环境选择存储适配器 |
| `app/src/main/assets/www/browser-store.js` | 电脑浏览器 IndexedDB，直接保存压缩照片 Blob |
| `app/src/main/assets/www/native.js` | 安卓 Java 桥接、SQLite、照片文件引用 |
| `app/src/main/assets/www/ai.js` | AI 请求/返回约定、provider 扩展点与校验 |
| `app/src/main/java/cn/xiaohuang/lightjournal/MainActivity.java` | 原生底栏、WebView 容器、系统选图、导出 |
| `app/src/main/java/cn/xiaohuang/lightjournal/LocalStore.java` | 安卓 SQLite 与 JPEG 文件 |
| `app/src/main/java/cn/xiaohuang/lightjournal/AiEvaluationService.java` | 原生 AI 接入预留，当前返回未配置 |
| `dev/` | 电脑上的设备尺寸预览壳，不是另一套应用 |
| `scripts/dev-server.mjs` | 无依赖预览服务、刷新与路由 |
| `AI_INTEGRATION.md` | AI 接口数据约定与后续接入位置 |

## 这次手机界面改了什么

- 首页改为短标题、开始/继续按钮、三个统计、下一次建议和最近练习；装饰图移到下方并缩小。
- **APK 的底部导航是原生 Android View**，WebView 使用剩余空间，网页内容滚动不带动底栏；系统栏/键盘 insets 在原生层处理。
- 浏览器设备预览用固定 HTML 底栏模拟原生底栏位置；最终的系统选图、软键盘、系统状态栏和实际原生底栏必须在安卓手机确认。
- 双图预览下方用一张「参数 / A / B」表展示拍摄时间、焦距、快门、光圈、ISO、相机和镜头。不同的已知参数高亮；切换 A/B 大图时仍保留两列参数。
- AI 评价入口在照片详情和双图比较中。当前明确显示未接入，调用预留接口只返回 `not_configured`，不上传照片、不生成假评价。

## 数据存在哪里

| 环境 | 存储 | 与另一端的关系 |
| --- | --- | --- |
| APK | 手机私有 SQLite `light-journal.db`，`files/photos` JPEG 副本 | 不自动同步电脑 |
| 电脑预览 | 当前浏览器当前 origin 的 IndexedDB | 不自动读取 APK 数据 |

两端可以通过「设置 → 导出含照片备份 / 恢复备份」迁移记录和复盘照片。
关闭标签页后普通模式下的数据仍保留；清空网站数据、无痕模式或卸载 APK 会影响对应端的数据。需要留存时先备份。

导入 JPG/JPEG，单张不超过 40MB，每批不超过 200 张。保存最长边 2400px 的复盘副本和 400px 缩略图，原图自行保管。含照片导出限制为已存图片合计 100MB，备份导入不超过 160MB。

## APK 安装与构建

交付包 `release/光影练习册_Android_R0_v0.1.3.apk` 可直接安装。
包名 `cn.xiaohuang.lightjournal`，versionCode **4**，versionName **0.1.3**，Android 9+，target API 35。
与 0.1.1/0.1.2 使用相同签名与 schema 1，可**覆盖升级，勿先卸载**。

APK 没有 INTERNET、定位、相机或广泛存储权限。用户通过系统文件选择器选照片，导出同样由系统选择保存位置。
编辑前端后浏览器自动刷新；**已安装 APK 不会自动更新，需要重建并覆盖安装**。

现有构建脚本支持 Linux x86_64、Python 3、Java 17+ 与 keytool；Windows 可在 WSL 中构建。预览功能在 Windows/macOS/Linux 均只需 Node。

```bash
python3 build_apk.py
```

首次脚本会下载 Android API 35 平台、Build Tools 35 与 ECJ 编译器，输出到 release。已有解压后的工具：

```bash
python3 build_apk.py --prepared-sdk /path/to/android-sdk --ecj /path/to/ecj.jar
```

`signing/` 含覆盖升级所需私有签名。已通过 `.gitignore` 排除，不要提交到公开仓库。源码压缩包为本人交接用途而包含签名。

## 自动验证

```bash
npm install
npm test
python3 tests/test_picker.py /path/to/ecj.jar
```

- 12 项 Node 自动测试通过：原生存储适配模拟、完整 UI 流程、导入与最近批次、备份恢复、浏览器 IndexedDB 与事务回滚、真实 JPEG/EXIF 参数表、AI 未接入及返回校验、预览服务 HTTP 资源与目录隔离。
- 10 项 Java 选图解析契约检查通过：包括 ClipData 多选且 data=null 的原始问题。它们使用 Android 数据形状替身，不是系统运行时测试。
- API 35 Java 编译、D8、APK v3 签名与 zipalign 通过；证书与旧包相同。
- **没有运行安卓真机/模拟器，也没有浏览器引擎的截图布局验收**。DOM 测试和编译不能替代你设备上的观感、键盘和原生系统栏检查。

## 接着开发

先运行预览并验证你常用的手机尺寸，再修改 `www` 下的文件。保留包名、签名与数据库，不要用纯网页版文件覆盖 native.js。
后续 AI 接入按 AI_INTEGRATION.md 扩展；本版未接入远程服务。GitHub 关联和首次推送状态见 [PROJECT_STATUS.md](PROJECT_STATUS.md)；signing 已被忽略，升级签名须另行私密备份。

示例照片来自 Unsplash，图标 Lucide/ISC，授权说明在 assets/LUCIDE-LICENSE。
