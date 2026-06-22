import Link from "next/link";
import {
  filterSignals,
  formatAgentSignalsGeneratedAt,
  formatSignalDate,
  getSignalFilters,
  isAgentSignalsDatasetStale,
  SOURCE_TYPE_LABELS,
  STATUS_LABELS,
  type AgentSignal,
  type AgentSignalsDataset
} from "@/src/lib/agent-signals";

interface AgentSignalsListProps {
  dataset: AgentSignalsDataset;
  sourceType?: string;
  capabilityTag?: string;
}

export function AgentSignalsList({ dataset, sourceType, capabilityTag }: AgentSignalsListProps) {
  const filters = getSignalFilters(dataset.signals);
  const visibleSignals = filterSignals(dataset.signals, { sourceType, capabilityTag });
  const stale = isAgentSignalsDatasetStale(dataset.generatedAt);

  function filterHref(next: { sourceType?: string | null; capabilityTag?: string | null }): string {
    const params = new URLSearchParams();
    const nextSourceType = next.sourceType === undefined ? sourceType : next.sourceType;
    const nextCapabilityTag = next.capabilityTag === undefined ? capabilityTag : next.capabilityTag;

    if (nextSourceType) {
      params.set("source", nextSourceType);
    }
    if (nextCapabilityTag) {
      params.set("tag", nextCapabilityTag);
    }

    const query = params.toString();
    return query ? `/signals?${query}` : "/signals";
  }

  return (
    <section className="signals-panel" aria-labelledby="signals-list-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Signal Log</p>
          <h2 id="signals-list-title">公开 Agent 信号列表</h2>
        </div>
        <div className={stale ? "freshness stale" : "freshness"}>
          <span>{stale ? "数据可能已过期" : "数据已更新"}</span>
          <strong>{formatAgentSignalsGeneratedAt(dataset.generatedAt)} 北京时间</strong>
        </div>
      </div>

      <div className="filter-panel" aria-label="Agent 信号筛选">
        <div className="filter-group">
          <span>来源</span>
          <div className="filter-row">
            <Link className={!sourceType ? "filter-pill is-active" : "filter-pill"} href={filterHref({ sourceType: null })}>
              全部
            </Link>
            {filters.sourceTypes.map((type) => (
              <Link
                className={sourceType === type ? "filter-pill is-active" : "filter-pill"}
                href={filterHref({ sourceType: type })}
                key={type}
              >
                {SOURCE_TYPE_LABELS[type]}
              </Link>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span>能力标签</span>
          <div className="filter-row">
            <Link
              className={!capabilityTag ? "filter-pill is-active" : "filter-pill"}
              href={filterHref({ capabilityTag: null })}
            >
              全部
            </Link>
            {filters.capabilityTags.map((tag) => (
              <Link
                className={capabilityTag === tag ? "filter-pill is-active" : "filter-pill"}
                href={filterHref({ capabilityTag: tag })}
                key={tag}
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {visibleSignals.length > 0 ? (
        <div className="signals-list" aria-label="Agent 信号记录">
          {visibleSignals.map((signal) => (
            <SignalListCard signal={signal} key={signal.id} />
          ))}
        </div>
      ) : (
        <div className="signals-empty-state">
          <h3>没有匹配的信号</h3>
          <p>当前筛选条件下没有记录。可以清空来源或能力标签后继续浏览。</p>
          <Link className="text-link" href="/signals">
            清空筛选
          </Link>
        </div>
      )}
    </section>
  );
}

function SignalListCard({ signal }: { signal: AgentSignal }) {
  return (
    <article className="signal-card signal-card-large">
      <div className="signal-card-header">
        <div>
          <div className="signal-meta">
            <span>{formatSignalDate(signal.date)}</span>
            <span>{SOURCE_TYPE_LABELS[signal.sourceType]}</span>
            <span>{STATUS_LABELS[signal.status]}</span>
          </div>
          <h3>{signal.title}</h3>
        </div>
        {signal.url ? (
          <a className="text-link" href={signal.url} rel="noreferrer" target="_blank">
            打开来源
          </a>
        ) : (
          <span className="source-note">{signal.sourceName}</span>
        )}
      </div>

      <p>{signal.summary}</p>

      <div className="tag-list" aria-label={`${signal.title} 能力标签`}>
        {signal.capabilityTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <div className="signal-detail-grid">
        <div>
          <span>能力要求</span>
          <ul>
            {signal.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>
        <div>
          <span>当前差距</span>
          <p>{signal.currentGap}</p>
        </div>
        <div>
          <span>后续行动</span>
          <p>{signal.nextAction}</p>
        </div>
      </div>
    </article>
  );
}
