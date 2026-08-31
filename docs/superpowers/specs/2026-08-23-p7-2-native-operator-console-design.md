# P7.2 原生 HTML 柜员审查工作台设计规格

**状态：** 方案 B 已获用户批准；本规格已获用户确认。  
**日期：** 2026-08-23  
**范围：** 本地合成环境中的柜员审查工作台，不执行任何真实金融写操作。

## 1. 目标

为现有 `operator-console` 领域服务提供一个可运行、可测试的本地审查页面，使合成柜员能够：

- 查看客户上下文、运行编号、建议动作、风险等级、制度来源、验证状态和审计引用；
- 在策略允许且外部验证通过时确认建议动作；
- 修改建议并再次提交；
- 转人工或拒绝处理；
- 看到明确的失败原因和终态；
- 让每一次动作都写入合成追加式审计日志。

页面及服务始终保持 `executed: false`，不调用 Mock Bank 写接口、支付接口、真实银行系统或任何外部域名。

## 2. 非目标

本切片不实现：

- React、Vite、Next.js 或其他前端框架；
- 真实登录、员工目录、SSO、客户认证或凭据管理；
- 真实政策文件、真实客户数据或外部知识库；
- 转账、开户、改密、销户、贷款审批、现金处理等金融写操作；
- 生产部署、互联网访问、文件上传、下载、剪贴板和支付网络连接；
- P8 客户自助服务和 P9 受控写操作。

## 3. 技术决策

### 3.1 页面技术

- 页面使用原生 HTML 和 CSS；
- 页面交互使用原生浏览器 JavaScript，由 TypeScript 模板函数生成；
- 不引入 React、Vite、JSX、CSS 构建链或运行时 UI 框架；
- 业务判断仍由现有 `apps/operator-console/src/review/index.ts` 执行，浏览器端不得复制策略逻辑作为权威来源。

### 3.2 本地 HTTP 适配器

新增本地 `operator-console` HTTP 服务，使用 Node.js 内置 `node:http`，只绑定 `127.0.0.1`，不依赖外部 Web 框架。

固定接口：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/health` | 返回 `syntheticOnly: true` 和服务状态 |
| `GET` | `/review/:runId` | 返回审查页面及合成审查上下文 |
| `POST` | `/review/:runId/action` | 调用领域审查服务并写入合成审计日志 |

服务只接受登记在内存中的合成审查案例。请求体上限为 16 KB；未知路径、非 JSON 动作、未知 `runId`、非合成柜员 ID 和外部重定向均拒绝。

### 3.3 浏览器测试

增加 Playwright 作为仅开发和测试用途的依赖。Playwright 浏览器只访问测试服务器分配的 `127.0.0.1` 随机端口；不复用真实浏览器 Profile、Cookie、密码、Token 或剪贴板。

现有 `BrowserHarness` 继续负责动作白名单和本地域名策略；Playwright 负责验证真实 HTML DOM 的显示、禁用状态、点击、表单输入和页面反馈。二者职责不合并：Harness 是安全边界，Playwright 是 UI 验证工具。

## 4. 组件和职责

### 4.1 `review-page.ts`

职责：

- 将 `ReviewCase` 转换为安全的 HTML；
- 对文本进行 HTML 转义；
- 输出稳定的 `data-testid` 和 `data-status` 属性；
- 按策略和验证状态设置确认按钮的初始 `disabled` 状态；
- 不执行领域动作，不直接写审计日志。

### 4.2 `review-client.ts`

职责：

- 监听确认、修改、转人工和拒绝按钮；
- 将动作发送至当前本地服务的 `/action` 接口；
- 显示成功状态、拒绝原因和终态；
- 在请求期间禁用重复提交；
- 不自行判断动作是否允许，服务端返回结果是权威结果。

### 4.3 `server.ts`

职责：

- 绑定回环地址并提供页面与动作接口；
- 解析并限制请求体；
- 校验 `runId`、动作类型、合成柜员 ID 和页面来源；
- 调用 `recordReviewAction`；
- 将领域结果转换为稳定 JSON 响应；
- 不导入或调用任何金融工具。

### 4.4 `browser-test-harness.ts`

职责：

- 启动随机本地端口的审查服务；
- 创建合成审查案例和临时审计日志；
- 启动 Playwright Chromium；
- 在测试结束时关闭浏览器、服务、临时文件和页面上下文。

## 5. 页面数据和交互

页面必须展示以下字段：

| 区域 | 必须内容 |
| --- | --- |
| 客户上下文 | 合成客户标识、运行编号 |
| 建议动作 | 建议动作文本、风险等级 |
| 策略 | `allow`、`confirm`、`handoff` 或 `deny` |
| 验证 | `verified` 或 `unverified` |
| 来源 | 每条制度的文档 ID、版本和匹配片段 |
| 审计 | 已有审计事件引用 |
| 操作 | 确认、修改、转人工、拒绝 |

按钮规则：

- `confirm`：仅当 `policyDecision=allow` 且 `verificationStatus=verified` 且案例未进入终态时启用；
- `modify`：需要非空修改说明；提交后保持 `executed: false`；
- `handoff`：始终可用，成功后进入 `handed_off` 终态；
- `reject`：始终可用，成功后进入 `rejected` 终态；
- 进入 `handed_off` 或 `rejected` 后，所有操作按钮禁用；
- 服务端拒绝必须显示稳定原因码，不显示堆栈、内部路径、工具凭据或未脱敏字段。

## 6. 请求和响应契约

动作请求只允许以下结构：

```json
{
  "action": "confirm | modify | handoff | reject",
  "actorId": "TELLER-1",
  "note": "可选，modify 必填"
}
```

成功响应必须包含：

```json
{
  "ok": true,
  "review": {
    "status": "confirmed | modified | handed_off | rejected",
    "executed": false
  },
  "auditEvent": {
    "action": "confirm | modify | handoff | reject",
    "result": "accepted"
  }
}
```

拒绝响应必须包含 `ok: false` 和以下稳定原因之一：

- `REVIEW_NOT_READY`；
- `REVIEW_TERMINAL`；
- `REVIEW_DUPLICATE_ACTION`；
- `MODIFICATION_NOTE_REQUIRED`；
- `INVALID_ACTION_REQUEST`；
- `SYNTHETIC_ACTOR_REQUIRED`。

## 7. 安全不变量

实现和测试必须保持以下不变量：

1. 页面和 HTTP 服务只允许 `127.0.0.1`，不得访问外部域名；
2. 所有审查案例必须带 `synthetic: true` 的运行上下文；
3. 服务端调用现有领域服务，浏览器端不能绕过策略判断；
4. `confirm` 在 `allow + verified` 之外必须被拒绝；
5. 所有动作都写入合成追加式审计日志；
6. 所有动作结果的 `executed` 必须为 `false`；
7. 重复点击不能产生并发重复动作；
8. 审计事件必须保留可查询的合成 `actorId`，修改说明只保留哈希和长度摘要，不写入明文；
9. 页面文本、审计输出和错误响应不得泄露密码、Token、OTP、PIN、CVV 或真实客户数据；
10. 页面中出现提示注入或外部操作指令时，流程必须停止并转人工；
11. 任何未知动作、未知字段、未知案例和非合成 actor 必须拒绝；
12. HTTP 服务运行时始终固定绑定 `127.0.0.1`，不能由调用方改成通配地址。

## 8. 测试设计

### 8.1 页面渲染测试

验证：

- 所有必需上下文、来源和审计引用出现在 HTML 中；
- HTML 特殊字符被转义；
- `allow + verified` 案例的确认按钮启用；
- 非 `allow`、非 `verified` 或终态案例的确认按钮禁用；
- HTML 中不存在金融工具名和敏感字段。

### 8.2 HTTP 与动作测试

验证：

- 四类动作分别进入正确状态；
- 修改说明为空时拒绝；
- 非法动作、未知案例和非合成 actor 拒绝；
- 每次成功或失败动作都新增一条审计事件；
- 所有响应保持 `executed: false`。

### 8.3 Playwright 浏览器测试

至少覆盖：

1. 正常案例中柜员看到完整上下文并确认，页面显示 `confirmed`；
2. `policyDecision=confirm` 案例中确认按钮不可点击，转人工可用；
3. 修改案例需要输入说明，提交后显示 `modified`；
4. 转人工和拒绝进入终态并禁用后续操作；
5. 页面只访问本地随机端口，外部导航被 Browser Harness 拒绝；
6. 审计日志包含成功和拒绝动作，且没有敏感明文。

## 9. 交付文件

- `apps/operator-console/src/ui/review-page.ts`
- `apps/operator-console/src/ui/review-client.ts`
- `apps/operator-console/src/server.ts`
- `tests/ui/review-page.test.ts`
- `tests/integration/operator-console-server.test.ts`
- `tests/e2e/operator-console-browser.test.ts`
- `tests/helpers/operator-console-browser.ts`
- `docs/gates/p7.2-review-boundary.md`
- `README.md`
- `package.json` 与 `pnpm-lock.yaml`（仅增加测试所需 Playwright 依赖）

## 10. 完成闸门

P7.2 UI 只能在以下证据全部具备后标记完成：

- 页面渲染、HTTP 动作和 Playwright 浏览器测试全部通过；
- 完整测试、安全测试、Lint、TypeScript 检查和 `git diff --check` 通过；
- 四类动作的审计覆盖率为 100%；
- `executed: false` 的断言覆盖所有 UI 动作；
- Browser Harness 外域和未登记动作测试通过；
- P7.2 闸门记录更新为“领域边界和本地 UI 通过”，同时明确未授权真实银行接入；
- 阶段 A 的业务、安全和工程签署仍作为进入更高风险阶段的独立条件，不由本切片自动满足。

## 11. 明确的实现顺序

1. 先为页面渲染和按钮禁用状态编写失败测试；
2. 实现 HTML 模板和转义；
3. 为 HTTP 动作接口编写失败测试；
4. 实现回环 HTTP 服务并复用领域服务；
5. 增加 Playwright 浏览器测试和本地启动辅助；
6. 运行完整验证并更新 P7.2 闸门；
7. 等待业务、安全和工程负责人签署后，再规划 P8。
