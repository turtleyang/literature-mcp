# 当前状态

更新：2026-11-17（Asia/Tokyo）。

`literature-mcp` 当前源码版本为 1.1.2。支持通过 GitHub 直接以 `npx -y github:turtleyang/literature-mcp` 在任何支持 MCP 的 Agent 中即下即用，已将预编译产物 `dist/` 纳入仓库，并支持用户主目录文献持久存储和环境文件自动回退查找。Windows 物理机（littleplane）实测通过，默认文献调研表格格式已固化。本机 Linux 的类型、56 项离线测试、stdio smoke、格式及生产依赖审计均 100% 通过。

公开能力已实际验证：OpenAlex/Crossref 搜索及精确 DOI；arXiv PDF 下载和本地复用；先搜索、再明确选择 DOI、通过合法关联预印本下载的组合流程。三份真实 PDF 保存在被 Git 忽略的 `literature-library/papers`。

客户端现状：Codex 项目配置及独立 App Server 工具发现通过。2026-11-13 已为本机 Pi 1.1.0 添加用户级 `~/.pi/agent/mcp.json`，复用已安装的 pi-mcp-adapter 7.0.0，在其他目录也可使用；三个文献工具直接加载，Pi SDK + 实际适配器运行时的 WoS Starter 真实检索返回 ok。保留原 Pi 设置、Zotero 配置及私有 .env，没有复制密钥。已打开的 Pi 需 `/reload` 或重启。Claude Code/Cursor 仅有教程，未安装验收。[Pi 安装回执](docs/pi-install-2026-11-13.json)。

2026-11-14 的真实 Pi 对话先复现了 Starter 误传 record_view 和数据库范围误判，后又发现模型将 MCP 未暴露分页/总数说成 Starter API 不支持。1.1.1 已在工具与字段说明中区分这些能力，并让 WoS 来源状态返回数据库、产品、版本及 API 能力，retrieval 明确标记当前封装的限制范围。只过期并刷新 literature-mcp 的 Pi 缓存，当前缓存定义已与服务实际 listTools/instructions 核对一致。

最终在 Pi 默认 gpt-5.6-terra、默认工具集/扩展/技能发现下完成真实完整工作流：search_literature → 同一 DOI 的 get_paper → 已验证 QA PDF 的 download_paper 本地复用，三个调用均一次成功；另以用户原错误报告作回归，Pi 正确说明 Starter 支持核心合集与字段查询、API 支持分页和总数、当前 MCP 未暴露这些接口。私有 .env、Pi 设置、用户级 MCP 配置、Zotero 配置及 QA PDF 保持不变。保留初次失败、中间误判、一次尚未调用 MCP 即被终止的未完成运行及最终通过记录。[Pi 真实对话回执](docs/pi-e2e-2026-11-14.json)。

OpenAlex Key 与 Wiley TDM Token 已配置并通过真实测试。用户已补齐持久配置中的 wiley 授权和 alm.wiley.com 域名；最新复验使用全新 stdio MCP 进程，不提供环境覆盖：OpenAlex 检索 ok，download_paper 通过 Wiley 官方 TDM 实际重新下载并校验测试 PDF，返回 downloaded，SHA-256 与前次一致。订阅内容访问范围尚未验证。具体回执见 [凭据与持久配置复验](docs/credential-test-2026-11-09.json)。

WoS Starter v1 已于 2026-11-13 通过本机真实凭据及持久配置复验。用户已将 Key 移到 WOS_API_KEY；新一轮检查发现尚缺版本和本地授权，助手仅补齐 WOS_STARTER_VERSION=v1 与 LITERATURE_AUTHORIZED_APIS=wiley,wos_starter，保留密钥、其他配置和文件权限。随后新 stdio 进程不加任何环境覆盖，search_literature 返回 ok、cached=false、1 篇真实论文，WoS 被引次数 11，来源耗时 3305 ms。[Starter 脱敏回执](docs/wos-starter-test-2026-11-13.json)。

此前 [Expanded HTTP 403](docs/wos-expanded-test-2026-11-13.json) 是不同产品的访问结果，不代表 Starter Key 不可用。当前持久配置已可供新进程直接读取；已运行的 Agent 需重启 MCP 连接才能加载更新。Expanded FR、引用关系及 Starter v2 未测试。

若需启用 WoS Expanded、Elsevier、Scopus、Springer，仍需对应真实产品凭据和 API/TDM 许可；Unpaywall 需真实邮箱。Semantic Scholar 的匿名请求曾 429，尚未取得真实检索/全文成功证据。

当前发布目标为私有仓库 `turtleyang/literature-mcp`；用户选择只发布跨平台仓库，暂不部署服务器。仓库已创建并推送，Windows 和 Ubuntu CI 均已验证成功。新电脑安装入口是 README 的 clone → npm ci → build → setup → smoke，私有 .env 与文献库不随 Git 分发。

1.1.1 已在本机编译并生效，按用户指令纳入 main 分发；提交与推送状态以实际 Git refs 为准。私有 .env、文献库、本机客户端配置及 .local 原始日志不随分发。

Pi 浏览器扩展启动错误的后续核验：已确认此前被终止的测试留下一个后台 Edge，工作目录与该次测试相同，浏览器锁也指向该 PID。仅对该测试进程发送 Browser.close 平稳关闭，未删除配置或登录数据。实际 Pi SDK 重新加载 pi-browser-use 后注册 34 个工具，browser_doctor 成功、扩展错误 0，并已正常关闭测试连接。没有修改浏览器扩展或用户设置，也未验证网站操作。[后续回执](docs/pi-e2e-2026-11-14.json)。

本轮 Pi 使用调试已完成。已打开的 Pi 需 `/reload` 或重新连接文献服务以加载更新后的定义；没有操作用户原交互会话。当前 MCP 仍是有界候选检索，未新增全量分页导出或第四个工具。未来扩展和维护按 AGENTS.md、README 与 docs/architecture.md 执行；不把本状态文件作为长期规则或授权证明。

## Windows 宿主机实测部署与客户端直启基准：2026-11-16 ~ 2026-11-17

已通过 SSH 在用户 Windows 宿主机（`littleplane`，Windows 11 x64，Node.js v24.15.0，npm 11.12.1，Pi 1.4.0）完成完整克隆、构建与 Pi 挂载。部署位于 `D:\code\literature-mcp`，预装产物位于 `C:\Users\54509\.dsh\mcp-servers\literature-mcp`。

验证结果与基准分析如下：
1. **原生离线检查**：Windows 环境下 56 项测试全部通过（含驱动器根、UNC 根、短路径名与大小写规范化校验），stdio smoke 通过，代码格式一致，依赖审计 0 漏洞。
2. **私有凭据与 Doctor 校验**：持久配置 `.env` 安全复制至 Windows 端，`npm run doctor` 确认 Node v24.15.0、存储目录 `D:\code\literature-mcp\literature-library`、wiley 与 wos_starter 授权状态正常。
3. **Pi 全局客户端挂载与 Windows 启动陷阱定位（2026-11-17 实测）**：
   - **`spawn npx ENOENT` 踩坑**：MCP 客户端底层普遍使用 `child_process.spawn(command, args, { shell: false })`。Windows 上 `npx` 实为 `npx.cmd`，且 Node 24 严格禁止在无 shell 模式下隐式执行 `.cmd` 文件，直接抛出 `SPAWN_ERROR ENOENT spawn npx ENOENT`。
   - **`cmd /c npx -y github:...` 方案**：每次启动均需动态克隆仓库并安装 163 个依赖，冷启动耗时长达 **73 秒**，无法满足交互实时性且依赖外网。
   - **预装副本 + `node dist/server.js` 直启（最佳实践，已采纳）**：在预装目录（`C:\Users\54509\.dsh\mcp-servers\literature-mcp`）由原生 `node` 直启预编译的 `dist/server.js`，冷启动仅需 **约 1 秒**，零依赖外部网络，秒级响应。
4. **真机端到端调用闭环**：通过 `verify-pi-windows.mjs` 与 `online-test.mjs` 实测：
   - `search_literature`（fast 模式，OpenAlex + Crossref）返回 3 篇，status=ok。
   - `search_literature`（wos 模式，WoS Starter v1 核心合集）真实检索返回 10 篇，status=ok。
   - `get_paper`（精确 DOI `10.1038/nphys1170`）返回元数据，status=ok。
   - `download_paper`（arXiv `1706.03762v7`）真实下载官方 PDF 并通过严格格式校验，保存至 `D:\code\literature-mcp\literature-library\papers\`；随后二次调用正确返回 `already_exists` 本地复用。
5. 验收回执保存在 [Windows Pi 回执](docs/pi-windows-receipt.json) 与 [Windows 在线结果](docs/online-results-windows.json)。


