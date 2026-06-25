import Link from "next/link";
import {
  filterSignals,
  formatAgentSignalsGeneratedAt,
  formatSignalDate,
  getSignalFilters,
  isAgentSignalsDatasetStale,
  paginateSignals,
  SOURCE_TYPE_LABELS,
  STATUS_LABELS,
  type AgentSignal,
  type AgentSignalsDataset
} from "@/src/lib/agent-signals";

interface AgentSignalsListProps {
  dataset: AgentSignalsDataset;
  sourceType?: string;
  capabilityTag?: string;
  page?: number;
}

export function AgentSignalsList({ dataset, sourceType, capabilityTag, page }: AgentSignalsListProps) {
  const filters = getSignalFilters(dataset.signals);
  const visibleSignals = filterSignals(dataset.signals, { sourceType, capabilityTag });
  const pagination = paginateSignals(visibleSignals, page);
  const stale = isAgentSignalsDatasetStale(dataset.generatedAt);
  const articleCount = dataset.signals.filter((signal) => signal.sourceType === "article").length;
  const activeCount = dataset.signals.filter((signal) => signal.status === "planned" || signal.status === "in_progress").length;
  const collectionPolicy = dataset.source.collectionPolicy;

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

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams();

    if (sourceType) {
      params.set("source", sourceType);
    }
    if (capabilityTag) {
      params.set("tag", capabilityTag);
    }
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const query = params.toString();
    return query ? `/signals?${query}` : "/signals";
  }

  return (
    <section className="signals-panel" aria-labelledby="signals-list-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Signal Log</p>
          <h2 id="signals-list-title">侦察信号面板</h2>
        </div>
        <div className={stale ? "freshness stale" : "freshness"}>
          <span>{stale ? "数据可能已过期" : "数据已更新"}</span>
          <strong>{formatAgentSignalsGeneratedAt(dataset.generatedAt)} 北京时间</strong>
        </div>
      </div>

      <div className="signals-summary-grid" aria-label="Agent 信号概览">
        <article className="signal-summary-card">
          <span>当前记录</span>
          <strong>{dataset.signals.length}</strong>
          <p>已进入公开看板的侦察条目总数。</p>
        </article>
        <article className="signal-summary-card">
          <span>文章来源</span>
          <strong>{articleCount}</strong>
          <p>需要继续加强自动搜索和中文提炼能力的主战场。</p>
        </article>
        <article className="signal-summary-card">
          <span>活跃跟进</span>
          <strong>{activeCount}</strong>
          <p>已经进入持续追踪或动作拆解的信号数量。</p>
        </article>
        <article className="signal-summary-card">
          <span>文章权重</span>
          <strong>
            {collectionPolicy.articleSearchWeights.overseasFamousAgentCommunities}/
            {collectionPolicy.articleSearchWeights.chinaAgentCommunities}
          </strong>
          <p>优先搜索国外著名 Agent 论坛社区，同时保留中文社区信号。</p>
        </article>
        <article className="signal-summary-card">
          <span>招聘权重</span>
          <strong>
            {collectionPolicy.jobSearchWeights.overseasJobs}/{collectionPolicy.jobSearchWeights.chinaJobs}
          </strong>
          <p>国内岗位优先覆盖 {collectionPolicy.requiredChinaJobBoards.join("、")}。</p>
        </article>
        <article className="signal-summary-card">
          <span>飞书候选</span>
          <strong>{collectionPolicy.dailyLarkDigest.enabled ? "每日" : "关闭"}</strong>
          <p>只提取聊天里的 Agent 主题、公开链接和候选摘要，不公开原始聊天。</p>
        </article>
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
        <>
          <div className="signals-page-summary" aria-live="polite">
            <span>
              显示第 {pagination.startIndex + 1}-{pagination.endIndex} 条，共 {pagination.totalItems} 条
            </span>
            <strong>
              第 {pagination.currentPage} / {pagination.totalPages} 页
            </strong>
          </div>

          <div className="signals-list" aria-label="Agent 信号记录">
            {pagination.items.map((signal) => (
              <SignalListCard signal={signal} key={signal.id} />
            ))}
          </div>

          {pagination.totalPages > 1 ? (
            <nav className="signals-pagination" aria-label="Agent 信号分页">
              <Link
                aria-disabled={pagination.currentPage === 1}
                className={pagination.currentPage === 1 ? "pagination-link is-disabled" : "pagination-link"}
                href={pageHref(Math.max(1, pagination.currentPage - 1))}
              >
                上一页
              </Link>
              <div className="pagination-pages">
                {Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <Link
                    aria-current={pagination.currentPage === pageNumber ? "page" : undefined}
                    className={pagination.currentPage === pageNumber ? "pagination-page is-active" : "pagination-page"}
                    href={pageHref(pageNumber)}
                    key={pageNumber}
                  >
                    {pageNumber}
                  </Link>
                ))}
              </div>
              <Link
                aria-disabled={pagination.currentPage === pagination.totalPages}
                className={
                  pagination.currentPage === pagination.totalPages ? "pagination-link is-disabled" : "pagination-link"
                }
                href={pageHref(Math.min(pagination.totalPages, pagination.currentPage + 1))}
              >
                下一页
              </Link>
            </nav>
          ) : null}
        </>
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
          <div className="signal-source-line">
            <span>{signal.sourceName}</span>
            <span>{signal.url ? "公开来源" : "人工提炼"}</span>
          </div>
        </div>
        {signal.url ? (
          <a className="text-link" href={signal.url} rel="noreferrer" target="_blank">
            打开来源
          </a>
        ) : (
          <span className="source-note">{signal.sourceName}</span>
        )}
      </div>

      <div className="signal-intel-stack">
        <section className="signal-intel-card">
          <span>侦察摘要</span>
          <p>{signal.summary}</p>
        </section>
        <section className="signal-intel-card signal-intel-card-accent">
          <span>侦察判断</span>
          <p>{signal.intelValue}</p>
        </section>
      </div>

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
