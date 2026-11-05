# 知回 / KnowBack

可运行的学习应用本地原型，v0.4.0，交接快照日期 2026-11-01。

**Claude 接手请先读 [START_HERE.md](START_HERE.md)，再读 [CLAUDE.md](CLAUDE.md)。**

- [完整用户需求](docs/REQUIREMENTS.md)
- [当前状态、已知问题与后续优先级](docs/STATUS_AND_NEXT_STEPS.md)
- [架构、文件地图、API 与数据结构](docs/ARCHITECTURE.md)
- [启动和验收流程](docs/ACCEPTANCE.md)
- [云项目接通说明](cloud-setup.md)
- [历史开发记录（含过时描述，仅参考）](docs/DEVELOPMENT_HISTORY.md)

## 运行

需要 Node.js 22+；建议 Node.js 24 LTS。当前无第三方运行依赖，不需要先安装 npm 包。

```sh
npm run check
npm test
npm start
```

默认地址 http://127.0.0.1:4174/ 。Windows PowerShell 可设置 `$env:PORT = '4180'` 再运行 `npm start`；macOS/Linux 可运行 `PORT=4180 npm start`。仅监听本机。

隔离验收：`node tests/browser-fixture.mjs`，默认端口 4175，支持 `QA_PORT` 环境变量；其响应是明确标注的测试内容，不连接真实模型。

## 状态摘要

已有本地 onboarding、中英界面、模型配置、帮助链接与首次提示、文字问答、知识整理、重复重点、逐题复习、初始间隔排程、语音入口、通知授权设置和导出功能。

模型、搜索、提炼与判题需用户自己的 Key；云账号与加密备份需要真实 Supabase 配置，目前只有接入代码及 SQL，未完成真实多用户联调。后台定时推送、原生安装包、账号绑定与服务端年龄控制尚未完成。PWA 清单不是原生应用成品。

浏览器学习数据不在源码目录，不随 ZIP 搬迁；更换端口或浏览器可能看到全新空间。API Key 默认只在页面内存，云同步时仅在用户勾选后加入加密密文。App 需要登录：运行前设置 `SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY`（见 cloud-setup.md）；没有云项目时可用 `node tests/browser-fixture.mjs` 的假账号服务体验，验证码为 123456。

用户最终目标是中国及海外多端应用，当前暂缓发布；不再逐步等待确认。不要把曾讨论的预算建议视为购买授权。

交接包里的 `VALIDATION_REPORT.txt` 为本次检查结果，`FILE_MANIFEST.sha256` 用于核对快照内容。
