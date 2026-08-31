# P7.2 原生 HTML 柜员审查工作台实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:executing-plans` 逐任务执行本计划。所有步骤使用复选框跟踪；实现必须遵循 TDD：先写失败测试，再写最小实现。

**目标：** 在本地合成环境中交付一个原生 HTML + TypeScript 柜员审查工作台，并通过 HTTP、审计和 Playwright 浏览器测试验证四类审查动作。

**架构：** 页面由 TypeScript 模板生成原生 HTML 和浏览器 JavaScript；Node `http` 服务只绑定 `127.0.0.1`，服务端复用现有 `reviewAction` / `recordReviewAction` 领域服务。Playwright 仅用于测试真实 DOM，Browser Harness 继续负责本地域名和动作白名单；任何动作都保持 `executed: false`。

**技术栈：** TypeScript、Node.js 内置 `node:http`、Vitest、Playwright Chromium、现有 `FileAuditLog` 和 `InMemoryBrowserHarness`。

---

## 文件清单与职责

### 修改文件

- `apps/operator-console/src/review/index.ts`：为审查案例增加 `synthetic: true` 不变量，并在创建案例时保留该标记。
- `tests/e2e/operator-confirmation.test.ts`：为现有领域测试夹具补充合成标记。
- `package.json`：增加 `playwright` 开发依赖、UI 测试脚本和浏览器安装脚本。
- `pnpm-lock.yaml`：由 pnpm 锁定 Playwright 依赖版本。
- `docs/gates/p7.2-review-boundary.md`：记录 UI、HTTP、浏览器和审计验收证据。
- `README.md`：补充本地工作台测试命令和安全限制。

### 创建文件

- `apps/operator-console/src/ui/review-client.ts`：输出原生浏览器 JavaScript 客户端源码。
- `apps/operator-console/src/ui/review-page.ts`：安全转义并渲染审查 HTML 页面。
- `apps/operator-console/src/server.ts`：回环 HTTP 服务、请求校验、领域动作调用和响应映射。
- `tests/ui/review-page.test.ts`：页面字段、按钮状态、转义和敏感字段测试。
- `tests/integration/operator-console-server.test.ts`：健康检查、页面接口、动作接口、拒绝原因和审计测试。
- `tests/helpers/operator-console-browser.ts`：启动本地服务、创建临时审计日志和管理 Playwright 生命周期。
- `tests/e2e/operator-console-browser.test.ts`：真实 DOM 的确认、修改、转人工、拒绝和本地隔离测试。

---

## 任务 1：补强合成审查领域契约和测试依赖

**文件：**

- 修改：`apps/operator-console/src/review/index.ts`
- 修改：`tests/e2e/operator-confirmation.test.ts`
- 修改：`package.json`
- 修改：`pnpm-lock.yaml`

- [x] **步骤 1：先写合成标记失败测试**

在 `tests/e2e/operator-confirmation.test.ts` 的第一条测试中增加：

```ts
expect(review.synthetic).toBe(true);
expect(review.executed).toBe(false);
```

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
corepack pnpm vitest run tests/e2e/operator-confirmation.test.ts
```

预期：测试因 `ReviewCase` 没有 `synthetic` 字段而失败，不能通过修改断言规避失败。

- [x] **步骤 3：实现最小领域变更**

在 `ReviewCaseInput` 增加：

```ts
synthetic: true;
```

在 `createReviewCase` 返回对象中保留 `...input` 产生的 `synthetic: true`，不增加任何金融工具调用。

在测试夹具的输入对象增加：

```ts
synthetic: true,
```

- [x] **步骤 4：运行领域测试确认通过**

运行：

```powershell
corepack pnpm vitest run tests/e2e/operator-confirmation.test.ts
```

预期：5 个测试通过，所有结果的 `executed` 仍为 `false`。

- [x] **步骤 5：安装测试浏览器依赖**

运行：

```powershell
corepack pnpm add -Dw playwright
corepack pnpm exec playwright install chromium
```

预期：`package.json` 和 `pnpm-lock.yaml` 增加 Playwright，Chromium 安装到 Playwright 管理目录；不安装 React、Vite 或生产运行时 UI 框架。

- [x] **步骤 6：增加测试脚本**

在 `package.json` 的 `scripts` 中增加：

```json
{
  "test:ui": "vitest run tests/ui tests/integration/operator-console-server.test.ts",
  "test:browser": "vitest run tests/e2e/operator-console-browser.test.ts",
  "playwright:install": "playwright install chromium"
}
```

- [x] **步骤 7：运行类型和领域回归测试**

运行：

```powershell
corepack pnpm vitest run tests/e2e/operator-confirmation.test.ts
corepack pnpm typecheck
```

预期：5 个领域测试通过，TypeScript 退出码为 0。

- [x] **步骤 8：提交**

```powershell
git add apps/operator-console/src/review/index.ts tests/e2e/operator-confirmation.test.ts package.json pnpm-lock.yaml
git commit -m "feat(柜员审查): 强化合成案例契约和 UI 测试依赖"
```

---

## 任务 2：实现页面渲染契约

**文件：**

- 创建：`apps/operator-console/src/ui/review-page.ts`
- 测试：`tests/ui/review-page.test.ts`

- [x] **步骤 1：编写失败测试**

创建测试夹具并断言页面契约：

```ts
const html = renderReviewPage(createCase(), {
  actionEndpoint: "/review/RUN-REVIEW-1001/action",
  actorId: "TELLER-1",
});

expect(html).toContain('data-testid="customer-context"');
expect(html).toContain("CUST-1001");
expect(html).toContain("RUN-REVIEW-1001");
expect(html).toContain("POLICY-IDENTITY-001");
expect(html).toContain("2026-08-01");
expect(html).toContain('data-testid="action-confirm"');
expect(html).not.toContain("tool-gateway");
```

增加状态测试：

```ts
expect(renderReviewPage(createCase(), options)).toMatch(
  /data-testid="action-confirm"(?![^>]*disabled)/,
);
expect(renderReviewPage(createCase({ policyDecision: "confirm" }), options)).toContain(
  'data-testid="action-confirm" disabled',
);
expect(renderReviewPage(createCase({ verificationStatus: "unverified" }), options)).toContain(
  'data-testid="action-confirm" disabled',
);
```

增加转义测试：

```ts
const html = renderReviewPage(createCase({ customerContext: "<script>alert(1)</script>" }), options);
expect(html).not.toContain("<script>alert(1)</script>");
expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
```

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
corepack pnpm vitest run tests/ui/review-page.test.ts
```

预期：因 `review-page.ts` 不存在而失败。

- [x] **步骤 3：实现最小页面渲染器**

导出固定接口：

```ts
export interface ReviewPageOptions {
  actionEndpoint: string;
  actorId: string;
}

export function renderReviewPage(
  review: ReviewCase,
  options: ReviewPageOptions,
): string;
```

实现要求：使用 `escapeHtml` 输出所有业务字段；输出 `customer-context`、`suggested-action`、`risk-level`、`policy-decision`、`verification-status`、`citations`、`audit-events` 和四个操作按钮；确认按钮只依据 `allow + verified + 非终态` 设置初始禁用状态；页面脚本通过 `review-client.ts` 注入，不在页面内调用金融工具。

- [x] **步骤 4：运行页面测试确认通过**

运行：

```powershell
corepack pnpm vitest run tests/ui/review-page.test.ts
```

预期：所有页面字段、按钮状态和 HTML 转义测试通过。

- [x] **步骤 5：提交**

```powershell
git add apps/operator-console/src/ui/review-page.ts tests/ui/review-page.test.ts
git commit -m "feat(柜员工作台): 添加审查页面渲染器"
```

---

## 任务 3：实现浏览器客户端动作协议

**文件：**

- 创建：`apps/operator-console/src/ui/review-client.ts`
- 修改：`apps/operator-console/src/ui/review-page.ts`
- 测试：`tests/ui/review-page.test.ts`

- [x] **步骤 1：编写失败测试**

断言页面内包含稳定动作协议和状态容器：

```ts
const html = renderReviewPage(createCase(), options);
expect(html).toContain('data-testid="action-note"');
expect(html).toContain('data-testid="review-status"');
expect(html).toContain('data-testid="review-error"');
expect(html).toContain("/review/RUN-REVIEW-1001/action");
expect(html).toContain("executed");
```

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
corepack pnpm vitest run tests/ui/review-page.test.ts
```

预期：因页面没有动作协议元素而失败。

- [x] **步骤 3：实现最小客户端源码**

在 `review-client.ts` 导出：

```ts
export function renderReviewClientScript(): string;
```

生成的原生 JavaScript 必须：读取 `data-action` 和修改说明；对 `/action` 发出 JSON `POST`；请求期间禁用四个按钮；成功后更新状态和 `executed=false`；失败后显示稳定原因码；终态后禁用所有动作；不得绕过服务端的策略判断。

- [x] **步骤 4：运行页面测试确认通过**

运行：

```powershell
corepack pnpm vitest run tests/ui/review-page.test.ts
```

预期：页面动作协议和状态容器测试通过。

- [x] **步骤 5：提交**

```powershell
git add apps/operator-console/src/ui/review-client.ts apps/operator-console/src/ui/review-page.ts tests/ui/review-page.test.ts
git commit -m "feat(柜员工作台): 添加原生浏览器动作客户端"
```

---

## 任务 4：实现回环 HTTP 服务

**文件：**

- 创建：`apps/operator-console/src/server.ts`
- 测试：`tests/integration/operator-console-server.test.ts`

- [x] **步骤 1：编写失败测试**

测试固定服务接口：

```ts
const app = await startOperatorConsoleServer({ cases: [review], auditLog });
const health = await fetch(`${app.url}/health`);
expect(await health.json()).toEqual({ ok: true, syntheticOnly: true });

const page = await fetch(`${app.url}/review/${review.runId}`);
expect(page.status).toBe(200);
expect(await page.text()).toContain("CUST-1001");
```

动作接口测试：

```ts
const response = await fetch(`${app.url}/review/${review.runId}/action`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "confirm", actorId: "TELLER-1" }),
});
expect(response.status).toBe(200);
expect(await response.json()).toMatchObject({
  ok: true,
  review: { status: "confirmed", executed: false },
});
```

拒绝测试必须覆盖：`policyDecision=confirm`、空修改说明、未知动作、未知 `runId`、非合成 actor、超过 16 KB 请求体和未知路径。

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
corepack pnpm vitest run tests/integration/operator-console-server.test.ts
```

预期：因 `server.ts` 不存在而失败。

- [x] **步骤 3：实现最小 HTTP 服务**

导出固定接口：

```ts
export interface OperatorConsoleServerOptions {
  cases: readonly ReviewCase[];
  auditLog: FileAuditLog;
  host?: "127.0.0.1";
  port?: number;
}

export interface OperatorConsoleServerHandle {
  readonly url: string;
  close(): Promise<void>;
}

export async function startOperatorConsoleServer(
  options: OperatorConsoleServerOptions,
): Promise<OperatorConsoleServerHandle>;
```

服务必须只绑定 `127.0.0.1`；使用 Node `http.createServer`；页面请求从案例 Map 读取；动作请求解析不超过 16 KB 的 JSON；actor 必须匹配 `^TELLER-[A-Z0-9-]+$`；调用 `recordReviewAction`；接受时更新内存案例，拒绝时保留原案例；所有响应使用稳定 JSON；不调用任何金融工具。

- [x] **步骤 4：运行 HTTP 测试确认通过**

运行：

```powershell
corepack pnpm vitest run tests/integration/operator-console-server.test.ts
```

预期：健康检查、页面、四类动作、拒绝条件和审计事件测试全部通过。

- [x] **步骤 5：提交**

```powershell
git add apps/operator-console/src/server.ts tests/integration/operator-console-server.test.ts
git commit -m "feat(柜员工作台): 添加回环审查 HTTP 服务"
```

---

## 任务 5：建立 Playwright 本地测试夹具

**文件：**

- 创建：`tests/helpers/operator-console-browser.ts`
- 测试：`tests/e2e/operator-console-browser.test.ts`

- [x] **步骤 1：编写失败浏览器测试**

创建夹具并写入第一个真实 DOM 场景：

```ts
const fixture = await createOperatorConsoleBrowserFixture({ review: createCase() });
const page = await fixture.browser.newPage();
await page.goto(`${fixture.baseUrl}/review/${fixture.review.runId}`);

await expect(page.getByTestId("customer-context")).toContainText("CUST-1001");
await expect(page.getByTestId("action-confirm")).toBeEnabled();
await page.getByTestId("action-confirm").click();
await expect(page.getByTestId("review-status")).toContainText("confirmed");
```

- [x] **步骤 2：运行浏览器测试确认失败**

运行：

```powershell
corepack pnpm test:browser
```

预期：因测试夹具和服务页面尚未完整接入而失败。

- [x] **步骤 3：实现测试夹具**

导出固定接口：

```ts
export interface OperatorConsoleBrowserFixture {
  baseUrl: string;
  review: ReviewCase;
  auditLogPath: string;
  browser: Browser;
  close(): Promise<void>;
}

export async function createOperatorConsoleBrowserFixture(input: {
  review: ReviewCase;
}): Promise<OperatorConsoleBrowserFixture>;
```

实现必须创建临时目录和 `FileAuditLog`，启动回环服务，调用 `chromium.launch({ headless: true })`，测试结束按浏览器、服务、临时资源顺序关闭；不读取任何用户 Profile 或凭据。

- [x] **步骤 4：补齐浏览器行为测试**

覆盖：

```ts
await expect(page.getByTestId("action-confirm")).toBeDisabled();
await page.getByTestId("action-handoff").click();
await expect(page.getByTestId("review-status")).toContainText("handed_off");
await expect(page.getByTestId("action-reject")).toBeDisabled();
```

再覆盖修改说明、拒绝、审计事件和 `executed=false`。使用 `InMemoryBrowserHarness([fixture.baseUrl])` 验证外部 origin 抛出 `EXTERNAL_DOMAIN_DENIED`，并验证页面 URL 仍为回环地址。

- [x] **步骤 5：运行浏览器测试确认通过**

运行：

```powershell
corepack pnpm test:browser
```

预期：确认、黄色案例禁用、修改、转人工、拒绝和本地域名测试全部通过。

- [x] **步骤 6：提交**

```powershell
git add tests/helpers/operator-console-browser.ts tests/e2e/operator-console-browser.test.ts
git commit -m "test(柜员工作台): 添加本地浏览器验收"
```

---

## 任务 6：更新闸门记录和开发文档

**文件：**

- 修改：`docs/gates/p7.2-review-boundary.md`
- 修改：`README.md`

- [x] **步骤 1：先运行验收命令收集证据**

运行：

```powershell
corepack pnpm test:ui
corepack pnpm test:browser
corepack pnpm test:security
corepack pnpm lint
corepack pnpm typecheck
git diff --check
```

预期：所有命令退出码为 0；输出记录页面、HTTP、浏览器和安全测试统计。

- [x] **步骤 2：更新 P7.2 闸门**

将 `docs/gates/p7.2-review-boundary.md` 更新为“本地合成 UI 通过”，并记录：页面字段、四类动作、审计覆盖、`executed=false`、Playwright 测试、安全测试和明确的真实银行禁止范围。不得写入未经命令验证的数字。

- [x] **步骤 3：更新 README 命令**

增加：

```bash
corepack pnpm test:ui
corepack pnpm test:browser
corepack pnpm playwright:install
```

并注明服务只绑定 `127.0.0.1`，所有数据为合成数据，不具备生产银行接入资格。

- [x] **步骤 4：提交文档和闸门**

```powershell
git add docs/gates/p7.2-review-boundary.md README.md
git commit -m "docs(柜员工作台): 记录 P7.2 本地 UI 闸门"
```

---

## 任务 7：全量验证和交付审计

**文件：**

- 修改：本计划文件，将已验证步骤勾选为完成
- 不新增生产代码

- [x] **步骤 1：运行全量测试**

运行：

```powershell
corepack pnpm test
```

预期：原有测试与新增测试全部通过，失败数为 0；P1 live 测试默认跳过不影响普通测试。

- [x] **步骤 2：运行 P1 live 回归**

运行：

```powershell
$env:P1_LIVE_DB_TESTS = "1"
corepack pnpm vitest run tests/integration/database-seed.test.ts
```

预期：2 个数据库测试通过，PostgreSQL 计数为 `1|1|12|2|1`，测试结束后容器和卷被清理。

- [x] **步骤 3：运行静态检查**

运行：

```powershell
corepack pnpm test:security
corepack pnpm lint
corepack pnpm typecheck
git diff --check
```

预期：安全测试 7 个或更多通过，Lint、TypeScript 和 diff 检查退出码为 0。

- [x] **步骤 4：检查安全边界**

运行：

```powershell
rg -n "real-bank|api\.key|password|OTP|PIN|CVV|transfer|payment" apps/operator-console/src tests/ui tests/integration tests/e2e/operator-console-browser.test.ts
git status --short --branch
```

预期：不存在真实凭据或真实银行 URL；仅允许测试中的安全拒绝字符串和合成场景描述；工作区只包含本计划列出的提交内容。

- [x] **步骤 5：更新计划和最终提交**

```powershell
git add docs/superpowers/plans/2026-08-24-p7-2-native-operator-console.md
git commit -m "docs(柜员工作台): 完成 P7.2 实现计划记录"
```

---

## 规格覆盖和自检结果

- 规格第 1、2 节：任务 2、3、4、6、7 覆盖目标和非目标。
- 规格第 3 节：任务 1、4、5 覆盖原生 HTML、Node HTTP、Playwright 和 Browser Harness 边界。
- 规格第 4、5、6 节：任务 2、3、4 覆盖页面、客户端、服务端职责及 JSON 契约。
- 规格第 7 节：任务 1、4、5、6、7 覆盖合成标记、回环地址、审计、重复提交和敏感字段边界。
- 规格第 8 节：任务 2、4、5、7 覆盖渲染、HTTP、浏览器、全量和安全测试。
- 规格第 9、10、11 节：任务 6、7 覆盖交付文件、验收闸门和实现顺序。
- 计划步骤均包含具体文件、命令、预期结果和可执行代码片段，没有模糊占位步骤。
- 类型接口在任务 2 的 `ReviewPageOptions`、任务 4 的 `OperatorConsoleServerOptions` / `OperatorConsoleServerHandle`、任务 5 的 `OperatorConsoleBrowserFixture` 中一次定义，后续步骤只引用相同名称。
