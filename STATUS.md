# 当前状态

更新：2026-11-09（Asia/Tokyo）。

`literature-mcp` 1.1.0 已完成 Windows/Linux 通用安装器、直接 Node 启动配置、路径处理及跨平台测试；本机 Linux 及 GitHub 原生 Windows/Ubuntu runner 的类型、52 项离线测试、stdio smoke、格式及生产依赖审计均通过，审计 0 个已知漏洞。远程 CI 检查的是源码提交 b2df873；详见 [跨平台回执](docs/cross-platform-ci.json)。详细验收与其边界统一维护在 [docs/verification.md](docs/verification.md)。

公开能力已实际验证：OpenAlex/Crossref 搜索及精确 DOI；arXiv PDF 下载和本地复用；先搜索、再明确选择 DOI、通过合法关联预印本下载的组合流程。三份真实 PDF 保存在被 Git 忽略的 `literature-library/papers`。

客户端现状：Codex 项目配置及独立 App Server 工具发现通过，当前聊天需重新打开加载；实际安装的 Pi MCP Adapter 三工具调用通过。Claude Code/Cursor 仅有教程，未安装验收。没有修改既有全局 MCP 配置。

OpenAlex Key 与 Wiley TDM Token 已配置并通过真实测试。用户已补齐持久配置中的 wiley 授权和 alm.wiley.com 域名；最新复验使用全新 stdio MCP 进程，不提供环境覆盖：OpenAlex 检索 ok，download_paper 通过 Wiley 官方 TDM 实际重新下载并校验测试 PDF，返回 downloaded，SHA-256 与前次一致。订阅内容访问范围尚未验证。具体回执见 [凭据与持久配置复验](docs/credential-test-2026-11-09.json)。

后续仍需配置 WoS、Elsevier、Scopus、Springer 的真实产品凭据和对应 API/TDM 许可；Unpaywall 需真实邮箱。Semantic Scholar 的匿名请求曾 429，尚未取得真实检索/全文成功证据。

当前发布目标为私有仓库 `turtleyang/literature-mcp`；用户选择只发布跨平台仓库，暂不部署服务器。仓库已创建并推送，Windows 和 Ubuntu CI 均已验证成功。新电脑安装入口是 README 的 clone → npm ci → build → setup → smoke，私有 .env 与文献库不随 Git 分发。

当前无需要继续修改代码的已知本机验收失败。未来扩展和维护按 AGENTS.md、README 与 docs/architecture.md 执行；不把本状态文件作为长期规则或授权证明。
