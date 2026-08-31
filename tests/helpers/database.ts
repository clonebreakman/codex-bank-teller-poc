import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runDockerCompose(
  args: string[],
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const result = await execFileAsync("docker", ["compose", ...args], {
    cwd: process.cwd(),
    timeout: options.timeoutMs ?? 30_000,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });
  return result.stdout;
}

export async function runPostgresQuery(query: string): Promise<string> {
  return runDockerCompose([
    "-f",
    "infra/docker-compose.yml",
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "synthetic_bank",
    "-d",
    "synthetic_bank",
    "-At",
    "-c",
    query,
  ]);
}
