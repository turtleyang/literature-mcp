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
