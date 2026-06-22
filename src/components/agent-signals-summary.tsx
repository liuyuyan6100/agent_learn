import Link from "next/link";
import {
  formatAgentSignalsGeneratedAt,
  formatSignalDate,
  getRecentSignals,
  isAgentSignalsDatasetStale,
  SOURCE_TYPE_LABELS,
  STATUS_LABELS,
  type AgentSignalsDataset
} from "@/src/lib/agent-signals";

interface AgentSignalsSummaryProps {
  dataset: AgentSignalsDataset;
}

export function AgentSignalsSummary({ dataset }: AgentSignalsSummaryProps) {
  const recentSignals = getRecentSignals(dataset, 3);
  const stale = isAgentSignalsDatasetStale(dataset.generatedAt);

  if (recentSignals.length === 0) {
    return (
      <section className="signals-panel empty-panel" aria-labelledby="agent-signals-title">
        <p className="eyebrow">Agent Signals</p>
        <h2 id="agent-signals-title">等待第一批公开学习信号</h2>
        <p>模块已经准备好读取 `data/agent-signals.json`。添加记录后，这里会展示最近的 Agent 工程观察。</p>
      </section>
    );
  }

  return (
    <section className="signals-panel" aria-labelledby="agent-signals-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Agent Signals</p>
          <h2 id="agent-signals-title">最近 Agent 工程信号</h2>
        </div>
        <div className="signals-heading-actions">
          <Link className="text-link" href="/signals">
            查看全部
          </Link>
          <div className={stale ? "freshness stale" : "freshness"}>
            <span>{stale ? "信号可能已过期" : "信号已更新"}</span>
            <strong>{formatAgentSignalsGeneratedAt(dataset.generatedAt)} 北京时间</strong>
          </div>
        </div>
      </div>

      <div className="signals-summary-grid" aria-label="最近 Agent 信号">
        {recentSignals.map((signal) => (
          <article className="signal-card" key={signal.id}>
            <div className="signal-meta">
              <span>{formatSignalDate(signal.date)}</span>
              <span>{SOURCE_TYPE_LABELS[signal.sourceType]}</span>
              <span>{STATUS_LABELS[signal.status]}</span>
            </div>
            <h3>{signal.title}</h3>
            <p>{signal.summary}</p>
            <div className="tag-list" aria-label={`${signal.title} 能力标签`}>
              {signal.capabilityTags.slice(0, 3).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="signal-action">
              <span>下一步</span>
              <p>{signal.nextAction}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
