import { TokenRefreshButton } from "@/src/components/token-refresh-button";
import { TokenTrendChart } from "@/src/components/token-trend-chart";
import {
  formatDateLabel,
  formatGeneratedAt,
  formatTokenCount,
  isDatasetStale,
  isSyntheticModelName,
  sortDaily,
  type TokenUsageDataset,
  type TokenUsageModel
} from "@/src/lib/token-usage";

const MODEL_PREVIEW_LIMIT = 5;

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
        <div className="dashboard-actions">
          <TokenRefreshButton generatedAt={dataset.generatedAt} />
          <div className={stale ? "freshness stale" : "freshness"}>
            <span>{stale ? "数据可能已过期" : "数据已更新"}</span>
            <strong>{formatGeneratedAt(dataset.generatedAt)} 北京时间</strong>
          </div>
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

function TokenModelBreakdown({ models, totalTokens }: { models: TokenUsageModel[]; totalTokens: number }) {
  const visibleModels = models
    .filter((model) => model.totalTokens > 0 && !isSyntheticModelName(model.modelName))
    .sort((a, b) => b.totalTokens - a.totalTokens || a.modelName.localeCompare(b.modelName));
  const previewModels = visibleModels.slice(0, MODEL_PREVIEW_LIMIT);
  const remainingModels = visibleModels.slice(MODEL_PREVIEW_LIMIT);

  function renderModelRow(model: TokenUsageModel, index: number) {
    const percent = totalTokens === 0 ? 0 : Math.round((model.totalTokens / totalTokens) * 100);
    const modelKey = `${model.modelProvider}:${model.modelCategory ?? "unknown"}:${model.modelName}:${index}`;

    return (
      <div className="model-row" key={modelKey}>
        <div className="model-row-heading">
          <span className="model-row-main">
            <strong>{model.modelName}</strong>
            <span className="model-bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </span>
          </span>
          <span className="model-percent">{percent}%</span>
        </div>
        <div className="model-meta">
          <span>{model.modelProvider}</span>
          <span>{model.modelCategory ?? "unknown"}</span>
          <span>{model.messageCount} 条消息</span>
        </div>
        <p>{formatTokenCount(model.totalTokens)} 总量 / {formatTokenCount(model.directTokens)} 直接 token</p>
      </div>
    );
  }

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
        {previewModels.map(renderModelRow)}
        {remainingModels.length > 0 ? (
          <details className="model-more">
            <summary className="model-more-summary">
              <span>展开全部模型</span>
              <span>{remainingModels.length} 个更多</span>
            </summary>
            <div className="model-list model-list-expanded">
              {remainingModels.map((model, index) => renderModelRow(model, index + MODEL_PREVIEW_LIMIT))}
            </div>
          </details>
        ) : null}
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
