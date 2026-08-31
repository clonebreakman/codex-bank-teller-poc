import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "threads",
    minWorkers: 1,
    maxWorkers: 1,
    testTimeout: 15000,
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts", "apps/**/*.test.ts"],
  },
});
