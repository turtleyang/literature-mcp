# 当前状态

更新：2026-11-09（Asia/Tokyo）。

本地 `literature-mcp` 第一版实现、依赖安装、编译、项目级部署和中文使用文档已完成。最终类型、46 项离线测试、格式及生产依赖审计通过；当前审计 0 个已知漏洞。详细验收与其边界统一维护在 [docs/verification.md](docs/verification.md)。

公开能力已实际验证：OpenAlex/Crossref 搜索及精确 DOI；arXiv PDF 下载和本地复用；先搜索、再明确选择 DOI、通过合法关联预印本下载的组合流程。两份真实 PDF 保存在被 Git 忽略的 `literature-library/papers`。

客户端现状：Codex 项目配置及独立 App Server 工具发现通过，当前聊天需重新打开加载；实际安装的 Pi MCP Adapter 三工具调用通过。Claude Code/Cursor 仅有教程，未安装验收。没有修改既有全局 MCP 配置。

后续验证需要用户配置 WoS、Wiley、Elsevier、Scopus、Springer 的真实产品凭据和对应 API/TDM 许可；Unpaywall 需真实邮箱。Semantic Scholar 的匿名请求曾 429，尚未取得真实检索/全文成功证据。商业 API 不应在这些条件具备之前自动访问。

当前无需要继续修改代码的已知验收失败。未来扩展和维护按 AGENTS.md、README 与 docs/architecture.md 执行；不把本状态文件作为长期规则或授权证明。
