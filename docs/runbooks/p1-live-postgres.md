# P1.2 PostgreSQL Live 验收手册

本手册用于 Docker daemon 恢复后的单次本地验收。数据库只包含合成客户、账户和交易数据，不得替换为真实凭据、真实客户数据或真实银行连接。

## 1. 前置检查

```powershell
docker info
docker compose -f infra/docker-compose.yml config
```

只有 `docker info` 能返回 Server 信息时，才继续执行容器步骤。

## 2. 空库启动

```powershell
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d postgres
docker compose -f infra/docker-compose.yml ps
```

等待 healthcheck 为 `healthy`，并确认端口只绑定到 `127.0.0.1:55432`。

## 3. 种子查询

```powershell
docker compose -f infra/docker-compose.yml exec -T postgres `
  psql -U synthetic_bank -d synthetic_bank -At `
  -c "SELECT (SELECT count(*) FROM customers), (SELECT count(*) FROM accounts), (SELECT count(*) FROM transactions), (SELECT count(*) FROM receipts), (SELECT count(*) FROM tickets);"
```

预期输出：

```text
1|1|12|2|1
```

再运行自动化 live 测试：

```powershell
$env:P1_LIVE_DB_TESTS = "1"
corepack pnpm vitest run tests/integration/database-seed.test.ts
```

## 4. 销毁与重建

```powershell
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d postgres
$env:P1_LIVE_DB_TESTS = "1"
corepack pnpm vitest run tests/integration/database-seed.test.ts
docker compose -f infra/docker-compose.yml down -v
```

## 5. 通过条件

- 两次从空卷启动均得到 `1|1|12|2|1`；
- healthcheck、查询、自动化测试和 teardown 均成功；
- 不存在真实凭据、真实客户信息或外部银行域名；
- 通过结果写入 `docs/gates/p1.md`，并附命令输出与日期；
- 在 live 闸门通过前，P1 仍保持 `partial`。
