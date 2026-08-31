import type { ReviewCase } from "../review/index.js";
import { renderReviewClientScript } from "./review-client.js";

export interface ReviewPageOptions {
  actionEndpoint: string;
  actorId: string;
}

export function renderReviewPage(
  review: ReviewCase,
  options: ReviewPageOptions,
): string {
  const terminal = review.status === "handed_off" || review.status === "rejected";
  const confirmationDisabled =
    terminal || review.policyDecision !== "allow" || review.verificationStatus !== "verified";
  const disabled = terminal ? " disabled" : "";
  const confirmDisabled = confirmationDisabled ? " disabled" : "";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>合成柜员审查工作台</title>
    <style>
      :root { color-scheme: dark; font-family: "IBM Plex Mono", "Cascadia Code", monospace; background: #07111f; color: #d9e8f5; }
      * { box-sizing: border-box; }
      body { min-width: 320px; margin: 0; background: radial-gradient(circle at 75% -10%, #123653 0, transparent 38rem), #07111f; }
      [data-testid="console-shell"] { display: grid; grid-template-columns: 15rem minmax(0, 1fr); min-height: 100vh; }
      [data-testid="console-sidebar"] { border-right: 1px solid #1b405b; padding: 1.5rem 1.2rem; background: #091a2a; }
      .brand { color: #68d9ff; font-size: .8rem; letter-spacing: .18em; text-transform: uppercase; }
      .sidebar-title { margin: 2.5rem 0 .4rem; color: #fff; font-family: "Rajdhani", sans-serif; font-size: 1.7rem; letter-spacing: .06em; }
      .sidebar-copy { color: #7594ab; font-size: .72rem; line-height: 1.6; }
      .nav-line { display: flex; gap: .55rem; align-items: center; margin-top: 2rem; color: #69e0bb; font-size: .72rem; }
      .nav-dot { width: .45rem; height: .45rem; border-radius: 50%; background: currentColor; box-shadow: 0 0 1rem currentColor; }
      [data-testid="console-main"] { width: min(100%, 92rem); padding: 2.5rem clamp(1rem, 4vw, 4rem); }
      .topline { display: flex; justify-content: space-between; gap: 1rem; align-items: end; border-bottom: 1px solid #1b405b; padding-bottom: 1.5rem; }
      .eyebrow { color: #68d9ff; font-size: .68rem; letter-spacing: .16em; text-transform: uppercase; }
      h1 { margin: .45rem 0 0; color: #f4fbff; font-family: "Rajdhani", sans-serif; font-size: clamp(2rem, 5vw, 4.2rem); letter-spacing: .02em; line-height: .95; }
      .run-chip { border: 1px solid #28617d; padding: .6rem .8rem; color: #8baec4; font-size: .68rem; white-space: nowrap; }
      .signal-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 1rem; margin: 1.5rem 0; }
      [data-testid="risk-summary"], [data-testid="system-status"] { border: 1px solid #1b405b; background: linear-gradient(135deg, #0d263a, #0a1a2a); padding: 1.15rem; }
      .metric-label { color: #7594ab; font-size: .66rem; letter-spacing: .12em; text-transform: uppercase; }
      .metric-value { display: flex; align-items: center; gap: .75rem; margin-top: .7rem; color: #fff; font-family: "Rajdhani", sans-serif; font-size: 1.8rem; }
      [data-testid="status-badge"] { display: inline-block; padding: .25rem .5rem; border: 1px solid currentColor; font-family: inherit; font-size: .65rem; letter-spacing: .08em; }
      .status-green { color: #69e0bb; }
      .status-neutral { color: #8baec4; }
      .workspace-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
      section { border: 1px solid #1b405b; background: rgba(9, 26, 42, .82); padding: 1.25rem; }
      section h2 { margin: 0 0 1rem; color: #f4fbff; font-family: "Rajdhani", sans-serif; font-size: 1.15rem; letter-spacing: .08em; text-transform: uppercase; }
      dl { display: grid; grid-template-columns: minmax(7rem, .7fr) 1.3fr; gap: .7rem 1rem; margin: 0; }
      dt { color: #7594ab; font-size: .7rem; letter-spacing: .06em; text-transform: uppercase; }
      dd { margin: 0; overflow-wrap: anywhere; color: #d9e8f5; font-size: .8rem; }
      [data-testid="citations"], [data-testid="audit-events"] { margin: 0; padding-left: 1.1rem; color: #a9c5d8; font-size: .78rem; line-height: 1.7; }
      [data-testid="citations"] li + li, [data-testid="audit-events"] li + li { margin-top: .5rem; }
      [data-testid="action-panel"] { grid-column: 1 / -1; }
      textarea { width: 100%; min-height: 5rem; margin: .4rem 0 1rem; resize: vertical; border: 1px solid #28617d; background: #061321; color: #d9e8f5; padding: .75rem; font: inherit; }
      .action-row { display: flex; flex-wrap: wrap; gap: .35rem; }
      button { border: 1px solid #28617d; margin: 0; padding: .65rem .9rem; background: #102f45; color: #d9f4ff; font: inherit; font-size: .72rem; cursor: pointer; }
      button:hover:not(:disabled), button:focus-visible { border-color: #68d9ff; box-shadow: 0 0 0 .15rem rgba(104, 217, 255, .18); outline: none; }
      button[data-action="confirm"] { border-color: #69e0bb; color: #69e0bb; }
      button:disabled { cursor: not-allowed; opacity: .35; }
      .status-line { margin: 1rem 0 0; color: #8baec4; font-size: .72rem; }
      [data-testid="review-error"] { min-height: 1.2em; color: #ff7e8b; font-size: .72rem; }
      @media (max-width: 760px) { [data-testid="console-shell"] { display: block; } [data-testid="console-sidebar"] { border-right: 0; border-bottom: 1px solid #1b405b; padding: 1rem; } .sidebar-title { margin: 1.2rem 0 .3rem; } .nav-line { margin-top: 1rem; } .topline, .signal-grid, .workspace-grid { display: block; } .run-chip { display: inline-block; margin-top: 1rem; } section, [data-testid="risk-summary"], [data-testid="system-status"] { margin-top: 1rem; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
    </style>
  </head>
  <body data-synthetic="true" data-action-endpoint="${escapeHtml(options.actionEndpoint)}" data-actor-id="${escapeHtml(options.actorId)}">
    <div data-testid="console-shell">
      <aside data-testid="console-sidebar" aria-label="控制台导航">
        <div class="brand">SYNTH / BANK OPS</div>
        <div class="sidebar-title">指挥舱</div>
        <div class="sidebar-copy">合成柜员审查节点<br>实时策略与审计链路</div>
        <div class="nav-line"><span class="nav-dot"></span> REVIEW NODE / ONLINE</div>
      </aside>
      <main data-testid="console-main">
        <div class="topline"><div><div class="eyebrow">Operator Console / Review Protocol</div><h1>柜员审查工作台</h1></div><div class="run-chip">RUN / <span data-testid="run-id">${escapeHtml(review.runId)}</span></div></div>
        <div class="signal-grid">
          <div data-testid="risk-summary"><div class="metric-label">Risk posture</div><div class="metric-value"><span data-testid="risk-level">${escapeHtml(review.riskLevel)}</span><span data-testid="status-badge" class="status-${escapeHtml(review.riskLevel)}">${escapeHtml(review.riskLevel).toUpperCase()}</span></div></div>
          <div data-testid="system-status"><div class="metric-label">System status</div><div class="metric-value"><span class="status-badge status-neutral">READY</span></div><div class="metric-label">Policy / ${escapeHtml(review.policyDecision)} · Verify / ${escapeHtml(review.verificationStatus)}</div></div>
        </div>
        <div class="workspace-grid">
          <section aria-labelledby="context-heading"><h2 id="context-heading">客户上下文</h2><dl><dt>客户</dt><dd data-testid="customer-context">${escapeHtml(review.customerContext)}</dd><dt>运行编号</dt><dd>${escapeHtml(review.runId)}</dd></dl></section>
          <section aria-labelledby="proposal-heading"><h2 id="proposal-heading">建议动作</h2><dl><dt>动作</dt><dd data-testid="suggested-action">${escapeHtml(review.suggestedAction)}</dd><dt>策略决定</dt><dd data-testid="policy-decision">${escapeHtml(review.policyDecision)}</dd><dt>外部验证</dt><dd data-testid="verification-status">${escapeHtml(review.verificationStatus)}</dd></dl></section>
          <section aria-labelledby="citation-heading"><h2 id="citation-heading">制度来源</h2><ul data-testid="citations">${review.citations.map((citation) => `<li><span data-testid="citation-document">${escapeHtml(citation.documentId)}</span> <span data-testid="citation-version">${escapeHtml(citation.version)}</span>: <span data-testid="citation-excerpt">${escapeHtml(citation.excerpt)}</span></li>`).join("")}</ul></section>
          <section aria-labelledby="audit-heading"><h2 id="audit-heading">审计引用</h2><ul data-testid="audit-events">${review.auditEventIds.map((eventId) => `<li>${escapeHtml(eventId)}</li>`).join("")}</ul></section>
          <section data-testid="action-panel" aria-labelledby="action-heading"><h2 id="action-heading">柜员操作</h2><label for="action-note">修改说明</label><textarea id="action-note" data-testid="action-note" rows="3" cols="60"></textarea><div class="action-row"><button data-testid="action-confirm" data-action="confirm"${confirmDisabled}>确认</button><button data-testid="action-modify" data-action="modify"${disabled}>修改后提交</button><button data-testid="action-handoff" data-action="handoff"${disabled}>转人工</button><button data-testid="action-reject" data-action="reject"${disabled}>拒绝</button></div><p class="status-line" data-testid="review-status" data-status="${escapeHtml(review.status)}">状态：${escapeHtml(review.status)}</p><p data-testid="review-executed">executed: false</p><p data-testid="review-error" role="alert"></p></section>
        </div>
      </main>
    </div>
    <script>${renderReviewClientScript()}</script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
