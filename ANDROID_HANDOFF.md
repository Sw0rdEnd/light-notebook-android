# Android R0 交接 · 2026-10-20

> 旧版本段落保留为历史记录；当前权威状态为文末「0.2.9独立点评与历史」及PROJECT_STATUS.md。

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

## 0.1.3 + PC 开发预览交接（历史）

用户在手机反馈首页过长、底栏被遮挡、参数不便对比，要求预留 AI 评价接口；后在 PC 要求拿到源码并使用 VS Code 预览。

已完成：原生 MainActivity 采用 WebView 高度 0 + weight=1，原生 64dp 四项底栏固定在 WebView 外，系统栏/键盘 insets 留在根布局。网页原生模式隐藏 sidebar，前端 render 的 setNavigation 同步高亮与主题；android-navigation 从原生回传。不要退回 MATCH_PARENT WebView 挤占底栏。

首页收紧，参数表为同框 3 列（参数/A/B）、7 行，已知差异高亮。AI 的 ai.js/AiEvaluationService.java 为真实可调用的未配置接口，无网络权限、无评价输出；详细协议见 AI_INTEGRATION.md。

新增 BrowserStore/Store 门面，存在 AndroidStorage 时仍用 NativeStore；普通浏览器用 IndexedDB。新增无依赖 Node 预览服务、设备尺寸页、保存后刷新和 VS Code F5 配置。PC 与 APK 不自动同步，通过 JSON 备份迁移。

最新版本 versionCode 4/versionName 0.1.3，包名和签名不变，schema 1 不变。12 项 Node 测试、10 项 Java 选图检查、API35 编译/D8/签名/对齐通过；未进行浏览器截图和安卓真机验收。以 README.md 为启动入口。文件包内 signing 请本人保留，不要公开提交。

## 0.2.0四阶段增量升级交接（历史）

当前versionCode5/versionName0.2.0，包名与原升级签名保留。安装包在release/光影练习册_Android_v0.2.0.apk；源码、启动方式和四阶段验收见README.md及UPGRADE_ACCEPTANCE.md。

- SQLite user_version升级至2，继续使用原records表，增加groups/memberships/imports/equipment/kits/catalog命名空间。前端语义迁移2保留旧sessionId，原子生成分组与关联；JPEG路径不迁移、不删除。IndexedDB升级2采用对应存储。
- merge同时支持原子删除与写入；分组删除仅移除关联，照片删除才清理照片和所有分组关系。丢失JPEG时readAll/readOne标记缺失，既有同一照片文件引用允许保存整理/迁移记录，新无效文件引用仍拒绝。
- v2备份支持完整新命名空间、外键和封面检查，先验证/解码再原子合并，兼容v1。元数据备份恢复不抹掉本机已有图片；相同内容原文件重导入可修复缺图。
- MainActivity保留WebView weight=1和原生四项固定底栏/insets。用户点击官方HTTPS来源使用系统浏览器打开；外部网页不进入带原生桥接的WebView。APK仍无INTERNET权限。
- 官方设备图目前均为明确占位；仅为以后取得许可的图片提供APK内置路径和浏览器显式加载缓存机制，APK不联网抓图。
- 构建脚本支持Windows工具，使用原signing密钥；缺失时明确停止，不能生成替代升级签名。本机使用已有IntelliJ Java21和工程内Python，官方API35/Build Tools35/ECJ。

本次实际检查：28项Node回归、真实Edge桌面/手机尺寸2条完整使用流程、10项Java选图解析检查通过；APK编译、D8、签名、zipalign和scripts/verify-apk.py资源/版本/旧证书一致性检查通过。SQLite桥接fixture和浏览器测试不是安卓运行时。

用户已明确「暂时不能，先交付APK和真机验收步骤」。因此尚未进行安卓真机/模拟器安装运行、真实系统文件选择器/软键盘/安全区域及实际覆盖升级数据验收。按UPGRADE_ACCEPTANCE.md清单连接设备后执行；覆盖安装前导出含照片备份，不先卸载。

## 0.2.1预置型号与界面（当前权威状态）

versionCode6/versionName0.2.1，安装包release/光影练习册_Android_v0.2.1.apk。包名、签名、SQLite和备份数据版本2保持兼容，不迁移或重写照片与历史设备快照。

设备库内置78个按卡口区分的条目、61个具体型号，常见设备按类型→品牌→型号直接添加，支持中文与简称搜索；手动添加及资料包仅为补充。型号和来源完整列表见EQUIPMENT_CATALOG.md。

choice-picker.js统一增强全部select，保留原表单数据和change事件，显示手机底部面板/电脑浮层；多选分组明确确认/取消。嵌套面板可用cancel/Escape或android-back关闭最上层，不会误关设备/照片编辑弹窗。原生导航、系统栏和WebView背景配合新的浅色/深色主题，仍保留原insets与键盘隐藏底栏逻辑。

本次30项Node、真实Edge桌面/手机尺寸6条流程、10项Java检查通过；APK编译/D8/签名/zipalign及逐文件资源/0.2.0证书一致性检查通过。截图release/qa-ui；详细操作验收见UI_CATALOG_ACCEPTANCE.md。真机安装、软键盘和实际系统栏仍按用户之前选择留待连接设备后，不能用Edge手机尺寸模拟代替。

## 0.2.2流畅动效源码（2026-10-21，待合并、待签名）

- 基于main@6b1b5e7，在feat/fluid-motion-20261021增量接入motion.js/motion.css。网页/APK共用按钮、选择面板和页面动效，原生四项底栏增加按压与松手回弹，原系统选图和业务点击路径保留。
- versionName0.2.2/versionCode7；包名、升级签名要求、SQLite user_version2、备份版本2和照片路径不变。sw.js缓存加入新资源并更新修订。
- 本轮30项Node、12条真实Chromium桌面/手机流程、10项Java选图检查通过；Java/API35编译、D8、未签名APK对齐成功。
- 当前云端没有原signing/light-journal.jks和密码文件，构建在签名前停止；没有生成替代签名，没有可安装新APK。不能把build/aligned.apk当成已签名交付。
- 下一步在电脑使用原私有签名构建，按MOTION_ACCEPTANCE.md预览并覆盖升级验收，重点确认系统减少动画、原生底栏快速操作、选择面板短/长拖动、返回键、软键盘及安全区域。尚未安卓真机验收。

## 0.2.2原签名验收包（2026-10-22，更新上述签名状态）

- 用户要求先安装APK验收再决定合并。以PR #1中的源码2c6d8b3进行独立干净构建，未合并main、未修改应用功能、包名或存储版本。
- 从旧0.1.3完整工程交付包恢复原私有签名，Java17/API35/Build Tools35/ECJ编译、D8、对齐和签署通过。可安装产物为光影练习册_Android_v0.2.2.apk，versionCode7；签名证书与旧0.1.3包一致，未生成替代签名。
- verify-apk检查全部内置资源、DEX、包名版本、离线权限和旧版证书一致性通过；10项Java选图检查通过。签名及口令未提交Git或放入APK。
- APK SHA256：4ca0bdf9ea61e655816fc8c90fbcf89240bba6f583055dc972e854c449fe2d4a。产物已交付，用户先导出含照片备份后覆盖安装；实际安卓安装运行与升级后数据尚未验收。
- 后台0.4.0、个人账户/云备份及真实AI仍为服务器网页版功能；本APK没有新增INTERNET权限，不能通过安装本包验收服务器功能。PR保持草稿待用户决定。

## 0.2.3照片页整理（2026-10-23，待合并验收）

- versionName0.2.3/versionCode8，包名/原升级签名/SQLite user_version2/备份版本2和照片路径保留。
- 作品库优先照片浏览：一个导入主按钮、搜索/筛选同行、单行快捷分类、分组与数量行。管理分组和导入记录在右上角更多；统一筛选区显示生效数量并可清除；多选次要操作收起；区分首次导入和过滤空结果。
- 原签名APK已构建，所有内置资源逐文件匹配、DEX/版本/离线权限/原证书/对齐检查通过。SHA256：4f4b83333e7a206fa776469433fcb794f4c0d820d1c4afce7b8cb7462f6661de。
- 本轮51项Node、10项Java选图检查通过；真实云浏览器393px/320px定向检查。没有连接安卓真机或模拟器，系统选图、软键盘、安全区域及原数据覆盖升级留待用户验收；步骤见PHOTO_LIBRARY_ACCEPTANCE.md。原网页Site没有重新发布。

## 0.2.4成长页整理（2026-10-23，待合并验收）

- 接续用户认可的0.2.3照片页；新增growth-ui.js/growth.css，成长页改为短标题、对齐三项统计、紧凑练习建议、合并空状态和可用代表作入口。分布按各自样本门槛独立显示；不修改核心统计、备份或数据库。
- versionName0.2.4/versionCode9，保留包名/原签名/SQLite版本2/备份版本2/照片路径。SW加入新模块与样式。
- 55项Node、10项Java检查通过；真实云浏览器393px/320px空状态、深浅主题、入口跳转检查通过。APK编译/D8/签署/对齐、全部内置资源、离线权限和0.2.3证书一致检查通过。SHA256：2f122f1db94780e6a2f2409c76f75cf5798a97466f973f298e626e7d33f8e3e7。
- 没有连接安卓真机或模拟器；按GROWTH_UI_ACCEPTANCE.md覆盖安装验收成长页。PR #1仍待合并，原公开摄影Site未重新发布。

## 0.2.5保存整理后关闭（2026-10-23，待合并验收）

- 修复照片保存整理后再次showPhoto导致弹窗不关闭：数据写入/刷新成功后清除旧错误、关闭弹窗并返回列表；失败保留输入供重试。版本0.2.5/versionCode10，包名、原签名、SQLite/备份版本2和照片路径保留。
- 57项Node、10项Java检查通过；真实云浏览器393px保存关闭/再次打开内容验证通过。原签名APK全部资源/DEX/版本/离线权限/0.2.4证书/对齐检查通过。SHA256：1aff3854026190c5f3d8fe9e6e921f28937776fd47f3a18bc414fcba9390d67e。
- 没有连接安卓真机或模拟器；用户先备份后覆盖安装，检查标签、复盘、选片与分组，按验收结果决定PR #1合并。原公开摄影Site没有重新发布。


## 0.2.6设备产品图片（2026-10-23，待合并验收）

- 为61个内置具体型号加入对应品牌产品页参考缩略图，共909306字节，覆盖全部78条卡口记录。卡片与详情使用本地WebP，按完整比例居中显示，支持深浅主题。来源、版权、原图/打包图SHA256与处理说明逐项保留；品牌图未声明为开放许可。
- 「我的设备」旧快照按id、品牌、型号、类别及官方规格来源标记匹配图片，只更新显示，不重写设备参数、购买备注、组合或备份。手动/用户导入资料不能声明内置图片身份，未匹配型号保留类别图标。
- versionName0.2.6/versionCode11；包名、原升级签名、SQLite版本2、备份版本2及照片路径保留，不新增联网权限。61张图片、图片登记表与样式均加入离线缓存。
- 59项Node与10项Java选图检查通过，含全部图片解码、逐文件SHA256与缓存清单、78条匹配、历史快照与用户导入边界。安卓真机覆盖升级与断网验收仍由用户安装后完成。


## 0.2.7手机 DeepSeek 点评（2026-10-24，待合并验收）

- versionName0.2.7/versionCode12，保留包名、原签名、SQLite user_version2、备份版本2及照片目录。新增普通INTERNET权限，明文传输禁用，外部页面不能获得原生桥接。
- AndroidAi独立异步桥接负责密钥配置、移除、GET /models测试及单张/双图分析；65秒总期限、后台线程、取消和晚到结果隔离，网络不占用同步SQLite桥接。固定官方HTTPS/DeepSeek Flash，不自动重试付费请求。
- 个人Key在手机设置输入，Keystore AES-256-GCM加密后AtomicFile保存在noBackup目录；不回显，不进照片备份或日志。清空本地数据同时删除Key。真实系统密钥/重启解密仍待手机验证。
- 上传须每次确认，原生按ID重读真实保存记录、压缩最长边1600 JPEG并去除图片EXIF；只发送白名单参数、用户独立修正、问题及练习上下文，不传GPS、文件名、路径和照片ID。结果验证/转义后写入aiReview；保存失败可只重试本地，重开不再次调用。
- 65项Node、24项原生AI JVM、10项选图检查通过；真实云浏览器393px模拟单图/双图/配置/保存重开/深浅主题和320px配置布局通过。JVM/浏览器使用模拟上游或Android替身，不能代替Android或实际DeepSeek付费验收。
- 原签名APK编译、D8、签名、对齐、全部资源/版本/声明权限/禁明文/旧证书检查通过；1787110字节，SHA256：2d2d195944cc7e640746c77c59517ef4518db38835f824dc16dc0b4ec9afb624。
- 用户下一步覆盖安装，设置 → AI点评设置填写自己的Key并测试，再实际分析单图/双图；连接测试不上传照片，也不保证余额。详细步骤/边界见AI_NATIVE_ACCEPTANCE.md；PR #1仍为草稿，原Site与服务器部署保留。


## 0.2.8点评触发与提示词整理（2026-10-24，待合并验收）

- versionName0.2.8/versionCode13，包名、原签名、SQLite/备份版本2、JPEG及Keystore文件路径保留，权限和WebView网络边界不扩大。
- 修复缺少AbortSignal.any/timeout时try之前创建task导致首次异常/后续点击无响应的路径。原代码已在禁用接口时复现；用户手机实际版本尚未知。ai-task.js采用可清理定时器，启动和请求在try中，取消/失败释放状态，等待与错误/错误码在弹窗直接显示。
- 照片中全宽多行问题与「开始AI点评」，确认页先查看整理要求/勾选同意再发送；AI步骤切换归顶，输入草稿保留，标签横排及320px网格溢出修复。
- ai-prompt.js预览本机意图整理，AiPrompt.java在原生上游请求中根据原问题重建reviewBrief，question单独保留，不额外调用模型。9组共享规则样例，服务器HTTP模板未修改。
- 71项Node、26项原生AI JVM、10项选图检查通过；393px真实云浏览器兼容模拟下走通单图/预览/确认/保存重开，320px深色/标签/余额错误与无横向溢出通过。没有真实Key、安卓设备或付费调用验收。
- 原签名APK编译/D8/签名/对齐/全部资源/版本/权限/证书一致通过；1791342字节，SHA256：7ea820c19561a671b91fcb8f1009a3ece9fbebed53fd688b3125553cd390bc5d。详细安装、复现与边界见AI_TRIGGER_ACCEPTANCE.md。PR #1保持草稿，不合并或部署Site。


## 0.2.9独立点评与历史（2026-10-24，待合并验收）

- versionName0.2.9/versionCode14，原签名/包名/SQLite user_version2/照片目录及Keystore保留；Native MainActivity新增点评第五项及图标，WebView/insets/系统选图边界不扩大。
- 独立点评模块负责选1–2张照片、新建与历史搜索/状态/日期/类型筛选。aiReviews在原records表增加命名空间；浏览器IndexedDB物理3只新增store，语义版本2。旧留存aiReview去重迁入，但旧版已覆盖结果无法恢复。
- 每次分析先持久建档，结果与照片最近点评原子写，终态不覆盖旧记录；失败/取消/中断可查询，晚到结果隔离。保存失败可只重试本地，清空前取消并排空队列。
- 历史保留问题/要求/名称/参数/修正快照和结果/错误，删图后文字仍存；图片使用当前作品库，不新增JPEG副本。v2备份增加可选aiReviews，兼容旧备份，新历史扩展需0.2.9+恢复；恢复中断记录不会自动请求。
- 78项Node、26项AI JVM、10项Java选图通过；393px真实云浏览器模拟双图、重复记录、详情/搜索/失败/重开和320px深色/状态筛选/无横向溢出通过。无真实Key、Android设备或付费API验收。
- 原签名APK编译/D8/签名/对齐/全部资源/版本/权限/旧证书检查通过；1803908字节，SHA256：43baf7bc8ed47de7410e06983d82965325fb610985336b6c426010daf10a88a1。详见AI_MODULE_ACCEPTANCE.md；PR #1保持草稿，原Site不部署更新。
