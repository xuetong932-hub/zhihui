# 架构与代码地图

## 运行形态

原生 HTML/CSS/ES Modules 前端，Node.js 内置 HTTP 服务，无第三方运行依赖。无打包器、无数据库运行时、无 React/Flutter/Electron 原生工程。`package.json` 中 `engines` 为 Node >=22。

浏览器请求同源 `/api/*`；服务端仅监听 127.0.0.1，限制 Host 与 Origin、JSON 大小、并发及上游地址；不会把上游原始错误体转发给浏览器。当前这些是本机原型边界，不是完整多用户鉴权或滥用防护。

| 文件 | 职责 |
|---|---|
| index.html / styles.css | 页面壳、响应式布局 |
| app.js | 本地 onboarding、资料校验、中英基础词典、首页、全页 render |
| chat-ui.js | 顶部导航、模型设置、对话状态、各功能模块协调、浏览器语音入口 |
| model-help.js | 模型帮助弹层、首次位置提示、官方帮助链接 |
| providers.js | 无凭据服务商定义、模型配置校验、安全来源 URL |
| model-service.mjs | 请求校验、系统提示、白名单上游地址、请求/错误/来源解析 |
| chat-store.js | 聊天加载、上下文裁剪、HTML 转义、小范围 Markdown 渲染 |
| knowledge-service.mjs | 模型 JSON 提炼和候选匹配返回校验 |
| knowledge-store.js | 知识 schema、日期、重复关联、合并和状态 |
| knowledge-ui.js | 知识库界面、筛选、编辑、历史整理、软删除和恢复 |
| review-service.mjs | 模型出题、文字判题、再次解释，严格 JSON 结构 |
| review-store.js | 排程、事件、队列、模块水平建议；纯逻辑便于测试 |
| review-ui.js | 一题一题会话、作答、反馈、继续练习 |
| device-ui.js | 打开弹窗、页面运行时通知检查、设置、JSON 导出与导入（预览、确认、撤销） |
| cloud-ui.js | Supabase REST OTP/PKCE、AES-GCM 快照、版本冲突与恢复 |
| snapshot-merge.js | 两份学习快照按 ID 合并（导入合并、将来的账号合并），疑似重复卡片计数 |
| local-space.js | 本机数据账号归属、上传前检查、恢复前备份（最多 3 份）、回滚与撤销；纯逻辑便于测试 |
| cloud-schema.sql | RLS 快照表、成年准入表与函数（快照仅对已准入账号开放）、自身账号删除 RPC；未部署 |
| server.mjs | HTTP 入口、静态白名单、服务端 API 路由 |
| sw.js / manifest.webmanifest / icon.svg | PWA 与网络优先离线 shell；不缓存 API 或含查询参数请求 |
| tests/*.test.js | Node 内置自动测试 |
| tests/browser-fixture.mjs | 隔离受控响应服务器，不是产品模式 |

## HTTP 接口

| 路由 | 用途 |
|---|---|
| POST /api/chat | 模型问答 |
| POST /api/test | 强制一个简短测试消息，关闭搜索，不把测试写入聊天 |
| POST /api/extract | 提炼知识；只带单条问答及原模块有限候选标题 |
| POST /api/review-task | task=question / grade / explain |

请求通常包含 config、apiKey、consent、module、level、locale 等。**这是临时单用户本机接口**，apiKey 在请求内存中使用，不持久化于服务端。对外部署前增加认证、按用户/设备/区域授权、限额和严格日志策略。

上游默认：千问中国/新加坡 DashScope，DeepSeek chat/completions。千问联网参数由原生接口返回来源；DeepSeek 当前适配器不搜索。供应商模型、Key 地区和参数是否可用需真实账号核实。

## 浏览器数据

| localStorage key | 内容 |
|---|---|
| knowledge-review.profile.v1 | 语言、dailyMinutes、各模块 enabled/level、成年自报记录；不存生日 |
| knowledge-review.model.v1 | 服务商、model、workspace、search；不含 Key |
| knowledge-review.chats.v1 | version/modules/threads/messages，时间、状态、模型与来源 |
| knowledge-review.knowledge.v1 | cards 与 ignored，origins 保留问题、回答、原模块、消息和日期 |
| knowledge-review.reviews.v1 | events：作答、correct、explanation、rating、interval、due，可选 seconds（答题用时，≤600） |
| knowledge-review.device.v1 | 提醒设置 |
| knowledge-review.cloud.v1 | Supabase URL 与公开 Key（不是服务端 secret） |
| knowledge-review.last-login.v1 | 本设备上次使用的登录方式名（email/phone/google/apple），不含账号 |
| knowledge-review.model-help-seen.v1 | 首次模型说明提示已读 |
| knowledge-review.local-owner.v1 | 本机学习数据所属云账号（项目 URL、用户 ID、脱敏标签、关联时间） |
| knowledge-review.before-cloud-restore | 云恢复前本机备份：`{version:2,entries:[{savedAt,owner,values}]}`，最多 3 份；兼容旧版单份格式 |
| knowledge-review.last-notification | 已提醒日期 |

sessionStorage 使用 `knowledge-review.popup-day` 和 `knowledge-review.pkce`。API Key、云登录 session、同步口令默认仅在页面内存。后续更改键或 schema 必须迁移并保留恢复路径。

**同一电脑不同浏览器、不同端口、localhost 与 127.0.0.1 的数据都可能彼此独立。不要为了重启预览随意换端口或清理用户存储。**

## 云快照

Supabase auth 管理身份，`learning_snapshots` 每 user_id 一行，revision 用于条件更新。客户端使用 PBKDF2-SHA256（310000 次）+ AES-256-GCM，随机 16-byte salt 和 12-byte IV；口令至少 12 字符，云保存密文。Key 可选加入密文。当前手动上传/替换，不是增量/自动同步；有账号归属保护，但没有同一浏览器多人的本地命名空间。

上传前检查本机数据归属：属于其他账号拒绝，未关联须用户确认。云恢复校验后经 `replaceLearningData` 写入并备份原数据，随后各 UI 从存储重新载入，无需刷新。取回模型 Key 后再次确认服务商与发送说明，才允许发模型请求。相关未完成问题见状态文档。

## 排程概览

新卡次日零点；wrong/unclear 约10分钟后；guessed 次日；understood/mastered 按历史间隔增长，最高180天，近期错误后第一次理解仅1天。周日额外纳入本周未当日复习的旧卡。队列顺序：当天重练 → 上次学习日的卡片（最多占当日计划一半）→ 更早到期与薄弱卡。按天的到期以“复习当天本地日期 + 间隔”与当前所在地日期比较（跨时区、夏令时安全），10 分钟重练用绝对时间。计划按真实用时：剩余秒数 ÷ 最近答题用时中位数（默认 90 秒）；当天重练不受计划限制；自主加练最多取100项，也可含未到期卡。

这不是 FSRS。代码中 Date/本地日期/ISO 串交互与跨时区需重点测试。
