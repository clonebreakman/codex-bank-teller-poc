import { workspaceMetadata } from "../../src/workspace.js";

describe("workspace safety baseline", () => {
  it("defaults to synthetic-only mode", () => {
    expect(workspaceMetadata.syntheticOnly).toBe(true);
  });
});
