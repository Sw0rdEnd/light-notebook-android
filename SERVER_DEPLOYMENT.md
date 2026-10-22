# 光影练习册 · 2核4GB服务器部署准备

这是可运行的服务器预备版0.4.0，含后台、账户与私有云备份，尚未部署到你的服务器。详见[后台说明](ADMIN_SYSTEM.md)。当前公开的ChatGPT Site保持0.2.2，不会被此文档或源码自动更新。

已实现：完整网页服务、DeepSeek单图/A-B双图接口、显式上传确认、结果本地保存、独立AI访问口令、持久调用额度、超时/取消、Docker Compose、Caddy HTTPS配置、健康检查、备份和回滚步骤。没有使用真实DeepSeek密钥或产生付费调用。

## 1. 服务器怎么选

按Ubuntu 24.04 LTS、64位、2核4GB准备。Node 24与Caddy各一个容器，AI由DeepSeek API提供；服务器承担网页、图片请求转发与额度记录。

| 部件 | 初始配置 |
| --- | --- |
| 网页/API | Node 24，运行时无第三方npm依赖 |
| HTTPS | Caddy 2，域名配置后自动申请及续期证书 |
| 服务启动 | Docker Engine + Docker Compose插件，异常重启 |
| AI并发 | 最多2个；不排队堆积图片 |
| 资源上限 | app容器768MB/1.25 CPU；Caddy 256MB/0.5 CPU |
| 服务端数据 | SQLite账户/会话/设置/用量，以及用户主动上传的私有云备份；AI转发不保存图片或回答正文 |
| 用户数据 | 浏览器本地照片和练习；可登录账户主动上传/下载云备份，尚无自动相册同步 |

这些是初始资源限制，不是负载容量承诺。后续按实际用户数、网络和响应时间调整。

建议先准备域名。域名A/AAAA解析到服务器，云安全组开放80/443；SSH按你的管理范围开放。应用8080仅在容器网络内，不需要向公网开放。不要把数据库或Docker管理端口公开。

Docker安装按[Docker Ubuntu官方文档](https://docs.docker.com/engine/install/ubuntu/)操作，确认`docker compose version`可用。本包不会自动安装系统软件或修改安全组。

## 2. 首次启动

把交付的ZIP解压到服务器，例如`/opt/light-notebook`，进入包含`compose.yaml`的目录。

```sh
cp .env.example .env
chmod 600 .env
```

编辑`.env`，先只改域名并保持AI关闭：

```dotenv
SITE_ADDRESS=你的域名
PUBLIC_ORIGIN=https://你的域名
AI_ENABLED=false
```

`PUBLIC_ORIGIN`不带末尾斜杠；域名或端口必须与浏览器实际网址一致。保留默认`APP_RELEASE=server-prep`即可。

然后运行：

```sh
sh deploy/up.sh
```

脚本依次检查Compose、构建网页镜像、校验应用配置与Caddy配置、启动容器、执行容器内健康和静态资源检查。容器内通过不等同于公网证书/DNS已正常，仍需打开网址并检查：

```sh
curl --fail https://你的域名/api/health
curl --fail https://你的域名/api/ai/status
```

前者应返回`status: ok`，后者在尚未配置AI时返回`enabled: false`。此时照片导入、分组、对比和本地备份可正常使用。接着在服务器初始化管理员：

```sh
docker compose exec app node server/bootstrap-admin.mjs create-admin xiaohuang
```

密码按终端提示输入（至少12位，不回显），然后打开`https://你的域名/admin/`登录并创建用户。用户入口是`/account/`。没有默认管理员密码。

Caddy证书配置要求域名指向服务器、80/443可达并且`caddy_data`卷持久保留，见[Caddy官方HTTPS说明](https://caddyserver.com/docs/automatic-https)。

### 暂时没有域名

先用SSH隧道测试，避免把不安全的IP HTTP页面当正式应用。`.env`改为：

```dotenv
SITE_ADDRESS=:80
PUBLIC_ORIGIN=http://localhost:8080
BIND_ADDRESS=127.0.0.1
HTTP_PORT=8080
HTTPS_PORT=8443
AI_ENABLED=false
```

启动后在自己电脑运行：

```sh
ssh -N -L 8080:127.0.0.1:8080 用户名@服务器IP
```

电脑浏览器打开`http://localhost:8080`。`localhost`可使用浏览器安全上下文功能；公网IP的普通HTTP不适合正式运行本应用。朋友正式访问时再配置域名和HTTPS，并把绑定/端口改回示例值。

## 3. 启用DeepSeek

在服务器编辑`.env`，密钥不写入网页、APK、Git，也不用发到聊天：

```dotenv
AI_ENABLED=true
ADMIN_ENABLED=true
AI_ALLOW_SHARED_TOKEN=false
DEEPSEEK_API_KEY=你的DeepSeek平台密钥
DEEPSEEK_MODEL=deepseek-flash
AI_DAILY_LIMIT=50
AI_PER_MINUTE=6
AI_CONCURRENCY=2
```

账户模式无需共享口令，管理员给朋友创建用户名和密码即可。若要兼容旧口令模式，在服务器用`openssl rand -hex 32`生成独立AI_ACCESS_TOKEN，再在后台开启共享口令。共享调用不归属个人，只受全站额度限制。

然后重新运行`sh deploy/up.sh`。先在`/account/`登录，网页选照片→AI摄影复盘→勾选同意上传→发送并分析。首次.env值用于初始化；后台保存过的服务设置会持续生效，之后优先在后台设置AI开关和额度。

- 默认全站每天50次、每分钟6次；新用户默认个人每天20次，可在后台调整。全站与个人限制同时生效。
- 额度在进入模型调用前预占，超时/错误尝试也计入保守的调用次数；重复requestId不会再次调用。重启容器不会清空台账。每天北京时间00:00重置日额度。
- 这个上限限制调用次数，不是精确人民币预算；计费以DeepSeek账单为准。默认最多1800输出tokens，显式关闭思考模式以控制等待时间，不自动重试。
- 仅发送主动选择的1–2张压缩副本，最长边1600px、每张最多2MB；总请求上限6MB。常规浏览和导入不会发送照片。默认不发送GPS、原文件名或本地路径。
- 模型接收真实图片块、必要EXIF、独立标注的用户修正和问题；输出区分画面观察/拍摄参数/推测，结果保存在本地照片复盘记录中。可查看上次分析而不重复调用。
- 服务端45秒超时，网页65秒等待上限。关闭或返回会取消本地等待并尝试中止上游；已经发出的请求仍可能计费。
- AI转发不保存图片与分析正文，日志不记录密钥/口令/请求正文；SQLite记录用户、请求ID、模型、时间、状态和实际返回token。用户主动上传的云备份另外保存到私有数据卷。日志按每服务3×10MB滚动。

当前实现依据[DeepSeek Vision](https://api-docs.deepseek.com/guides/vision/)、[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)和[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)官方文档。后续真实密钥到位后，还需确认账户模型权限、余额、网络与返回格式。

## 4. 迁移现有数据

从ChatGPT Site换到自有域名，属于不同浏览器来源，不能直接读取旧网页的数据，即使数据库名相同也不能跨站访问。

1. 在旧网址的「设置」导出**含照片备份**。
2. 打开新域名，在「设置」恢复该JSON。
3. 核对照片、分组、设备、练习、标记与复盘后继续使用。先保留原备份和旧网站数据。

APK数据也是独立的，用同样方式迁移。本轮没有改Android联网权限或签名，因此现有APK不会自动获得服务器账户、云备份或AI功能。

## 5. 日常维护与回滚

```sh
docker compose ps
docker compose logs --tail=100 app caddy
sh deploy/backup.sh
```

备份脚本短暂停止app写入，将整个数据卷打包为`backups/时间/server-data.tar.gz`，并复制当前`.env`。它包括账户、用量、设置和已上传的云备份，未上传的浏览器照片不包含；停止期间网站可能短暂返回502。备份含真实密钥与账户哈希，应私密保存。

正常更新时先备份，再运行`sh deploy/up.sh`。脚本在已有且标记server-schema=1的兼容镜像时，把上一份标记为`light-notebook:rollback`，保留数据卷。若更新后的镜像有问题，可从第二次部署起使用：

```sh
APP_RELEASE=rollback docker compose up -d --no-build --wait
```

0.3旧镜像不兼容新增数据库列，不能直接用作后台回滚。回滚镜像不回滚浏览器数据或密钥配置；需要时从自己的配置备份恢复`.env`。首次部署没有旧镜像可回滚。不要使用`docker compose down -v`清除台账与证书卷。

### 恢复服务器数据

在新服务器或全新的空app_data卷中恢复；先构建镜像并准备私密.env，app保持停止：

```sh
docker compose build
docker compose run --rm --no-deps -T app tar -C /app/data -xzf - < backups/备份时间/server-data.tar.gz
sh deploy/up.sh
```

不要在正在运行或已有其他时期数据的卷上直接混合解压。跨数据版本回退应同时使用匹配的源码、完整卷和配置备份。

## 6. 本地开发

需要Node 24：

```sh
npm ci
npm test
npm run build:web
PUBLIC_ORIGIN=http://localhost:8080 npm run start:server
```

打开`http://localhost:8080`。默认AI关闭。本地测试AI时可使用Node的`--env-file`加载单独的本地配置文件，或者设置环境变量；不要使用真实照片做自动测试。

前端仍以`app/src/main/assets/www/`为源，`build-server-web.mjs`生成`dist/`并保留原网页数据库名及网页文案，避免手工维护两套界面。`npm run dev`保留原有VS Code预览模式，未提供服务器API时AI仍显示尚未启用。

## 7. 本轮验证边界

本轮结果见`SERVER_PREP_ACCEPTANCE.md`。自动测试使用本地模拟提供商，确认实际图片块、校验、取消、额度与存储；没有调用真实DeepSeek。Compose配置和Caddy配置校验不等同于Docker镜像构建/容器运行，本环境没有Docker守护进程。你的真实服务器到位后再做镜像拉取、容器、域名HTTPS和真实API验收。
