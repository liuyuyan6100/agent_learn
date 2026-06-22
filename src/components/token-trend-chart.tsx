"use client";

import { useMemo, useState } from "react";
import {
  formatDateLabel,
  formatTokenCount,
  isSyntheticModelName,
  type TokenUsageDay,
  type TokenUsageModel
} from "@/src/lib/token-usage";

export function TokenTrendChart({ daily }: { daily: TokenUsageDay[] }) {
  const [selectedDate, setSelectedDate] = useState(() => daily[daily.length - 1]?.date ?? "");
  const selectedDay = useMemo(
    () => daily.find((day) => day.date === selectedDate) ?? daily[daily.length - 1],
    [daily, selectedDate]
  );
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
          const isSelected = selectedDay?.date === day.date;
          return (
            <g
              className={isSelected ? "chart-day is-selected" : "chart-day"}
              key={day.date}
              role="button"
              tabIndex={0}
              aria-label={`${formatDateLabel(day.date)}，${formatTokenCount(day.totalTokens)} 总 token，${formatTokenCount(day.directTokens)} 直接 token`}
              aria-pressed={isSelected}
              onClick={() => setSelectedDate(day.date)}
              onFocus={() => setSelectedDate(day.date)}
              onMouseEnter={() => setSelectedDate(day.date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedDate(day.date);
                }
              }}
            >
              <rect className="chart-hit-area" x={slotWidth * index} y="0" width={slotWidth} height={height} rx="12" />
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
      {selectedDay ? <TokenDayDetail day={selectedDay} /> : null}
    </article>
  );
}

function TokenDayDetail({ day }: { day: TokenUsageDay }) {
  const modelBreakdown = aggregateDailyModels(day);
  const topModel = modelBreakdown[0];

  return (
    <div className="day-detail" aria-live="polite">
      <div className="day-detail-heading">
        <div>
          <span>已选日期</span>
          <strong>{formatDateLabel(day.date)}</strong>
        </div>
        <p>{topModel ? `当天主力模型：${topModel.modelName}` : "当天没有公开模型拆分"}</p>
      </div>

      <div className="day-token-grid" aria-label={`${formatDateLabel(day.date)} token 梳理`}>
        <div>
          <span>总 token</span>
          <strong>{formatTokenCount(day.totalTokens)}</strong>
        </div>
        <div>
          <span>直接 token</span>
          <strong>{formatTokenCount(day.directTokens)}</strong>
        </div>
        <div>
          <span>缓存 token</span>
          <strong>{formatTokenCount(day.cacheTokens)}</strong>
        </div>
        <div>
          <span>消息数</span>
          <strong>{day.messageCount}</strong>
        </div>
      </div>

      <div className="day-token-split">
        <span>输入 {formatTokenCount(day.inputTokens)}</span>
        <span>输出 {formatTokenCount(day.outputTokens)}</span>
        <span>缓存读 {formatTokenCount(day.cacheReadTokens)}</span>
        <span>缓存写 {formatTokenCount(day.cacheWriteTokens)}</span>
        <span>推理 {formatTokenCount(day.reasoningTokens)}</span>
      </div>

      <div className="day-model-list" aria-label={`${formatDateLabel(day.date)} 使用模型`}>
        {modelBreakdown.length > 0 ? (
          modelBreakdown.map((model) => {
            const percent = day.totalTokens === 0 ? 0 : Math.round((model.totalTokens / day.totalTokens) * 100);

            return (
              <div className="day-model-row" key={model.modelName}>
                <div className="day-model-heading">
                  <strong>{model.modelName}</strong>
                  <span>{percent}%</span>
                </div>
                <div className="model-bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <p>
                  {formatTokenCount(model.totalTokens)} 总量 / {formatTokenCount(model.directTokens)} 直接 token /{" "}
                  {model.messageCount} 条消息
                </p>
              </div>
            );
          })
        ) : (
          <p className="day-model-empty">当天没有可公开展示的模型记录。</p>
        )}
      </div>
    </div>
  );
}

function aggregateDailyModels(day: TokenUsageDay): TokenUsageModel[] {
  const models = new Map<string, TokenUsageModel>();

  day.breakdown
    .filter((item) => item.totalTokens > 0 && !isSyntheticModelName(item.modelName))
    .forEach((item) => {
      const current = models.get(item.modelName);
      if (current) {
        current.totalTokens += item.totalTokens;
        current.directTokens += item.directTokens;
        current.messageCount += item.messageCount;
        return;
      }

      models.set(item.modelName, {
        modelName: item.modelName,
        modelProvider: item.modelProvider,
        modelCategory: item.modelCategory,
        totalTokens: item.totalTokens,
        directTokens: item.directTokens,
        messageCount: item.messageCount
      });
    });

  return [...models.values()].sort((a, b) => b.totalTokens - a.totalTokens || a.modelName.localeCompare(b.modelName));
}
