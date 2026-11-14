# 上游审查

日期：2026-11-09（Asia/Tokyo）。审查仓库：[Dianel555/paper-search-mcp-nodejs](https://github.com/Dianel555/paper-search-mcp-nodejs)，Git HEAD `de5a35d941994d06ac5f6fcb660b29243a72cece`，只读检出位于开发时的 `/tmp/literature-upstream-review`。运行时固定使用 npm `paper-search-mcp-nodejs@0.3.3`，其发布包完整性由 `package-lock.json` 校验，不把仓库 HEAD 与发布包内容假定完全相同。

许可证为 MIT，允许独立封装和复用。主项目没有复制/修改上游源码，运行时由独立 MCP Client 连接其 `dist/server.js`，不执行 npm lifecycle scripts。上游依赖包括 MCP SDK、Axios、Cheerio、xml2js、pdf-parse、速率/缓存工具等；安装前已检查 package.json 启动与安装脚本。

已阅读 README、package.json、Paper 模型、MCP 工具/Schema/调用处理、Crossref、arXiv、Wiley、Springer、ScienceDirect、WoS 适配器及对应测试；对 Scopus/Semantic Scholar 的元数据和认证路径按实际复用需求增量核对。

| 模块 | 真实实现 | 本项目采用方式 |
| --- | --- | --- |
| Crossref | 关键词和 DOI 元数据；部分字段归一化有损 | 复用关键词搜索，精确 DOI 原始数据独立补全 |
| WileySearcher | 只支持 TDM DOI 下载，不支持关键词检索；Token 头及官方端点存在 | 复用其已核实的 API 契约；独立实现受控下载，未调用其直接写文件方法 |
| SpringerSearcher | Metadata v2 与 OA 搜索，OA 能力探测，取 PDF URL | 复用元数据搜索；精确 OA 及 JATS/TDM 下载独立封装，避免其宽松 DOI 搜索与直接落盘 |
| ScienceDirectSearcher | Search 使用 PUT；Article 方法主要读元数据/摘要，PDF 方法主动报不支持 | 复用 Search；新增单独的 Article Retrieval 全文适配器 |
| WebOfScienceSearcher | Starter v2 默认；独立 Expanded Key、SR/FR、references/citing/related 端点，速率和本地配额 | 复用搜索与显式引文调用；禁用额外网页发现；保留产品独立授权 |
| arXiv | Atom 搜索和直接 PDF 写入 | 复用搜索；下载改由官方 ID/版本解析 + 统一安全存储层执行 |

上游旧下载路径直接写最终文件，不能满足这里要求的完整性、原子落盘、精确身份与安全目录边界。因此新增独立下载适配层，未修改上游文件。

Wiley、Springer 等上游测试有不少仅检查方法存在，不能据此认定网络契约或真实授权下载已验证。本项目增加行为测试；另外直接加载固定发布包的 WoS 类，以模拟 HTTP 验证 Starter 的真实请求 URL、Key、查询以及 Expanded FR 与独立 Key。

上游还包含 Sci-Hub、Google Scholar 和 ScrapingAnt 路径。本项目不暴露这些路径，不调用 `all`，对子进程显式禁用相关可选能力，也不转发其凭据。

首次安装审计发现上游 Zod 3.x 命中 GHSA-mrhx-c7xc-m3w5。主项目通过 scoped npm override 固定其 Zod 为 4.6.7，没有修改上游源码；原始上游 WoS HTTP 合约、真实 Crossref 搜索和 stdio 连接已验证兼容。最终 `npm audit --omit=dev` 的结果见验收记录。

正常请求复用一个子进程；关闭与异常超时处理有独立生命周期。上游部分网络请求不能完全处理 MCP 取消，因此本项目在超时/取消时关闭共享进程，下一次重新建立连接。

## WoS 能力契约补核：2026-11-14

固定包仍为 0.3.3。Starter 搜索客户端在未指定数据库时向 v1/v2 documents 端点发送 db=WOS；Expanded 使用 databaseId=WOS。上游 MCP handler 未提供数据库切换参数，本项目当前路由也未覆盖默认数据库，因此两种产品的该路由均指向核心合集；Starter 并不依赖 Expanded 才能执行 TS/TI/AU/SO/PY/DO 等支持字段查询。实际固定类的 HTTP Mock 已同时断言 v1/v2 的 URL、db=WOS、认证头、查询及零被引计数，并断言 Expanded 的 databaseId。

Starter 官方 API 支持 page/limit，响应 metadata.total 提供总命中数；上游检索类会读取这些值用于其内部取回，但本项目的有界数组接口未透出翻页或总数。1.1.1 的 api_capabilities 与 retrieval.limitation_scope 区分产品能力和当前 MCP 封装限制。来源见 [Starter OpenAPI](https://developer.clarivate.com/apis/wos-starter/swagger)；不修改上游源码，也不因本地声明推定账户权限。
