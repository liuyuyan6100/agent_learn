import {
  formatDateLabel,
  formatGeneratedAt,
  formatTokenCount,
  isDatasetStale,
  isSyntheticModelName,
  sortDaily,
  type TokenUsageDataset,
  type TokenUsageDay,
  type TokenUsageModel
} from "@/src/lib/token-usage";

interface TokenUsageDashboardProps {
  dataset: TokenUsageDataset;
}

export function TokenUsageDashboard({ dataset }: TokenUsageDashboardProps) {
  const daily = sortDaily(dataset.daily);
  const chartDaily = daily.slice(-30);
  const stale = isDatasetStale(dataset.generatedAt);

  if (daily.length === 0) {
    return <TokenEmptyState dataset={dataset} />;
  }

  return (
    <section className="dashboard-panel" aria-labelledby="token-dashboard-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Token 使用看板</p>
          <h2 id="token-dashboard-title">Agent token 消耗总览</h2>
        </div>
        <div className={stale ? "freshness stale" : "freshness"}>
          <span>{stale ? "数据可能已过期" : "数据已更新"}</span>
          <strong>{formatGeneratedAt(dataset.generatedAt)} UTC</strong>
        </div>
      </div>

      <TokenMetricCards dataset={dataset} />

      <div className="dashboard-grid">
        <TokenTrendChart daily={chartDaily} />
        <TokenModelBreakdown models={dataset.models} totalTokens={dataset.totals.totalTokens} />
      </div>
    </section>
  );
}

function TokenMetricCards({ dataset }: TokenUsageDashboardProps) {
  const cards = [
    {
      label: "总 token",
      value: dataset.totals.totalTokens,
      detail: `从 ${formatDateLabel(dataset.period.start)} 到现在`
    },
    {
      label: "今日",
      value: dataset.windows.today.totalTokens,
      detail: `${formatTokenCount(dataset.windows.today.directTokens)} 直接 token`
    },
    {
      label: "近 7 天",
      value: dataset.windows.last7Days.totalTokens,
      detail: `${dataset.windows.last7Days.activeDays ?? 0} 个活跃日`
    },
    {
      label: "近 30 天",
      value: dataset.windows.last30Days.totalTokens,
      detail: `${formatTokenCount(dataset.windows.last30Days.directTokens)} 直接 token`
    }
  ];

  return (
    <div className="metric-grid" aria-label="Token 使用指标">
      {cards.map((card) => (
        <article className="metric-card" key={card.label}>
          <p>{card.label}</p>
          <strong>{formatTokenCount(card.value)}</strong>
          <span>{card.detail}</span>
        </article>
      ))}
    </div>
  );
}

function TokenTrendChart({ daily }: { daily: TokenUsageDay[] }) {
  const maxTotal = Math.max(...daily.map((day) => day.totalTokens), 1);
  const width = 920;
  const height = 260;
  const plotTop = 20;
  const plotBottom = 220;
  const slotWidth = width / daily.length;
  const barWidth = Math.min(48, slotWidth * 0.58);
  const directLine = daily
    .map((day, index) => {
      const x = slotWidth * index + slotWidth / 2;
      const y = plotBottom - (day.directTokens / maxTotal) * (plotBottom - plotTop);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <article className="chart-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">每日趋势</p>
          <h3>最近 30 个活跃日</h3>
        </div>
        <span>{daily.length} 个日样本</span>
      </div>
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日 token 趋势图">
        <defs>
          <linearGradient id="tokenBar" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5fffb1" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#1f8f68" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="directLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#f6c85f" />
            <stop offset="100%" stopColor="#ff7f50" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((tick) => {
          const y = plotBottom - tick * (plotBottom - plotTop);
          return <line className="chart-grid-line" x1="0" x2={width} y1={y} y2={y} key={tick} />;
        })}
        {daily.map((day, index) => {
          const x = slotWidth * index + slotWidth / 2 - barWidth / 2;
          const totalHeight = (day.totalTokens / maxTotal) * (plotBottom - plotTop);
          const directHeight = (day.directTokens / maxTotal) * (plotBottom - plotTop);
          return (
            <g key={day.date}>
              <rect
                className="token-bar"
                x={x}
                y={plotBottom - totalHeight}
                width={barWidth}
                height={totalHeight}
                rx="10"
              />
              <rect
                className="direct-bar"
                x={x + barWidth * 0.24}
                y={plotBottom - directHeight}
                width={barWidth * 0.52}
                height={directHeight}
                rx="8"
              />
              <text className="chart-label" x={x + barWidth / 2} y={height - 14} textAnchor="middle">
                {formatDateLabel(day.date)}
              </text>
            </g>
          );
        })}
        <polyline className="direct-polyline" points={directLine} />
      </svg>
      <div className="legend-row">
        <span>
          <i className="legend-total" /> 总 token
        </span>
        <span>
          <i className="legend-direct" /> 直接 token
        </span>
      </div>
    </article>
  );
}

function TokenModelBreakdown({ models, totalTokens }: { models: TokenUsageModel[]; totalTokens: number }) {
  const visibleModels = models.filter((model) => model.totalTokens > 0 && !isSyntheticModelName(model.modelName));

  return (
    <article className="model-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">模型构成</p>
          <h3>公开模型构成</h3>
        </div>
        <span>{visibleModels.length} 个模型</span>
      </div>
      <div className="model-list">
        {visibleModels.map((model) => {
          const percent = totalTokens === 0 ? 0 : Math.round((model.totalTokens / totalTokens) * 100);
          return (
            <div className="model-row" key={model.modelName}>
              <div className="model-row-top">
                <strong>{model.modelName}</strong>
                <span>{percent}%</span>
              </div>
              <div className="model-meta">
                <span>{model.modelProvider}</span>
                <span>{model.modelCategory ?? "unknown"}</span>
                <span>{model.messageCount} 条消息</span>
              </div>
              <div className="model-bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
              <p>{formatTokenCount(model.totalTokens)} 总量 / {formatTokenCount(model.directTokens)} 直接 token</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function TokenEmptyState({}: TokenUsageDashboardProps) {
  return (
    <section className="dashboard-panel empty-panel" aria-labelledby="token-dashboard-title">
      <p className="eyebrow">Token 使用看板</p>
      <h2 id="token-dashboard-title">暂时没有公开 token 样本</h2>
      <p>
        看板已经准备好读取 `data/token-usage.json`。采集脚本写入日维度数据后，
        这里会展示指标卡、趋势图和公开模型名称。
      </p>
    </section>
  );
}
