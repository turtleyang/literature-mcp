# 已核对的官方接口与客户端文档

查阅日期：2026-11-09（Asia/Tokyo）。请求契约以固定发布包源码、以下官方资料及实际响应交叉核对；没有真实凭据的接口只做模拟，不由文档推定账户有权限。

- [MCP 官方 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)：stdio Server/Client；本项目固定 SDK 1.32.2，具体类型通过已安装包核对。
- [OpenAlex API](https://help.openalex.org/api/)：works、DOI singleton、author/source ID 过滤与引用计数；本机匿名关键词请求可能返回 429，免费不等于无限请求。
- [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)：关键词和 DOI 精确记录。被引数使用 `is-referenced-by-count`。
- [Semantic Scholar API](https://api.semanticscholar.org/api-docs/graph)：DOI、OA PDF、citationCount 和分页引文。
- [Clarivate Starter](https://developer.clarivate.com/apis/wos-starter)、[官方客户端](https://github.com/Clarivate/wosstarter_python_client)、[Expanded](https://developer.clarivate.com/apis/wos)：Starter 计划不同，被引数权限不同；Expanded 需要另外许可。
- [Wiley TDM](https://onlinelibrary.wiley.com/library-info/resources/text-and-datamining)：`Wiley-TDM-Client-Token`、DOI 路径、重定向、click-through 条款、3 篇/秒及 60 次/10 分钟。官方 DOI PDF 下载接口不提供通用关键词搜索。
- [Elsevier Article Retrieval](https://dev.elsevier.com/documentation/ArticleRetrievalAPI.wadl)：API Key 还需 ScienceDirect/API entitlement；原生 XML，PDF 取决于格式权限；不承诺 HTML/EPUB/MOBI。搜索和全文访问分开处理。
- [Springer Open Access](https://dev.springernature.com/docs/api-endpoints/open-access/)、[Full Text](https://dev.springernature.com/docs/api-endpoints/fulltext-api/)、[端点迁移](https://dev.springernature.com/docs/full-text-api-migration-guide/)、[官方支持说明](https://support.springernature.com/en/support/solutions/articles/6000195668-springerlink-api-details)：OA JSON/JATS 与 Full Text `/xmldata/jats`；TDM 需特殊协议。部分网页渲染抓取正文有限，端点仍需有 Key 后用真实响应验证。
- [arXiv API 手册](https://info.arxiv.org/help/api/user-manual.html)：Atom、ID、DOI 关联和版本语义；PDF 使用官方 arxiv.org。
- [Unpaywall API](https://unpaywall.org/products/api)：按 DOI 查询、真实邮箱、OA 位置；许可字段可能为空。
- [PMC OA Web Service 停用公告](https://pmc.ncbi.nlm.nih.gov/tools/oa-service/)：2026-08 起旧服务停用，不使用历史 oa.fcgi 流程。
- [Europe PMC REST](https://europepmc.org/RestfulWebService)：精确 DOI + OPEN_ACCESS 条件、PMC ID、`fullTextXML`。未将所有可阅读 PMC 内容都认定可以通过 API 下载。
- [Codex MCP](https://developers.openai.com/codex/mcp)：项目与用户配置、stdio。另使用本机 Codex CLI 0.155.1 的帮助及 App Server 生成 Schema 核对实际支持能力。
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)、[Cursor MCP](https://cursor.com/docs/mcp)：项目 JSON/stdin 服务启动方式；本机未安装，教程不等于本机客户端验收。
- [Pi 项目](https://github.com/earendil-works/pi)、[Pi MCP Adapter](https://github.com/nicobailon/pi-mcp-adapter)：以本机 Pi 1.1.0 的 `pi mcp --help`、已安装 Adapter README/实现与连接测试核对当前兼容方式。
