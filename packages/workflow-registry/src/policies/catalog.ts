export interface PolicyDocument {
  documentId: string;
  version: string;
  title: string;
  text: string;
  keywords: readonly string[];
}

export function createSyntheticPolicyKnowledgeBase(): readonly PolicyDocument[] {
  return [
    {
      documentId: "POLICY-IDENTITY-001",
      version: "2026-08-01",
      title: "合成账户查询身份校验规范",
      text: "查询账户余额前，柜面 Agent 必须核对客户标识与账户归属；身份不一致时停止流程并转人工。该规范只适用于本地合成账户。",
      keywords: ["余额", "账户", "身份", "校验", "归属"],
    },
  ];
}
