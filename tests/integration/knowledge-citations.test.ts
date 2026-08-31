import { describe, expect, it } from "vitest";
import {
  createSyntheticPolicyKnowledgeBase,
  searchPolicyKnowledge,
} from "../../apps/operator-console/src/knowledge/index.js";

describe("cited teller policy knowledge", () => {
  it("returns a policy answer with document ID, version, and matching excerpt", () => {
    const result = searchPolicyKnowledge(
      createSyntheticPolicyKnowledgeBase(),
      "账户余额查询需要哪些身份校验？",
    );

    expect(result).toMatchObject({ status: "answer" });
    if (result.status !== "answer") throw new Error(result.reason);
    expect(result.answer).toContain("身份");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      documentId: "POLICY-IDENTITY-001",
      version: "2026-08-01",
    });
    expect(result.citations[0].excerpt.length).toBeGreaterThan(10);
  });

  it("hands off when no local source can support an answer", () => {
    const result = searchPolicyKnowledge(
      createSyntheticPolicyKnowledgeBase(),
      "如何修改真实客户的银行卡密码？",
    );

    expect(result).toEqual({
      status: "handoff",
      reason: "SOURCE_NOT_FOUND",
    });
  });
});
