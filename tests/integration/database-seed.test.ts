import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDockerCompose, runPostgresQuery } from "../helpers/database.js";

const root = process.cwd();
const schemaPath = join(root, "infra", "postgres", "init", "001_schema.sql");
const seedPath = join(root, "infra", "postgres", "init", "002_seed.sql");
const composePath = join(root, "infra", "docker-compose.yml");

describe("synthetic PostgreSQL database contract", () => {
  it("defines the schema, deterministic seed, and isolated Compose service", async () => {
    const [schema, seed, compose] = await Promise.all([
      readFile(schemaPath, "utf8"),
      readFile(seedPath, "utf8"),
      readFile(composePath, "utf8"),
    ]);

    for (const table of ["customers", "accounts", "transactions", "receipts", "tickets"]) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, "i"));
      expect(schema).toMatch(new RegExp(`CREATE INDEX IF NOT EXISTS .*${table}`, "i"));
    }
    for (const column of ["synthetic", "version", "created_at", "updated_at"]) {
      expect(schema).toMatch(new RegExp(`\\b${column}\\b`, "i"));
    }

    expect(seed).toContain("CUST-1001");
    expect(seed).toContain("ACC-1001");
    expect(seed.match(/\('TX-10\d\d'/g)).toHaveLength(12);
    expect(seed.match(/\('REC-100\d'/g)).toHaveLength(2);
    expect(seed).toContain("TKT-1001");
    expect(seed).toMatch(/ON CONFLICT/i);

    expect(compose).toMatch(/postgres:/i);
    expect(compose).toMatch(/127\.0\.0\.1:55432:5432/);
    expect(compose).toMatch(/SYNTHETIC_ONLY:\s*["']?true["']?/i);
    expect(compose).toMatch(/POSTGRES_DB: synthetic_bank/);
  });
});

const liveTest = process.env.P1_LIVE_DB_TESTS === "1" ? it : it.skip;

liveTest("rebuilds the seed from an empty PostgreSQL volume", async () => {
  await runDockerCompose(["-f", "infra/docker-compose.yml", "down", "-v"], {
    timeoutMs: 60_000,
  }).catch(() => undefined);
  try {
    await runDockerCompose(
      [
        "-f",
        "infra/docker-compose.yml",
        "up",
        "-d",
        "--wait",
        "--wait-timeout",
        "120",
        "postgres",
      ],
      {
        timeoutMs: 120_000,
      },
    );
    const result = await runPostgresQuery(
      "SELECT (SELECT count(*) FROM customers), (SELECT count(*) FROM accounts), (SELECT count(*) FROM transactions), (SELECT count(*) FROM receipts), (SELECT count(*) FROM tickets);",
    );
    expect(result.trim()).toBe("1|1|12|2|1");
  } finally {
    await runDockerCompose(["-f", "infra/docker-compose.yml", "down", "-v"], {
      timeoutMs: 60_000,
    }).catch(() => undefined);
  }
}, 180_000);
