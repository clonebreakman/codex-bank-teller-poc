import type { PolicyDocument } from "@codex-bank-teller/workflow-registry";

export { createSyntheticPolicyKnowledgeBase } from "@codex-bank-teller/workflow-registry";
export type { PolicyDocument } from "@codex-bank-teller/workflow-registry";

export interface PolicyCitation {
  documentId: string;
  version: string;
  title: string;
  excerpt: string;
}

export type PolicySearchResult =
  | {
      status: "answer";
      answer: string;
      citations: [PolicyCitation, ...PolicyCitation[]];
    }
  | {
      status: "handoff";
      reason: "SOURCE_NOT_FOUND";
    };

export function searchPolicyKnowledge(
  documents: readonly PolicyDocument[],
  query: string,
): PolicySearchResult {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) {
    return { status: "handoff", reason: "SOURCE_NOT_FOUND" };
  }

  const document = documents.find((candidate) =>
    candidate.keywords.some((keyword) => normalizedQuery.includes(keyword)),
  );
  if (!document) {
    return { status: "handoff", reason: "SOURCE_NOT_FOUND" };
  }

  const excerpt = createExcerpt(document.text, document.keywords, normalizedQuery);
  const citation: PolicyCitation = {
    documentId: document.documentId,
    version: document.version,
    title: document.title,
    excerpt,
  };
  return {
    status: "answer",
    answer: excerpt,
    citations: [citation],
  };
}

function createExcerpt(
  text: string,
  keywords: readonly string[],
  query: string,
): string {
  const keyword = keywords.find((candidate) => query.includes(candidate));
  if (!keyword) return text;
  const start = Math.max(0, text.indexOf(keyword) - 24);
  return text.slice(start, Math.min(text.length, start + 120));
}
