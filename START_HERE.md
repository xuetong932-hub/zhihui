# 给 Claude 的交接入口

交接日期：2026-11-01（Asia/Singapore）。项目：知回 / Knowledge Review，package 版本 0.4.0。

你接手的是已有可运行代码的学习应用，不是从零设计任务。用户已要求继续自主实现，不再每一步询问确认；发布、申请收费服务或购买账号不在当前授权范围。

## 建议阅读顺序

1. `CLAUDE.md`：工作方式、启动命令、马上可以开始的任务。
2. `docs/REQUIREMENTS.md`：用户最终需求及决定，不依赖原聊天。
3. `docs/STATUS_AND_NEXT_STEPS.md`：完成边界、验证证据、待修问题、后续优先级。
4. `docs/ARCHITECTURE.md`：代码地图、接口、数据结构和本地存储。
5. `docs/ACCEPTANCE.md`：从本地启动到逐功能验收的步骤。
6. `cloud-setup.md` 和 `cloud-schema.sql`：真实云项目配置入口。
7. `docs/ACCOUNT_DESIGN.md`：服务端年龄准入、登录方式绑定与账号合并的设计稿（未实现）。

历史版本的 `docs/DEVELOPMENT_HISTORY.md` 仅供参考，包含过时的阶段说明；不要把其中“尚未实现”“等待确认”当作当前状态。当前状态以本入口及上述文档、实际代码为准。

## 立刻运行

需要 Node.js 22+，建议 Node.js 24 LTS。当前没有第三方 npm 依赖，不必先执行 npm install。

```sh
npm run check
npm test
npm start
```

默认浏览器地址：`http://127.0.0.1:4174/`。交接机器此前预览运行在 4180，二者不是自动等价的数据地址。

Windows PowerShell 指定端口：

```powershell
$env:PORT = '4180'
npm start
```

macOS/Linux：

```sh
PORT=4180 npm start
```

不需要真实模型 Key 就能运行语法检查、自动测试、浏览界面。隔离测试服务可演示问答流程，不调用外部模型，见 `docs/ACCEPTANCE.md`。

## 包内与包外

包内有完整源码、测试、当前需求、交接说明、云数据库脚本、校验清单和本次验证报告。没有真实 API Key、登录 Token、同步口令、浏览器学习数据、云服务账号、进程状态或签名证书。

浏览器 localStorage 与进程不随 ZIP 迁移。若用户以后需要搬迁个人学习记录，使用旧应用“设备 → 导出 JSON 备份”，另行获得用户授权后处理，不要向用户索取粘贴到聊天的 Key。

## 可以直接给 Claude 的开工指令

> 请接手这个交接包中的“知回”项目。先阅读 START_HERE.md、CLAUDE.md 和 docs 下的需求/状态文档，运行检查和测试，保留已有可用功能。从 STATUS_AND_NEXT_STEPS.md 的 P0 项开始修复并补充必要测试，再持续实现产品需求。不要重新询问已确认的需求，不要每完成一步就停下来确认。真实服务缺少配置时继续完成其他可验证工作，并准确报告未接通部分；不要申请收费服务或发布应用。
