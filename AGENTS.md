# literature-mcp 工作规则

- 本项目是标准 stdio MCP，只暴露 README 所列三个工具；stdout 仅供协议使用。
- 变更前检查 Git 工作区；不修改上游包源码，不混入无关变更，不自动推送。
- 设计和扩展先读 `docs/architecture.md`；上游接口变更先读 `docs/upstream-review.md` 并核对实际固定版本与官方文档。
- 精确 DOI / arXiv 关系和版本必须有可核验依据；不以相似标题替代，不把 XML/HTML 伪装成 PDF，不绕过授权或付费墙。
- 商业接口须同时具备凭据和对应显式授权；Key 不等于 API/TDM 许可，不向其他来源扩散授权。
- 凭据、文献库和本机客户端配置不进入 Git。下载全文不上传、不自动分享。
- 按变更运行类型检查与有关测试；协议、存储、授权或上游适配变化须检查相应回归测试。真实与模拟验证分开记入 `docs/verification.md`。
- `README.md` 为使用和目录入口；`STATUS.md` 维护当前进度与未验证项，长期规则不记录每日状态。
