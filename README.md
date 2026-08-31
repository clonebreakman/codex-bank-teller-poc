# Codex Bank Teller

银行智能柜面 PoC。当前项目只允许使用合成数据和本地模拟服务，不连接真实银行、真实客户数据、真实银行卡、支付网络或生产系统。

## 当前阶段

当前已完成 P0、P1、P2、P3、P4、P5，以及阶段 A 的 10 个场景验收。P7.2 的本地合成柜员审查工作台也已通过 UI、HTTP、浏览器和安全测试；下一步是阶段 B 负责人签署，之后才可规划 P8。

第一条垂直切片是：在合成环境中查询测试账户余额，并完成策略检查、工具调用、外部状态验证和审计记录。阶段 A 还覆盖工单、开户缺件、客户摘要、预约确认边界和提示注入终止边界。

阶段验收记录见 [`docs/gates/stage-a-acceptance.md`](docs/gates/stage-a-acceptance.md)。

P7.1 的本地制度检索记录见 [`docs/gates/p7.1-knowledge.md`](docs/gates/p7.1-knowledge.md)。

P7.2 的柜员审查领域边界和本地 UI 记录见 [`docs/gates/p7.2-review-boundary.md`](docs/gates/p7.2-review-boundary.md)。该记录不授权真实银行接入。

## 安全边界

- 默认 `SYNTHETIC_ONLY=true`；
- 不提交 `.env`、API key、密码、OTP、PIN、CVV 或真实客户数据；
- Computer Use 只能连接本地隔离模拟环境；
- 任何未登记工具、外部域名或高风险动作必须被拒绝或转人工；
- 项目尚未具备生产银行系统接入资格。

## 开发命令

```bash
corepack pnpm install
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:ui
corepack pnpm test:browser
corepack pnpm playwright:install
```

P1.2 的 schema、seed、Compose 配置、静态契约测试和 live 空库重建测试均已通过。live 测试会等待 PostgreSQL healthcheck，验证 `1|1|12|2|1` 的合成数据计数，并在结束后销毁容器和卷：

```bash
P1_LIVE_DB_TESTS=1 corepack pnpm vitest run tests/integration/database-seed.test.ts
```

`test:browser` 只启动无头 Playwright Chromium，访问随机 `127.0.0.1` 端口，并在测试结束时关闭服务、浏览器和临时审计目录。项目不连接真实银行、真实客户、真实凭据、支付网络或生产系统。

## 成果交付

- [详细成果总结报告](docs/reports/2026-08-24-bank-teller-poc-achievement-report.md)
- [离线成果网站](docs/site/index.html)
- [阶段 B 验收记录](docs/gates/stage-b-acceptance.md)
- [阶段 B 签署包](docs/gates/stage-b-signoff-package.md)

在仓库根目录启动本地静态网站：

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory docs
```

然后打开 `http://127.0.0.1:4173/site/index.html`。网站只展示本地合成 PoC 成果，不调用外部 API。
