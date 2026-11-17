# 验收记录

日期：2026-11-09（Asia/Tokyo）。所有测试均在用户本机 Linux x86_64 执行，非云端或远程代跑。JSON 回执使用 UTC 时间，本文日期使用 JST。

## 环境与安装

- 初始工作区为空、未启用 Git；没有既有业务文件或未提交改动被覆盖。
- Node.js `v24.19.0`：`/home/xianiming/.nvm/versions/node/v24.19.0/bin/node`；npm `12.0.2`；Git `2.43.0`；Codex CLI `0.155.1`；Pi `1.1.0`。
- 项目本地 TypeScript `7.0.2`；官方 MCP SDK `1.32.2`；依赖完整固定于 package-lock.json。
- 安装使用 `npm install --ignore-scripts`，没有管理员操作、全局 npm 安装或新增系统服务。
- 已生成项目级 `.codex/config.toml` 与 `.mcp.json`，没有修改原有全局 MCP 配置。私有 `.env` 权限为 600，没有真实 API Key。
- 本机 Clash TUN 使用 Fake-IP DNS，已为核验过的官方域名配置精确兼容名单。未修改系统 DNS/代理、未关闭 TLS 校验。

## 离线与静态检查

最终 `npm run check` 通过：类型检查、46 项自动测试、格式检查、生产依赖审计。审计结果为 **0 个已知漏洞**，只代表本次 npm audit 数据，不等于对全部代码作出无漏洞保证。[原始输出](offline-test-results.txt)

测试覆盖：

- fast / deep / WoS 来源选择、独立 WoS Key、DOI 去重、分库计数、未知与零、年份后过滤、稳定作者/期刊 ID。
- 引用排序先选相关候选再本地排序；避免宽松匹配被全库高被引条目挤占。
- 真实固定上游 WoS 类的 HTTP Mock：Starter v2、请求头、查询、实测零；Expanded 独立 Key 与 FR。
- Expanded 精确元数据及最多 20 条 citing 请求路由。
- Wiley DOI/Token、无 Token、无授权、403 无效 Token、404 订阅语义、HTTPS 重定向与跨域去凭据。
- Springer OA 的精确 DOI PDF 和 JATS；Elsevier 授权失败、XML 保真保存；Springer OA 同样遵守 allow_publisher_api。
- Unpaywall 精确 DOI OA 候选、Europe PMC OA+DOI+PMC ID、arXiv ID/DOI/版本关系。
- 不以相似论文替代；PDF MIME/文件头/EOF/页树/前两页身份、版本替换拒绝、XML DOI 与真实 body 检查。
- JATS 可保留正常外部 DTD 声明，但不加载 DTD、不展开实体；实体声明拒绝。
- 大小限制、断流、坏内容、临时文件清除、路径越界、符号链接、已有未知文件保护、本地哈希损坏。
- 多候选按序尝试，OA 成功即停止，无凭据/无授权不访问商业端点；Wiley 共享限速持久化。
- SSRF、401/403 不重试、429 Retry-After、一次有界 5xx 重试、超时与取消。
- 通过官方 SDK 的真实 MCP 协议层完成搜索 → 精确元数据 → 明确选择一篇下载 → 本地复用；只发现三个工具。

以上出版社内容均为**模拟响应**，不代表真实账户、订阅或全文接口已获得许可。

## 真实联网工作流

| 验收项 | 实际结果 | 证据 |
| --- | --- | --- |
| A：diamond thermal conductivity measurement | 最终 OpenAlex + Crossref 均 `ok`，返回真实 DOI | [最终回执 A](final-search-results.json) |
| B：WoS TS 查询 | 仅 WoS Starter，返回 `not_configured`；没有转而搜索公开库 | [首次在线回执 B](online-results.json) |
| C：精确 DOI | `10.1038/nphys1170`、`10.1103/revmodphys.94.025002` 及选定研究论文成功匹配 Crossref/OpenAlex | [在线回执 C](online-results.json)、[选定综述元数据](workflow-selected-metadata.json) |
| D：arXiv OA PDF | `1706.03762v7` 下载成功，15 页，2,215,244 字节；第二次 `already_exists` | [在线回执 D](online-results.json) |
| E：Wiley | 对官方示例 DOI `10.1111/1467-923x.12168` 返回 `credentials_required`；没有 Wiley Token，未做真实 TDM 请求 | [在线回执 E](online-results.json) |
| F：近五年候选 → 指定 DOI → 合法全文 | 2022–2026 检索；选定硅/金刚石界面论文 DOI `10.1016/j.ijthermalsci.2025.109876`，通过关联 arXiv `2407.15404v1` 保存预印本，23 页，2,649,751 字节；显式禁止出版社 API | [最终候选 F](final-search-results.json)、[指定 DOI 下载](selected-doi-download.json) |

A 的示例论文：`10.1016/s0925-9635(00)00515-x`，Thermal conductivity measurements on CVD diamond。F 的选定论文标题为 Accurate estimation of interfacial thermal conductance between silicon and diamond enabled by a machine learning interatomic potential。检索返回候选，不由 MCP 自动认定其代表性。

F 下载后另以官方 arXiv Atom API 确认精确 DOI、标题与 `v1`，给测试索引补充版本，没有重复下载 PDF；最新代码会在下载未带版本的 arXiv 候选前完成这一解析。文件首页的标题、作者与记录另用本机 `pdftotext` 对照。`pdfinfo` 独立确认两份 PDF 分别为 15/23 页、无加密、无 JavaScript。

真实文件：

```text
literature-library/papers/72fd78a7f5e21204f1711586911778117427780ea5c16c0d9d712c77b093f3e2.pdf
SHA-256 bdfaa68d8984f0dc02beaca527b76f207d99b666d31d1da728ee0728182df697

literature-library/papers/c179dfc42002305e9f9cdc4e532fbf039cafbc7694ba3f17083cc303dead41b5.pdf
SHA-256 deae1719299b3dc4d216f555748556c9c18dbb75056ba94ebcf6ef8470c5410a
```

过程中曾遇 OpenAlex 匿名搜索和 Semantic Scholar 的 429，均保留真实状态并返回其他来源结果。最终 A/F 的 OpenAlex 与 Crossref 检索恢复成功；Semantic Scholar 的真实 OA/引文检索仍未验收通过。`online-results.json` 保留早期试运行，其中 F 为引用排序修正前的候选；最终候选以 `final-search-results.json` 为准，没有覆盖历史失败证据。

一次对综述 `10.1103/revmodphys.94.025002` 的自动全文尝试未发现已验证的 OA 文件，补充 Semantic Scholar 时 429，正确返回 `rate_limited`，没有将其声称为不存在或伪造 PDF。[失败回执](workflow-download.json)

## 客户端与部署

- 官方 MCP SDK stdio：三个工具实际发现和调用，stdout 无非协议输出。
- Codex：本机 CLI 识别项目配置；独立 App Server 真实启动并发现三个工具。`authStatus:unsupported` 表示该 stdio 服务不使用 OAuth，不表示工具不可用。
- Pi：使用实际已安装的 `pi-mcp-adapter` 的 `McpServerManager`，真实连接、发现并调用三个工具；未发起 Pi LLM 会话，未替用户确认项目 trust。
- Claude Code / Cursor：未安装，未作端到端验证；已按官方文档提供配置教程。
- 当前 Codex 聊天的原生工具集合尚未刷新；需要重新打开本项目聊天/重新连接。不能把外部 App Server 检查说成当前聊天已原生加载。
- 已从 `/tmp`、仅含系统 PATH（不含 nvm）的环境调用固定启动脚本，核对不依赖终端初始化。没有实际重启整台电脑；本地配置、编译产物和启动器会持久保留，联网仍依赖用户网络条件。

[客户端回执](client-results.json)、[最小环境 stdio 验证](final-deployment-results.json)。

## 尚待用户凭据或许可的验收

- WoS Starter、Expanded：真实 Key、计划额度、被引计数和 FR/关系权限。
- Wiley：真实 TDM Token、机构协议和订阅内容许可。
- Elsevier / Scopus / ScienceDirect：对应 API Key；全文另需 Article Retrieval entitlement 与格式许可。
- Springer Metadata / OA / Full Text：各产品 Key，TDM 另需协议。
- Unpaywall：真实联系邮箱。OpenAlex/Semantic Scholar 免费 Key 可改善匿名限流，但不保证无限额度。
- Europe PMC 真实 XML 全文及各出版社真实 PDF/XML 请求未在线验证；没有因 Mock 通过而报告已验证。

## 后续凭据验证：2026-11-09

本节更新上文初次构建时尚无 OpenAlex/Wiley 凭据的历史状态，不改写原始回执。用户在私有 .env 中填写凭据并明确要求测试后，在同一本机执行以下真实检查：

- OpenAlex：使用实际读取的 Key，通过项目 stdio MCP 的 search_literature 工具只检索 OpenAlex，返回 ok、3 篇真实论文及 DOI，来源耗时 3228 ms。
- Wiley：仅为本轮测试临时启用 wiley 授权。对开放获取论文 10.1002/aelm.202400387，官方 api.wiley.com 返回 302 到 alm.wiley.com，随后 HTTP 200、application/pdf。跨域时不携带 Token。
- 首次 MCP 下载失败源于本机 Fake-IP DNS 的精确域名白名单缺少 alm.wiley.com。测试进程在验证官方 HTTPS 重定向来源后只补充该域名，真实下载及校验成功；没有关闭 TLS 或内网访问保护。
- PDF 为 9 页、3,491,719 字节，前两页识别到目标 DOI，经过完整 PDF 结构解析，随后使用项目存储层保存文件及 SHA-256。只下载此一篇指定 OA 测试论文，未测试订阅内容权限。
- 私有 .env 未修改；当前持久授权名单仍为空。常驻调用需要在原列表分别加入 LITERATURE_AUTHORIZED_APIS=wiley 和 LITERATURE_TRUSTED_FAKE_IP_HOSTS 中的 alm.wiley.com（保留其他原有项）。

[脱敏凭据测试回执](credential-test-2026-11-09.json)保留了首次失败、重定向诊断与成功文件记录；不包含任何 Key/Token 值。源代码未变更，本轮没有将离线 Mock 当成真实凭据验证。

### 用户补齐持久配置后的复验

仍在 2026-11-09 的同一本机，确认 .env 的 wiley 授权和 alm.wiley.com 域名均已生效，且没有重复配置名。用正常 scripts/start.sh 启动全新 stdio MCP 进程，没有设置任何临时环境覆盖。

- search_literature：仅 OpenAlex，返回 ok，带 Key 查询耗时 2283 ms。
- download_paper：对先前同一篇 OA 测试论文显式 overwrite=true，确保走真实 TDM 下载而非本地缓存；返回 downloaded、wiley_tdm、pdf、verified=true，下载阶段耗时 17746 ms。
- 文件 3,491,719 字节，SHA-256 与前次完全一致。本轮仅覆盖本项目自己生成的同篇 QA 测试文件，未修改私有 .env、其他论文或源代码。

完整回执保存在 credential-test-2026-11-09.json 的 persistent_configuration_retest 字段；前面临时授权与白名单缺失的记录属于历史测试，不再代表当前配置。

## 1.1.0 跨平台发布准备

- 本机 Linux：51 项离线测试、类型、格式、生产依赖审计及隔离的原生 stdio smoke 通过。
- 新增 setup 保留私有配置、Windows/POSIX 客户端路径、盘符/UNC 根及 Windows 大小写规范化测试。
- setup 已在现有 checkout 执行，原有 .env 内容哈希保持不变；本机旧配置保留，新 Cursor 配置仅按需创建。
- GitHub 私有仓库已创建，Windows 与 Ubuntu 的 Actions 结果将在发布后单独核对。本段不把 Linux 的路径模拟当成 Windows 原生测试。
- 用户选择暂不部署服务器；此前只读环境检查没有在服务器安装软件、写入项目、凭据或文献。

### 1.1.0 最终跨平台验收

GitHub 私有仓库：[turtleyang/literature-mcp](https://github.com/turtleyang/literature-mcp)。[成功的 Windows/Ubuntu Actions](https://github.com/turtleyang/literature-mcp/actions/runs/42555589452) 实测源码提交 `b2df87329c96364a32c9506dcf501c62b5e104b5`，两端均完成 52 项测试（52 pass、0 fail、0 skipped）、原生 stdio smoke、格式和审计；不是在 Linux 中模拟 Windows 后作出的成功结论。[机器可读回执](cross-platform-ci.json)。

首轮 Windows CI 暴露了 realpath 规范化与短路径目录别名造成的拒绝，修复后按目录卷号和文件 ID 确认同一性，仍保留路径越界、symlink 和 junction 拒绝；另通过 .gitattributes 固定源码 LF，避免 Windows checkout 影响格式。初轮失败保留在 Actions 历史中。

发布前已从干净的本地 Git clone 重新安装固定依赖、编译、生成缺失配置并跑 stdio smoke；当前真实私有 .env 内容哈希未变，三份已有 PDF 再校验和复用成功。检查了待推送内容和全部本地 Git 历史，未发现本次真实 OpenAlex/Wiley 凭据。私有 .env、本机客户端配置、SSH 私钥、node_modules 和 PDF 均未提交。

Windows 的真实出版社账户/机构网络下载、Windows 各 Agent 的完整交互仍不等于 CI 验收；CI 没有使用任何真实凭据。服务器按用户选择未部署，没有在 hermes 安装 Node、写入项目、凭据或文献。

## WoS Expanded 凭据测试：2026-11-13

本次在用户本机 Linux 执行真实联网测试。doctor 确认 WOS_EXPANDED_API_KEY 已被读取，持久授权列表仍只有 wiley。按用户明确的测试请求，仅在新 stdio MCP 测试进程中增加 wos_expanded，没有修改私有 .env 或扩大其他来源权限。

- search_literature 仅选择 WoS Expanded，查询 `TS=("diamond" AND "thermal conductivity")`，SR、最多 1 条。来源返回 failed、通用上游错误，耗时 2303 ms；没有回退公开库，没有返回论文。
- 为辨别通用错误，随后向官方 `https://api.clarivate.com/api/wos/` 发出一次相同参数的直接请求，使用 X-ApiKey 请求头，不重试。HTTP 403、JSON 提示 `You cannot consume this service`，耗时 2045 ms。
- 结论是当前凭据不能访问该 Expanded 服务；尚未确定是应用订阅、审批、机构许可还是 Key 与应用配置不匹配。403 本身不能证明 Key 字符串填写错误。[官方访问说明](https://developer.clarivate.com/help/api-access)说明 Key 绑定应用及订阅计划；[Expanded 产品说明](https://developer.clarivate.com/apis/wos)要求付费许可。
- 短记录检索失败后没有继续消耗 FR 或引用关系请求；未测试 Starter 或全文下载。没有记录凭据值，.env 内容哈希核验保持不变。源码及固定依赖未改动，本次未重跑离线测试，不将已有 Mock 结果作为真实许可通过证据。

[脱敏测试回执](wos-expanded-test-2026-11-13.json)。以上记录仅针对 Expanded；随后用户提供了 Starter 地址，产品对应关系与当前配置建议以下节为准，不应由 Expanded 的 403 推断 Starter 不可用。

### 用户提供 Starter v1 地址后的复验

同日用户提供官方邮件中的 `https://api.clarivate.com/apis/wos-starter/v1/`。[官方 OpenAPI](https://developer.clarivate.com/apis/wos-starter/swagger)列出 Starter v1/v2 的独立服务地址、X-ApiKey 认证和 `/documents` 检索路径；本次使用邮件中的 v1，没有再向 Expanded 发请求。

- 在同一本机 Linux 启动全新 stdio MCP 测试进程。将现有 WOS_EXPANDED_API_KEY 的值仅在测试进程中映射到 WOS_API_KEY，设置 WOS_STARTER_VERSION=v1，在原 wiley 授权上临时增加 wos_starter。私有 .env 内容哈希核验未变。
- search_literature 使用 mode=wos、wos_product=starter、max_results=1，查询 `TS=("diamond" AND "thermal conductivity")`；返回 ok、cached=false，来源 wos_starter 耗时 1875 ms，没有查询其他数据库。
- 返回论文：Role of diamond particle size in maintaining high-temperature thermal conductivity of Al/diamond composite，2025，CERAMICS INTERNATIONAL，DOI `10.1016/j.ceramint.2025.06.299`，UID `WOS:001567956700028`，WoS Starter 被引次数 11。本次结果证明该 Key 可调用 Starter v1，不能据此推定具体订阅计划或 Expanded 权限。
- 原 Expanded 403 记录保留为不同产品的历史请求；先前要求优先核对 Expanded 订阅的排障方向不适用于用户现在提供的 Starter 地址。没有测试 Starter v2、Expanded FR/关系或全文下载；源码与依赖未变。

正常启用应将现有 Key 从 WOS_EXPANDED_API_KEY 移到 WOS_API_KEY，设置 `WOS_STARTER_VERSION=v1`，并将授权行设为 `LITERATURE_AUTHORIZED_APIS=wiley,wos_starter` 后重启 MCP。[Starter 脱敏回执](wos-starter-test-2026-11-13.json)。

### 用户修改 .env 后的持久配置复验

同日用户告知已修改 .env 并要求新一轮测试。实际配置中 WOS_API_KEY 已有值、Expanded Key 已清除，但没有 WOS_STARTER_VERSION，授权仍只有 wiley；没有同名重复配置，也没有继承的相关环境变量覆盖文件。首次全新 stdio 调用返回 restricted，明确要求本地授权 wos_starter，该次未访问官方接口。

随后仅补齐私有 .env 的 WOS_STARTER_VERSION=v1，以及授权列表中的 wos_starter；保留原 wiley 授权、全部密钥值、其他配置及文件权限。再次启动全新 MCP 进程，不传入 env 覆盖：

- 工具发现正常，仅有 search_literature、get_paper、download_paper 三个工具。
- 同一 TS 查询仅访问 Starter，max_results=1；返回 ok、cached=false、来源耗时 3305 ms。
- 返回同篇 DOI `10.1016/j.ceramint.2025.06.299`，UID `WOS:001567956700028`，WoS Starter 被引次数 11。测试期间 .env 内容哈希保持不变；新启动的服务可以直接使用持久配置。

原始拦截、配置补齐和最终成功均追加到 [同一脱敏回执](wos-starter-test-2026-11-13.json) 的 persistent_configuration_retests、persistent_configuration_correction 及 current_conclusion，保留此前临时测试记录。此次没有修改源码或固定依赖，没有重新下载全文，也未将其他产品权限视为已通过。已运行的 MCP 连接仍需重启加载配置。

## Pi 用户级安装：2026-11-13

用户要求给本机 Pi Agent 安装此服务。本机为 Pi 1.1.0、pi-mcp-adapter 7.0.0，适配器已按现有设置接管内建 MCP；此前文献服务只有项目 `.mcp.json`，用户级标准 MCP 文件中仅有原 Zotero 服务。

- 使用实际 Pi CLI 的 `mcp add` 新建 `~/.pi/agent/mcp.json`，只加入 literature-mcp；Node 与 dist/server.js 使用现有绝对路径，exposure=direct。没有安装或更新额外软件包，没有复制任何 API Key。
- 适配器配置加载器在项目之外的 `/tmp` 同时识别 zotero 与 literature-mcp，没有项目级文献配置参与。原 Zotero 配置、Pi settings 和项目私有 .env 内容哈希保持不变。
- 通过已安装 Pi SDK 加载实际 pi-mcp-adapter 扩展，在 `/tmp` 创建内存会话并执行 session_start。扩展无加载错误，三个文献工具均注册且激活：literature-mcp_search_literature、literature-mcp_get_paper、literature-mcp_download_paper。
- 从该 Pi 工具运行时调用 search_literature，只查询 WoS Starter、最多 1 条，返回 ok、cached=false，来源耗时 1575 ms；DOI 为 `10.1016/j.ceramint.2025.06.299`，WoS 被引次数 11。服务直接读取当前项目 .env，没有测试环境覆盖。
- 首次验收脚本直接将适配器附有说明文本的返回值整体解析为 JSON，发生脚本解析错误；三个工具当时已正常加载。修正验收解析后复验成功，前次记录保留。最终发送 session_shutdown，关闭测试连接，没有遗留该次测试服务。

本轮没有发送 LLM 请求，没有加载其他 Pi 扩展或进行新全文下载，也未操作用户现有交互会话；不把 SDK 运行时验证描述成 Pi 界面或模型自动选工具的端到端验收。已打开的 Pi 输入 `/reload` 或重启加载新增配置。[脱敏安装与运行时回执](pi-install-2026-11-13.json)。

## Pi 真实模型对话测试：2026-11-14

用户明确要求实际调用 Pi 测试后，在本机直接运行已安装 Pi CLI 的 print/json 模式，使用 Pi 默认模型 gpt-5.6-terra，未覆盖模型、服务凭据或 MCP 环境。在项目之外的临时目录创建全新无历史对话，仅允许 literature-mcp_search_literature，要求以 TS/PY 字段检索 2020—2025 年 diamond thermal conductivity 文献、最多 3 篇，并解释 Starter 与 Expanded 的能力边界。没有读取原用户对话，也未给模型补充正确答案。

- 模型第一、二次分别向 Starter 传入 record_view=full 和 short，都返回 -32602 参数错误。这两次在 MCP 输入校验阶段结束，没有访问 WoS API。
- 第三轮模型生成参数时长时间停顿，随后模型响应以 error/terminated 结束；原 Pi 会话自动恢复并继续。没有更换模型或发送第二条纠正提示，现有日志不足以确定模型流中断原因。
- 第三次实际工具调用去掉 record_view，使用 `TS=(diamond AND "thermal conductivity") AND PY=(2020-2025)`，mode=wos、wos_product=starter、sources=[wos_starter]、year_from=2020、year_to=2025、max_results=3。返回 ok、cached=false，WoS 来源耗时 2899 ms。
- 返回 DOI `10.1016/j.ceramint.2025.06.299`、`10.1016/j.diamond.2024.111257`、`10.1016/j.diamond.2023.110213`，WoS Starter 被引次数分别为 11、34、42；Pi 最终回答中的三条记录及计数与工具输出一致。
- Pi 正确确认本次 TS/PY 字段检索成功，并说明 3 篇候选不代表完整集合；但最终仍称无法据此宣称查询 Core Collection，并把更完整的 Core Collection 能力与 Expanded 关联。

检索链路与凭据验证通过，首轮参数选择和能力解释仍需改进。核对固定上游 0.3.3 的 MCP handler、StarterClient 和本项目转发路径：未覆盖 databaseId，Starter 客户端以 WOS 为默认值并作为 db 参数发送。[官方 Starter 说明](https://developer.clarivate.com/apis/wos-starter)明确包含 Core Collection，[官方 OpenAPI](https://developer.clarivate.com/apis/wos-starter/swagger)列出 db=WOS 的含义及支持字段。该数据库判断来自实际固定代码和官方契约，不是对 HTTPS 请求抓包。当前 MCP 结果未显式返回数据库标识，参数字段说明也没有向模型明确 record_view 的适用范围，模型仅凭返回记录无法直接核验数据库身份。

原始脱敏 JSON 事件保存在被 Git 忽略的 .local/pi-e2e-2026-11-14，模型正文、参数错误、成功工具结果、模型信息及人工核验保存在 [Pi 真实对话回执](pi-e2e-2026-11-14.json)。整轮约 232 秒，Pi 正常退出；私有 .env、Pi settings、Pi 用户级 MCP 配置和 Zotero 配置哈希保持不变，没有下载全文。本轮仅更新验收与状态记录，未修改应用源码或运行离线回归；交互界面、原用户会话和修订说明后的复验均未覆盖。

## Pi 调试修复与最终验收：2026-11-14

本节记录用户要求继续调试至 Pi 可正常使用后的 1.1.1 修复，前节是修复前的历史结果。修改限定于本项目的工具说明、来源/采集元信息、相关测试及文档；没有改上游包源码、真实凭据、许可门控或三个工具名称。

### 修复内容

- 将 Starter 的核心合集、支持字段和 record_view 适用条件写入 MCP 指令、工具描述及字段 JSON Schema；Starter 仍严格拒绝 record_view，改进错误信息，而非静默丢弃无效参数。
- WoS 来源状态增加 database、api_product、Starter api_version；检索和精确元数据都返回数据库身份，失败状态不因这些目标信息而变成访问成功。
- 增加 retrieval 的候选上限、实际条数、未知总数、不暴露分页、未验证穷尽性信息。实际 Pi 回归又暴露“把封装缺项归因于 API”问题，因此进一步加入 limitation_scope=this_mcp_tool 和 Starter api_capabilities.pagination/total_matches=true，并在工具说明中明确 API 的 page/limit、metadata.total 与当前 MCP 封装的区别。
- 说明 include_citations 控制额外施引关系，元数据中的被引计数不需要该选项；提示 overwrite=false 会复用已验证的本地文件。
- 使用已安装适配器的缓存 API，只将 literature-mcp 条目过期并重新发现；原 Zotero 缓存未因此被覆盖。最终再次通过实际服务 SDK 发现工具，逐项比较 Pi 缓存中的三个定义及服务器指令，完全一致。

### 离线与协议回归

最终 `npm run check` 完成：类型检查、**56 项测试全部通过、0 失败、0 跳过**、隔离的真实 stdio smoke、格式检查及生产依赖审计（0 个已知漏洞）。离线原始输出保存在被 Git 忽略的 .local/pi-e2e-2026-11-14/offline-check-final.log。

新增/扩展检查覆盖：通过实际 MCP listTools 验证给模型的参数描述；short/full 的 Starter 请求仍在输入层拒绝且不调用后端；去掉该参数可恢复；成功、缺凭据和混合来源结果保留正确数据库与状态；有界结果不伪造总数或全量覆盖；缓存保留采集元信息；Starter 精确 DOI 计数不额外查施引关系。固定上游真实类的 HTTP Mock 同时覆盖 Starter v1/v2 的 db=WOS 和 Expanded 的 databaseId=WOS。这些 HTTP Mock 仅证明代码契约，不代表真实 Expanded 账户可用。

### 真实 Pi 模型对话

使用已安装 Pi CLI 1.1.0、适配器 7.0.0、原默认模型 gpt-5.6-terra。最终两个验收会话使用 **Pi 默认工具集、扩展、技能和上下文发现**，没有工具白名单，也没有覆盖 MCP 环境或替换模型。测试从项目之外启动，使用新对话，非 SDK 手工直接调用。

| 最终验收 | 实际证据 |
| --- | --- |
| 完整工作流 | Pi 主动调用 search_literature、get_paper、download_paper，三次调用全部首次成功，没有无效参数重试；约 48 秒完成 |
| 核心合集字段检索 | `TS=(diamond AND "thermal conductivity") AND PY=(2020-2025)`，最多 1 篇，Starter v1，数据库回执 WOS / Web of Science Core Collection，ok、cached=false |
| 精确元数据与被引数 | 对同一 DOI `10.1016/j.ceramint.2025.06.299` 调用 get_paper，metadata_sources=[wos_starter]、include_citations=false，返回同一论文和被引数 11，未请求施引关系 |
| 下载工具本地复用 | 对测试前已核验的 `1706.03762v7` 设置 overwrite=false、allow_publisher_api=false，返回 already_exists、verified=true；SHA-256 与测试前完全一致，没有重新下载 |
| 原错误说明回归 | 将用户原报告交给正常 Pi 核验；首次 TI/PY 查询成功，返回 DOI `10.35848/1347-4065/ac4304`，随后正确纠正“缺 Expanded 不能核心合集/字段检索”，并区分 API 分页/总数与 MCP 封装限制；约 32 秒完成 |

本地 QA PDF 为 2,215,244 字节，SHA-256 `bdfaa68d8984f0dc02beaca527b76f207d99b666d31d1da728ee0728182df697`，版本 submittedVersion (1706.03762v7)。本轮实际验证的是下载工具的已验证本地复用分支；新网络 PDF 下载不作为本轮通过结论，相关下载实现另由离线回归及此前独立记录的真实下载覆盖。

所有实际工具参数、结果、模型正文、版本、最终构建指纹及逐项验收在 [同一 Pi 回执](pi-e2e-2026-11-14.json) 的 runs 与 remediation 中。旧的中间结果与失败不删除：其中一轮在模型未返回、尚无 MCP 调用时进程退出 143，日志不足以确认原因，确认进程已终止后才用相同配置重试；最终验收会话均正常退出且模型无错误响应。默认 Pi 工作流的 stderr 另有现有 pi-browser-use 扩展的 Chrome code 21 提示，未阻止三个文献工具调用，本任务没有修改或验收该浏览器扩展。

最终私有 .env、Pi 设置、Pi 用户级 MCP 配置、原 Zotero 配置的内容哈希均未变化，真实 Key 未复制到配置或回执。原交互界面/原聊天未被操作，已打开的 Pi 需 `/reload` 或重新连接。完成上述本机验收时，补丁尚未提交或推送；当时未验证 1.1.1 的新 Windows 原生 CI、真实 Expanded 或新出版社账户权限。后续发布以 Git refs 和 Actions 为准，不将历史 CI 当作当前提交的验证。

## 浏览器启动提示的后续处理与发布准备：2026-11-14

用户随后提供了 pi-browser-use 的 Chrome code 21 长调用栈。检查确认有一个父进程为 1 的后台 Edge，占用 Pi 专用浏览器目录；该进程的 cwd 与此前未完成 Pi 测试的临时 cwd 完全相同，SingletonLock 也指向它。因此只向这一已确认的测试遗留浏览器发送 Browser.close，平稳退出；未终止其他浏览器，也未删除 profile、Cookie 或登录资料。

随后通过实际 Pi SDK 加载原 pi-browser-use 扩展，运行 session_start 和 browser_doctor：34 个浏览器工具注册成功、扩展错误 0、doctor 非错误；没有发 LLM 请求或打开网站，session_shutdown 正常完成，Pi settings 哈希不变。该结果仅验证启动和诊断，不代表网站交互或登录已验收。[后续摘要](pi-e2e-2026-11-14.json)保留原因、处理范围和复验结果。

按用户明确的推送指令，将 1.1.1 源码、相关测试、使用说明及脱敏回执归为同一修复。发布前检查所有非忽略候选文件及可达 Git blob，使用实际凭据精确匹配和常见 Token/私钥模式检查，未发现凭据；未安装专用扫描器。实际 .env、文献库、机器客户端配置和 .local 原始日志均排除，Pi 安装回执中的机器专用启动值也已省略。仓库权限和可见性经连接工具核对为 turtleyang/literature-mcp 私有仓库；最新远端和本地 main 在提交前同步。

## Windows 宿主机真机完整部署与 Pi 验收：2026-11-16

通过 SSH 在用户 Windows 物理机 `littleplane`（Windows 11 x64 10.0.26300，Node.js v24.15.0，npm 11.12.1，Pi 1.4.0）完成独立实机验收。

### 1. 编译与离线检查
- 代码位置：`D:\code\literature-mcp`（commit `e9e312f`）。
- 离线测试：`npm.cmd run check`，共 56 项测试通过、0 失败，耗时 3.4 秒。
- 覆盖 Windows 关键特性：驱动器盘符根与 UNC 根保留、大小写规范化、8.3 短路径名（`RUNNER~1`）匹配防软链接跳转、stdio smoke 进程检查、无已知漏洞（0 vulnerabilities）。

### 2. 凭据与存储初始化
- `.env` 通过受保护通道安全同步至 `D:\code\literature-mcp\.env`。
- `npm.cmd run doctor` 核实通过：Node.js `D:\nodejs\node.exe`、文献库 `D:\code\literature-mcp\literature-library`，`wiley` 与 `wos_starter` 权限正常加载。

### 3. Pi 客户端集成
- 注册方式：`pi mcp add literature-mcp --exposure direct -- "D:\nodejs\node.exe" "D:\code\literature-mcp\dist\server.js"`。
- 配置文件更新：`C:\Users\54509\.pi\agent\mcp.json`，保留已有 Zotero 配置。
- `pi mcp list` 实机连接回执：
  ```text
  literature-mcp: connected, 3 tools (direct, global)
    D:\nodejs\node.exe D:\code\literature-mcp\dist\server.js
    tools: search_literature, get_paper, download_paper
  ```

### 4. 真实端到端链路核验
通过 `scripts/verify-pi-windows.mjs`（调用 Windows 原生 `pi-mcp-adapter` 运行时）及 `scripts/online-test.mjs` 完成实测：
- `search_literature` (fast)：OpenAlex + Crossref 实时检索返回 3 篇，status=ok。
- `search_literature` (wos)：WoS Starter v1 核心合集检索返回 10 篇，status=ok。
- `get_paper`：精确 DOI `10.1038/nphys1170` 成功返回论文元数据，status=ok。
- `download_paper`：arXiv `1706.03762v7` 真实网络下载官方 PDF 并通过严格格式与身份校验，保存至 `D:\code\literature-mcp\literature-library\papers\`；随后二次调用正确返回 `already_exists` 本地复用。
- 真实脱敏回执参见 `docs/pi-windows-receipt.json` 及 `docs/online-results-windows.json`。

