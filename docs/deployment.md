# 跨平台安装与部署边界

当前选择：GitHub 私有仓库分发，同一套源码在 Windows/Linux 各电脑独立运行。服务器部署暂缓。

## 本地运行

依赖 Node.js 24.x 和 Git。新电脑 clone 后 `npm ci --ignore-scripts`、`npm run build`、`npm run setup`、`npm run smoke`。Windows PowerShell 可使用 `npm.cmd`。

setup 生成本机绝对路径的 Node command 与 server.js args，不再把 POSIX shell 当成通用启动器。Node 自行读取项目私有 .env，客户端无需持有数据库 Key。项目配置只对该项目生效；跨项目使用时，把生成的服务器定义合并进客户端的用户级配置。

setup 用独占创建保留已有环境文件和客户端配置。更换机器、目录或 Node 位置后，已有配置不会自动重写，应人工核对其中的路径。代码库不提交这些本机配置。

文献库默认位于 checkout 内，各电脑各自保存。索引目前记录实际绝对路径，不支持直接把整套索引拷到另一种操作系统后继续引用旧路径。跨机器文献迁移/同步不属于 Git 发布流程；不要把 PDF 加入仓库。

## Windows 路径与客户端启动实测

目录逐级校验保留盘符根和 UNC share 根；realpath 比较允许 Windows 的大小写和长路径命名空间规范化；8.3 短路径需通过目录卷号和文件 ID 同一性确认，同时仍拒绝符号链接/目录联接跳转。测试中的目录链接使用 Windows junction，无需开发者模式的 symlink 权限。

### Windows 下客户端启动命令陷阱与基准测试（2026-11-17 实测）
很多 MCP 客户端（包括 Pi、Cursor 等）在底层使用 `child_process.spawn(command, args, { shell: false })` 启动 stdio 子进程。在 Windows 平台：
1. **直接调用 `command: "npx"` 会报错 `SPAWN_ERROR ENOENT spawn npx ENOENT`**：因为 Windows 上的 npx 是 `npx.cmd`，且 Node.js 24 因安全策略禁止在无 shell 模式下隐式执行 `.cmd` 文件。
2. **`cmd /c npx -y github:...` 包装方案**：虽然可以通过 cmd 启动，但由于每次调用都会动态克隆远端仓库并安装 163 个依赖，实测冷启动耗时高达 **73 秒**，体验极差且每次都依赖网络。
3. **最佳方案（预装副本 + Node 原生直启）**：将构建好的产物预装到固定目录（如 `%USERPROFILE%\.dsh\mcp-servers\literature-mcp` 或 `D:\code\literature-mcp`），在客户端配置中直接由 `node` 执行 `dist/server.js`。实测冷启动仅需 **约 1 秒**，离线稳定可用。

GitHub Actions 的 Windows 和 Ubuntu 任务使用相同固定 Node 版本，执行全部离线测试及原生 stdio 子进程检查。没有真实 API Key 的 CI 不调用商业接口，也不下载论文。每次改变源码、启动器、依赖或测试后必须观察两个平台的实际结果。

## SSH 服务器方式（以后可选）

使用 SSH 运行 stdio 时，MCP 仍是每个客户端按需启动的进程，而不是开放网络端口的常驻网站服务。通常只需维护一份服务器环境，适合同一用户多个设备使用；代价是 API 请求由服务器网络发出，文献存储和路径也在服务器。

客户端配置的结构示例（服务器路径与 SSH 别名需自行替换）：

```json
{
  "mcpServers": {
    "literature-mcp": {
      "type": "stdio",
      "command": "ssh",
      "args": ["-T", "-o", "BatchMode=yes", "my-literature-server", "exec /srv/literature-mcp/scripts/start.sh"]
    }
  }
}
```

SSH 必须预先完成正常的主机身份核验和密钥登录；不要用关闭 StrictHostKeyChecking 的方式绕过。远端非交互环境下，start.sh 可以使用远端 setup 记录的 Node 路径，不依赖 nvm 的交互 shell 初始化。

服务器上的新部署与本机 API 权限测试应分开记录，特别是机构 IP/订阅范围。任何下载都发生在实际执行 MCP 的主机，不把远端路径当成 Windows 本地文件。当前没有 HTTP MCP 端点；如果未来确有浏览器/多用户 URL 接入需要，应另行设计认证、访问隔离、Origin 校验和 TLS，而不是直接把 stdio 程序暴露到公网。
