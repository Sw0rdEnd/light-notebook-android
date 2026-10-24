# 服务器预备版验收 · 2026-10-21（0.3.0历史记录）

2026-10-22的0.4.0已新增账户、后台和私有云备份；当前结果与操作入口见ADMIN_SYSTEM.md、PROJECT_STATUS.md。本文件保留前一轮已执行结果。

基于原main@6b1b5e7以及手机端0.2.2动效/网页交接提交，在独立分支feat/server-prep-20261021继续实现。正式公网Site保持原0.2.2和公开访问范围，本轮没有改动该站点。

## 实现范围

- `server/`：Node24网页/API服务、DeepSeek图片块与JSON输出适配、输入/输出验证、请求大小限制、访问口令和同源校验、并发/频率/每日额度、SQLite台账、在线备份和健康检查。
- `ai-http.js`/`ai-ui.js`：服务状态、上传同意、访问口令、选定副本缩小、单图/双图分析、取消、错误提示、结果转义、本地保存和重新查看。API密钥只在服务端配置。
- `Dockerfile`/`compose.yaml`/`deploy/`：两个容器、域名HTTPS、内网API端口、资源与日志限制、部署/备份/回滚；`.env.example`默认禁用AI。
- `build-server-web.mjs`：从共享前端生成服务器dist，保留light-notebook-r0数据库名；不同域名仍须应用备份迁移。

## 未完成项

- 真实服务器/域名/DNS/HTTPS与Docker容器部署，服务器还未提供。
- 真实DeepSeek付费API、密钥与余额验证，未提供密钥，测试不会产生费用。
- Android联网AI与新签名APK，本轮仅服务器网页版。
- 账号/跨设备云同步没有新增；当前是AI共享访问口令和共同额度，照片仍属于各自浏览器。
- GitHub此前写入403，不能把本地提交、部署包或Sites源码保存当成已推送GitHub。

## 本次实际检查

| 检查 | 结果 |
| --- | --- |
| Node24自动测试 | 42/42通过，覆盖原有照片/分组/备份/设备功能及12项新增AI/服务端检查 |
| Chromium桌面/手机 | 14条流程均通过，含上传同意、实际JPEG编码、结果转义、保存和重看；手机workspace首轮保存时序超时，补充等待保存成功后定向复测通过 |
| 服务进程 | 实际启动CLI，健康、状态、首页、脚本、CSS及优雅退出检查通过 |
| 运维配置 | Docker Compose 5.6.0 config --quiet、Caddy 2.11.7 validate、两个shell脚本sh -n、git diff --check通过 |
| 验证限制 | 没有Docker守护进程；未构建/运行镜像、未签发公网证书、未调用真实付费API；不代表Android真机验收 |

## 交付与电脑接续

部署ZIP含完整源码、配置模板和上述文档，可直接按SERVER_DEPLOYMENT.md在服务器构建。真实.env、签名、照片、用户数据库、node_modules、测试截图和构建临时文件均不在包中。

包内mobile-changes.patch包含本次手机端相对main@6b1b5e7的全部提交，含0.2.2动效、网页交接与服务器准备。电脑若仍在该main基础上，可先确认工作区干净，在独立分支执行：

```sh
git switch -c feat/server-prep-20261021 6b1b5e7
git am /解压目录/mobile-changes.patch
```

已有未推送修改或已应用旧动效补丁时，先检查提交差异再合并，不能重复git am。不要覆盖电脑signing/或生成新签名。确认后在有权限的电脑推送任务分支并创建PR。本地提交和部署包不代表GitHub已经同步。

持续进度与后续交接见PROJECT_STATUS.md。
