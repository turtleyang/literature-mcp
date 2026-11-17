# literature-mcp

本地科研文献检索与合法全文下载 MCP Server。TypeScript + 官方 MCP SDK，使用 stdio，向客户端只暴露 `search_literature`、`get_paper`、`download_paper` 三个工具。检索不会自动下载论文；每次下载只处理一个明确指定的 DOI 或 arXiv ID。

源码仓库：[turtleyang/literature-mcp](https://github.com/turtleyang/literature-mcp)（私有，需要你的 GitHub 账户有访问权限）。Windows 和 Linux 使用同一份源码、依赖锁与 Node.js 入口，无需单独维护两个版本。GitHub 不存储你的 API Key 或文献库。

## 在新电脑上安装与使用

### 方式一：在任何 Agent 中直接挂载（推荐，免克隆免编译）

仓库内包含预编译好的运行产物，可在任何支持 MCP 的客户端中通过 `npx` 直接按需启动：

* **Pi Agent**（单行指令挂载）：
  ```bash
  pi mcp add literature-mcp --exposure direct -- npx -y github:turtleyang/literature-mcp
  ```
* **Claude Desktop / Cursor / Codex / Windsurf / Cline**（在客户端 `mcp.json` 中直接配置）：
  ```json
  {
    "mcpServers": {
      "literature-mcp": {
        "command": "npx",
        "args": ["-y", "github:turtleyang/literature-mcp"],
        "env": {
          "WOS_API_KEY": "你的Key(可选)",
          "WILEY_TDM_TOKEN": "你的Token(可选)",
          "LITERATURE_AUTHORIZED_APIS": "wos_starter,wiley"
        }
      }
    }
  }
  ```
* **全局安装（作为全局命令使用）**：
  ```bash
  npm install -g git+https://github.com/turtleyang/literature-mcp.git
  ```
  安装后即可在任何客户端配置中直接将 `command` 设为 `literature-mcp`。

### 方式二：本地源码克隆运行

先安装 Git 与 Node.js **24.x**（固定验证版本见 `.nvmrc`）。在终端执行：

```bash
git clone git@github.com:turtleyang/literature-mcp.git
cd literature-mcp
npm ci --ignore-scripts
npm run build
npm run setup
npm run smoke
```

Windows PowerShell 若阻止 `npm.ps1`，将命令里的 `npm` 换成 `npm.cmd`，无需修改执行策略。私有仓库需要先配置自己的 GitHub SSH 登录；也可使用 GitHub 提供的 HTTPS clone 地址和正常账户认证，不要将 Token 拼进 URL。

`npm run setup` 会记录当前 Node 的绝对路径，并在缺失时创建：

- `.env`：从 `.env.example` 复制，随后自行填写凭据。
- `.mcp.json`：Claude Code / Pi 项目配置。
- `.codex/config.toml`：Codex 项目配置。
- `.cursor/mcp.json`：Cursor 项目配置。

客户端命令直接指向本机 Node 可执行文件，参数为本机 `dist/server.js` 的绝对路径；Windows 无需 Bash。所有已有 `.env`、客户端配置都会保留，不会被覆盖；迁移目录或更换 Node 位置后，需检查已有配置。`scripts/start.sh` 仍保留为 Linux/SSH 的兼容入口。

`npm run smoke` 是不访问学术数据库的 stdio 检查，即使项目里有真实凭据，也只使用隔离的临时测试目录。它检查三个工具发现、未配置来源状态和输入校验；完整模拟下载测试由 `npm test` 完成。

填写 `.env` 后运行 `npm run doctor` 确认读取状态。新电脑上的文献默认保存在该 checkout 的 `literature-library`，不同电脑不会自动同步。不要直接搬用包含旧绝对路径的 JSON 索引。

更新已有安装：

```bash
git pull --ff-only
npm ci --ignore-scripts
npm run build
npm run setup
npm run smoke
```

依赖由 `package-lock.json` 固定。更新不会通过 setup 覆盖你的私有配置或文献库。GitHub Actions 分别使用 Windows 与 Ubuntu 执行类型检查、离线测试、stdio 检查、格式与审计；实际运行结果见 [Actions](https://github.com/turtleyang/literature-mcp/actions)。

## 能力与边界

| 来源 | 检索 / 元数据 | 全文获取 | 第一版验证范围 |
| --- | --- | --- | --- |
| OpenAlex | 原生关键词、DOI、年份、作者/期刊 ID、被引条件 | DOI 对应 OA 位置 | 真实检索和 DOI 查询成功；匿名搜索后续出现 429 |
| Crossref | 复用上游检索；独立精确 DOI 元数据补全 | 不把 TDM 链接当成 OA 授权 | 真实检索、精确 DOI 成功 |
| Semantic Scholar | 复用检索；精确 DOI / 可选引文列表 | 官方 OA PDF 候选 | 离线通过；本机真实请求出现 429 |
| arXiv | 复用上游搜索；原生 ID/版本解析 | 官方 PDF，标记预印本版本 | 真实 PDF 下载、校验及本地复用成功 |
| WoS Starter | 核心合集 `db=WOS`，支持字段检索；默认 v2，可配置 v1 | 不提供 PDF | 本机 v1 真实检索、被引计数及 Pi 对话通过；详见验收记录 |
| WoS Expanded | 独立 Key、SR/FR、可选 citing 关系 | 不提供 PDF | 模拟通过；无真实 Key / 机构 API 授权 |
| Scopus / ScienceDirect | 复用上游授权检索 | Elsevier Article Retrieval 单独授权 | 检索路由、全文授权/格式模拟；无真实授权 |
| Springer | 复用 Metadata 检索 | OA JSON/PDF/JATS；授权 TDM JATS | 离线模拟通过；无真实 API Key |
| Wiley | 通过 Crossref/OpenAlex 找 DOI | 官方 TDM DOI PDF 接口 | Linux 真实 TDM OA PDF 下载通过；订阅权限范围未测 |
| Unpaywall | DOI 精确 OA 位置 | 已发现的合法 PDF 候选 | 离线通过；未提供真实联系邮箱 |
| Europe PMC / PMC | DOI 精确且 OA 标记匹配 | Europe PMC 官方 XML 全文 | 离线通过；未做真实全文下载 |

ACS、RSC、IEEE、Taylor & Francis、IOP、AIP、APS 预留扩展接口。可通过现有元数据和 OA 渠道发现其论文；尚未实现这些平台的专用订阅 PDF 下载器。机构网页能下载 PDF，并不代表机构授予相应 API 权限。

[验收记录](docs/verification.md)区分真实联网、模拟、客户端连接与未验证部分。[上游审查](docs/upstream-review.md)记录复用范围和安全边界。[接口设计](docs/architecture.md)解释实现与扩展方式。

## 三个工具

### search_literature

```json
{"query":"diamond thermal conductivity measurement","mode":"fast","max_results":8}
```

- `fast` 默认只调用 OpenAlex + Crossref。
- `wos` 只调用 WoS。`wos_product` 为 `starter`（默认）或 `expanded`；只有 Expanded 接受 `record_view: "short" | "full"`。
- Starter 已支持核心合集 `db=WOS` 及 `TS`、`TI`、`AU`、`SO`、`PY`、`DO` 字段检索，不需要 Expanded。Starter 请求必须完全省略 `record_view`；`short` 也不适用。Expanded 的 `full` 指更丰富的元数据记录，不是论文全文。
- `deep` 默认只调用 OpenAlex、Crossref、Semantic Scholar。通过 `sources` 显式补充授权来源，不扫描全部数据库。
- `sources` 最多 5 个：`openalex`、`crossref`、`semantic_scholar`、`arxiv`、`wos_starter`、`wos_expanded`、`scopus`、`sciencedirect`、`springer`。
- `max_results` 默认 10，上限 50；Scopus 单来源上游最多 25。
- `source_statuses` 的 WoS 项会标明目标数据库、产品和 Starter API 版本；只有来源状态成功才表明本次检索成功。`retrieval` 给出请求上限、实际返回数及完整性边界；当前不提供总命中数或翻页，候选结果不能当作全量文献集合。
- 分页和总数的上述限制属于本 MCP 封装。Starter API 本身支持 `page/limit` 和 `metadata.total`；结果中的 `api_capabilities` 与 `retrieval.limitation_scope` 会区分 API 能力和工具限制，不应据此断言 Starter 没有分页或无法进行任何计量分析。
- 支持 `year_from`、`year_to`、`sort_by: "relevance" | "date" | "citations"`。
- OpenAlex 的 `author_id`（`A…`）、`journal_id`（`S…`）、`min_citations` 必须同时指定 `sources:["openalex"]`，以免给其他库附加无法等价执行的 ID 条件。

返回 DOI 去重后的文献、每库 `source_statuses`、分来源的 `citation_counts`。缺失被引次数为 `null`，实测零为 `0`。上游将 Crossref/Semantic Scholar 的缺失值压成零，因此其搜索结果中的零保守显示为未知；用 `get_paper` 精确查询可取得原始的零。搜索只返回前 8 位作者及 `author_count`，完整作者与摘要用 `get_paper` 查询。

按引用排序只在已取回的相关候选中进行，优先 OpenAlex 计数，缺失时参考 Crossref 等来源，不累加不同数据库计数。OpenAlex/Crossref 的关键词匹配范围较宽，因此按引用排序时，先按相关性获取最多两倍候选（每库最多 50 条）再本地排序，避免直接按引用排序时返回无关高被引论文。搜索结果仍需科研判断，不能据此自动宣布文献“具有代表性”。

### get_paper

```json
{"doi":"10.1103/revmodphys.94.025002","metadata_sources":["crossref","openalex"],"include_citations":false}
```

默认精确查询 Crossref + OpenAlex。严格比较标准化 DOI，不以相似标题替代。返回统一 `Paper`、来源状态、OA 位置和可发现格式，已有本地文件时附路径。不会下载全文，也不会为每篇搜索结果自动补充摘要。

查询 WoS 元数据或被引次数时设置 `metadata_sources:["wos_starter"]`；被引次数会随元数据返回，不需要 `include_citations:true` 或 Expanded。

`include_citations:true` 额外获取最多 20 条引文：已显式选用并授权的 WoS Expanded 记录优先调用其 citing 接口；其他情况使用 Semantic Scholar。引文失败单独报告，不丢失元数据。不把受限或超时解释成未收录。

### download_paper

```json
{"doi":"10.xxxx/real-doi","preferred_source":"auto","allow_publisher_api":true,"overwrite":false}
```

或：

```json
{"arxiv_id":"1706.03762v7","preferred_source":"arxiv"}
```

参数支持 `doi`、`arxiv_id`、`preferred_source`（`auto/wiley/elsevier/springer/arxiv/open_access`）、`save_directory`、`allow_publisher_api`、`overwrite`。

默认顺序：已验证的本地副本 → 可靠 OA 候选 → 已授权出版社接口 → 返回 DOI/出版社页/OA 链接和失败原因。候选顺序可在 `.env` 调整，不并发尝试所有下载渠道；默认最多尝试 6 个文件候选。PMC 只在已有 PMC 位置或相应生物医学 DOI 前缀时补充查询；Unpaywall 只在有真实邮箱时启用。

设置 `preferred_source:wiley/elsevier` 会明确限定为对应出版社接口；`springer` 先 OA 再 TDM；`open_access` 禁用订阅 TDM 下载。`allow_publisher_api:false` 禁止需要单独授权的出版社全文 API（含 Springer OA API），公开仓储、arXiv 与已知 OA 位置仍可使用。

文件按实际内容保存为 `.pdf` 或 `.xml`。不保存登录页为 HTML 全文，不将 XML 改名为 PDF。Wiley 404 可能表示订阅不足，因此返回 `restricted`，不能判断论文不存在。状态包括 `downloaded`、`already_exists`、`restricted`、`credentials_required`、`not_found`、`rate_limited`、`timeout`、`cancelled`、`unsupported_format`、`failed`。

## 配置凭据与机构许可

私有 `.env` 自动加载，进程环境优先；也可用 `LITERATURE_ENV_FILE` 指向外部私有文件。真实凭据不写入 README、Git、客户端共享配置或日志。

**Key 与授权开关缺一不可。** `LITERATURE_AUTHORIZED_APIS` 是你已核实相应 API 使用权的本地声明，不会替你申请许可。一个产品的授权不会自动授予其他产品权限。不要为绕过报错随意打开所有开关。

| 配置 | 申请入口 / 说明 | 对应授权名 |
| --- | --- | --- |
| `WOS_API_KEY` | [Clarivate Starter](https://developer.clarivate.com/apis/wos-starter)；试用计划可能无被引计数 | `wos_starter` |
| `WOS_EXPANDED_API_KEY` | [Clarivate Expanded](https://developer.clarivate.com/apis/wos)；需机构产品许可，FR 可能消耗记录额度 | `wos_expanded` |
| `SCOPUS_SEARCH_API_KEY` / `ELSEVIER_API_KEY` | [Elsevier Developer Portal](https://dev.elsevier.com/)；Scopus Search 可使用独立 Key | `scopus` / `sciencedirect` |
| `ELSEVIER_API_KEY`、可选 `ELSEVIER_INST_TOKEN` | Article Retrieval 的 API entitlement、内容和格式权限单独核实 | `elsevier` |
| `SPRINGER_API_KEY` | [Springer API Portal](https://dev.springernature.com/) Metadata | `springer` |
| `SPRINGER_OPENACCESS_API_KEY` | 同门户，Open Access 产品 | `springer_oa` |
| `SPRINGER_TDM_API_KEY` | Full Text 产品，另行签署 TDM 条款 | `springer_tdm` |
| `WILEY_TDM_TOKEN` | [Wiley TDM](https://onlinelibrary.wiley.com/library-info/resources/text-and-datamining)：先与图书馆核对协议、接受 click-through 条款并领取 Token | `wiley` |
| `OPENALEX_API_KEY` | [OpenAlex](https://help.openalex.org/api/)免费 Key 可提高额度；仍需遵守预算 | 公共接口，无商业路由开关 |
| `SEMANTIC_SCHOLAR_API_KEY` | [Semantic Scholar API](https://www.semanticscholar.org/product/api) | 公共接口 |
| `UNPAYWALL_EMAIL` | [Unpaywall API](https://unpaywall.org/products/api)要求真实邮箱 | 公共接口 |

例如，只授权 WoS Starter 与 Wiley：

```dotenv
WOS_API_KEY=填入你的真实密钥
WILEY_TDM_TOKEN=填入你的真实Token
LITERATURE_AUTHORIZED_APIS=wos_starter,wiley
```

Wiley 请求使用 `Wiley-TDM-Client-Token`，跟随最多 5 次 HTTPS 重定向，跨站重定向移除凭据。其官方限制包含 3 篇/秒与 60 次/10 分钟；本项目保守地使用 11 秒间隔，并在共享文献库中持久化限速状态，跨 MCP 会话共同遵守。不同文献库不会共享此状态，多机器或多库使用同一 Token 时需在外部统筹额度。

Elsevier 默认请求原生 XML；确认具有 PDF 格式权限后可设置 `ELSEVIER_FULLTEXT_FORMAT=pdf`。返回格式仍按实际 MIME 和内容验证。Springer OA 使用 `/openaccess/json` 和 `/openaccess/jats`；TDM 使用 `/xmldata/jats`，只在单独授权后调用。

## 文献目录与完整性

默认：

```text
literature-library/
  papers/      # SHA-256(标准化 DOI 或带版本 arXiv ID).pdf / .xml
  metadata/    # 每篇 JSON：元数据、文件路径、来源、版本、验证证据、SHA-256
  logs/        # API/下载耗时、状态、文件字节数；不记录密钥、URL 查询串或全文
  locks/       # 跨进程同标识下载锁
  rates/       # Wiley 跨会话速率状态
```

`LITERATURE_LIBRARY_DIR` 可更换文献库。`LITERATURE_ALLOWED_SAVE_ROOTS` 可用分号列出额外允许的绝对目录；`save_directory` 只能在其下。拒绝路径越界、目录符号链接和不安全目标。索引存在但文件哈希损坏会报错，不默默使用坏文件。未索引的同名文件默认保留；确认后才能 `overwrite:true`。

响应体有大小上限，写入唯一临时文件后验证，再原子发布最终文件，最后原子更新索引。普通中断或验证失败会清除临时文件；进程被 SIGKILL 或断电留下的锁/临时文件需按下面的步骤检查恢复。PDF 验证包括 MIME、文件头、EOF、页树、全部页面可解析及论文身份。仓储文件必须在前两页识别目标 DOI；arXiv 用官方 ID/版本映射；出版社官方 DOI 全文端点可使用其精确端点溯源。`identity_verification` 明确说明采用何种证据，不将所有文件都宣称为“PDF 内含 DOI”。

开放获取位置仅表明可访问性，不自动等于允许再分发。下载器不上传、同步或分享本地全文。Zotero、BibTeX、EndNote 可在未来通过独立导出器接入。

## MCP 客户端

`npm run setup` 已生成项目配置，适合在本项目目录中使用。配置中的 Node 和 `dist/server.js` 均使用运行 setup 的这台机器的真实绝对路径，不依赖客户端工作目录。以下示例用于理解结构，以 setup 生成的实际值为准。

Codex 的项目文件为 `.codex/config.toml`：

```toml
[mcp_servers.literature-mcp]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/literature-mcp/dist/server.js"]
startup_timeout_sec = 30
tool_timeout_sec = 180
```

Windows 示例采用 TOML 单引号，路径不需要手工双写反斜线：

```toml
[mcp_servers.literature-mcp]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\Tools\literature-mcp\dist\server.js']
startup_timeout_sec = 30
tool_timeout_sec = 180
```

若希望在任意项目中使用，把**该服务器配置项**合并到 Codex 用户配置：Linux 为 `~/.codex/config.toml`，Windows 为 `%USERPROFILE%\.codex\config.toml`。不要覆盖其他配置；已有同名服务器时修改该项，不重复添加。[Codex 官方说明](https://developers.openai.com/codex/mcp)

Claude Code / Pi 的项目 `.mcp.json`，以及 Cursor 的 `.cursor/mcp.json` 使用同样的服务器定义：

```json
{
  "mcpServers": {
    "literature-mcp": {
      "type": "stdio",
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Tools\\literature-mcp\\dist\\server.js"]
    }
  }
}
```

在其他项目使用时，将该定义合并到相应客户端的用户级配置，或在客户端 MCP 设置中填写相同 command/args。密钥始终放在 MCP 项目私有 `.env`，不必复制到每个客户端配置里。

本机 Pi 使用 `pi-mcp-adapter`；其他 Pi 安装可使用其内建 MCP。按客户端正常流程信任项目并重新连接，检查是否出现三个核心工具。[Pi](https://github.com/earendil-works/pi)、[Pi MCP Adapter](https://github.com/nicobailon/pi-mcp-adapter)、[Claude Code](https://code.claude.com/docs/en/mcp)、[Cursor](https://cursor.com/docs/mcp)。客户端实际验收范围见 [验收记录](docs/verification.md)，不能将 Windows 运行库检查说成所有 Windows 客户端均已实测。

Pi 1.1.0 可添加用户级配置，让其他目录启动的 Pi 也能使用；以下两个绝对路径需替换为当前电脑的实际 Node 与服务路径：

```bash
pi mcp add literature-mcp --exposure direct -- "/absolute/path/to/node" "/absolute/path/to/literature-mcp/dist/server.js"
```

该命令写入 `~/.pi/agent/mcp.json`，本机现有 `pi-mcp-adapter` 7.0.0 也会读取此配置。密钥仍由服务从项目私有 `.env` 读取。已打开的 Pi 输入 `/reload` 或重启后使用；三个核心工具会直接显示，不需要再次安装适配器。本机安装及真实调用证据见 [Pi 安装回执](docs/pi-install-2026-11-13.json)。

更新服务后，Pi MCP Adapter 可能仍持有旧工具说明；应重新连接 literature-mcp 并确认工具列表已刷新。本次 1.1.1 修复已在本机定向刷新该服务缓存，并用真实 Pi 模型对话检查，原始失败与后续复验分别保存在 [Pi 对话回执](docs/pi-e2e-2026-11-14.json)。

## 以后改为服务器运行

当前发布同时保留本地运行能力，尚未部署服务器。如果以后部署到自己的 Linux 服务器，可让每个客户端通过 `ssh -T` 启动远端 `scripts/start.sh`，复用标准 stdio，无需开放额外 HTTP 端口；各客户端要先能正常 SSH 登录该服务器。

服务器运行时，密钥配置和 PDF 路径属于服务器，Windows 本地不会自动出现这些文件。迁移文献、上传凭据和部署服务器应分别明确安排，不随 Git push 自动发生。`docs/deployment.md` 说明两种方式的区别。

## 故障排查与维护

- `not_configured/credentials_required`：运行 `npm run doctor` 只查看凭据是否配置，不输出值；核对真实产品 Key 及 `.env` 权限。
- `restricted`：核对 API/TDM 产品许可和 `LITERATURE_AUTHORIZED_APIS`。网页订阅、API Key、全文格式权限分别检查。
- `rate_limited`：等待供应商额度恢复，减少检索次数；OpenAlex/Semantic Scholar 可申请免费 Key。服务保留其他来源结果，不循环重试 401/403，429 只允许一次短等待重试，否则返回状态。
- 本机 Clash Fake-IP：当前私有 `.env` 已精确列出核实的官方服务域名，允许这些域名解析到 Fake-IP 的保留网段，TLS 证书验证保持开启。其他仓储仍受 SSRF 检查，必要时先独立核验域名再添加；不要配置通配符。正常 DNS 环境无需该设置。支持 `HTTPS_PROXY`/`HTTP_PROXY` 的 HTTP CONNECT 代理；不修改系统代理。代理远程解析的安全性也取决于本地可信代理配置。
- `timeout/cancelled`：本层 HTTP 可中止。上游部分搜索器不会随 MCP 取消中止 Axios，因此超时/取消时终止共享子进程，避免其继续重试；同一时刻的其他上游请求可能失败，下次请求重新连接。正常请求复用同一个子进程。
- 存储锁残留：先读取 `locks/*.lock` 的 PID，用 `ps -p PID` 核对是否仍为该项目进程；确认进程已经退出、没有其他客户端在下载同一论文后，只移除对应残留锁。未确认前不要批量清理锁。`.tmp` 文件同理；原有 PDF 与元数据应保留。
- 缓存：会话内检索缓存 5 分钟、精确 DOI 元数据缓存 1 小时；失败结果不作为成功缓存，收费来源不会默认加入。缓存不跨重启；本地全文索引和 Wiley 限速状态跨重启保留。
- 并发：检索默认 3，下载默认 1；下载等待队列最多 20。每次只处理一个明确指定论文，上限 50 MB、6 个文件候选。没有批量下载工具；大规模任务或费用须另行明确授权。
- 日志：`literature-library/logs/events.jsonl`；记录 API/下载耗时、状态、字节数和来源。按需归档，避免长期无限增长。

升级：保存私有 `.env` 与文献库，审查新上游接口和许可证，显式更新固定版本，`npm ci --ignore-scripts && npm run check`，再复核公开接口。商业接口仍需用自己的授权验证。不要直接追踪浮动 `latest`。

卸载：移除本项目的 MCP 配置项并关闭客户端连接；要移除代码时先保留 `.env` 和 `literature-library`。没有系统服务、Docker 或全局 npm 包需要清理。不要删除其他 MCP 配置或现有文献库。

## 开发入口

- `src/server.ts`：MCP 协议层、资源生命周期。
- `src/search/`、`src/adapters/`：检索路由、精确元数据、上游连接和归一化。
- `src/download/`：候选发现、授权路由、内容验证；新增出版社实现 `PublisherDownloadAdapter` 并在路由中显式登记。
- `src/storage/`：安全路径、原子文件、索引、锁和 Wiley 共享限速。
- `tests/`：调度、文件与 HTTP 安全、真实上游 WoS 的模拟 HTTP 合约。
- `scripts/`：本地启动、安装配置、诊断、stdio 和真实客户端验证。
- `docs/`：设计、审查和验收证据；`STATUS.md` 维护当前状态。

```bash
npm run typecheck
npm test
npm run format:check
npm audit --omit=dev
# 以下命令会联网，且在线验收脚本会明确下载一篇指定 arXiv 测试论文
npm run test:online
node scripts/client-checks.mjs
```
