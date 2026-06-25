"use client";

import { useMemo, useState } from "react";
import { PLAN_BOARD_SECTIONS, PLAN_STATUSES, getPlanBoardCompletion, getPlanBoardStats, getPlanStatusMeta, type PlanBoardSnapshot, type PlanStatus } from "@/src/lib/plan-board";

interface PlanBoardProps {
  initialBoard: PlanBoardSnapshot;
}

export function PlanBoard({ initialBoard }: PlanBoardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => getPlanBoardStats(board.statuses), [board.statuses]);
  const completion = useMemo(() => getPlanBoardCompletion(board.statuses), [board.statuses]);
  const total = Object.keys(board.statuses).length;
  const doneItems = stats.done;
  const activeLabel = `${doneItems}/${total} 已完成`;
  const activeItems = stats.doing + stats.optimize + stats.blocked;

  async function handleStatusChange(itemId: string, status: PlanStatus) {
    const previous = board;
    const next = {
      ...board,
      updatedAt: new Date().toISOString(),
      statuses: {
        ...board.statuses,
        [itemId]: status
      }
    };

    setBoard(next);
    setSavingItemId(itemId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/plan-board", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "规划状态保存失败。");
      }

      const payload = (await response.json()) as PlanBoardSnapshot;
      setBoard(payload);
      setMessage("状态已保存。");
    } catch (saveError) {
      setBoard(previous);
      setError(saveError instanceof Error ? saveError.message : "规划状态保存失败。");
    } finally {
      setSavingItemId(null);
    }
  }

  return (
    <section className="plan-shell" aria-labelledby="plan-board-title">
      <div className="plan-dashboard-grid">
        <div>
          <div className="plan-heading-block">
            <p className="eyebrow">Planning Board</p>
            <h2 id="plan-board-title">状态优先的规划看板</h2>
            <p className="hero-lede">
              条目只围绕状态展开，左侧看总览，右侧看分区卡片；所有点击都写回服务器端状态文件。
            </p>
          </div>

          <div className="plan-kpi-row" aria-label="规划状态指标">
            <div className="plan-kpi-card">
              <span>完成率</span>
              <strong>{completion}%</strong>
            </div>
            <div className="plan-kpi-card">
              <span>已完成</span>
              <strong>{stats.done}</strong>
            </div>
            <div className="plan-kpi-card">
              <span>活跃项</span>
              <strong>{activeItems}</strong>
            </div>
            <div className="plan-kpi-card">
              <span>总条目</span>
              <strong>{total}</strong>
            </div>
          </div>
        </div>

        <div className="plan-summary-card" aria-label="规划概览">
          <span className="plan-summary-label">{activeLabel}</span>
          <strong>{completion}%</strong>
          <progress value={completion} max={100} />
          <div className="plan-summary-metrics">
            {PLAN_STATUSES.map((status) => {
              const count = stats[status.id];
              return (
                <span key={status.id} className={status.tone}>
                  {status.symbol} {count}
                </span>
              );
            })}
          </div>
          <span className="plan-summary-subline">状态更新时间 {formatUpdatedAt(board.updatedAt)}</span>
        </div>
      </div>

      <div className="plan-status-bar" role="status" aria-live="polite">
        {error ? <span className="workspace-error">{error}</span> : null}
        {!error && message ? <span>{message}</span> : null}
        {!error && !message ? <span>点击状态按钮即可写回服务器端看板状态。</span> : null}
        <span className="plan-meta-inline">
          看板更新时间 {formatUpdatedAt(board.updatedAt)}
        </span>
      </div>

      <div className="plan-legend" aria-label="状态说明">
        {PLAN_STATUSES.map((status) => (
          <span key={status.id} className={`plan-legend-pill ${status.tone}`}>
            <strong>{status.symbol}</strong>
            <em>{status.label}</em>
          </span>
        ))}
      </div>

      <div className="plan-grid">
        {PLAN_BOARD_SECTIONS.map((section) => (
          <section key={section.id} className="plan-section-card" aria-labelledby={`section-${section.id}`}>
            <div className="plan-section-heading">
              <div>
                <p className="eyebrow">{section.id}</p>
                <h3 id={`section-${section.id}`}>{section.title}</h3>
              </div>
              <span>{section.summary}</span>
            </div>

            <div className="plan-item-list">
              {section.items.map((item) => {
                const currentStatus = board.statuses[item.id] ?? item.status;
                const statusMeta = getPlanStatusMeta(currentStatus);
                return (
                  <article key={item.id} className={`plan-item-card ${statusMeta.tone}`}>
                    <div className="plan-item-main">
                      <div className="plan-item-symbol" aria-hidden="true">
                        {statusMeta.symbol}
                      </div>
                      <div className="plan-item-copy">
                        <strong>{item.title}</strong>
                        <p>{item.note}</p>
                      </div>
                    </div>

                    <div className="plan-item-statusbar" role="group" aria-label={`${item.title} 状态切换`}>
                      {PLAN_STATUSES.map((status) => (
                        <button
                          key={status.id}
                          type="button"
                          className={`plan-status-button ${status.tone} ${currentStatus === status.id ? "is-active" : ""}`}
                          onClick={() => void handleStatusChange(item.id, status.id)}
                          disabled={savingItemId === item.id}
                          title={status.label}
                          aria-pressed={currentStatus === status.id}
                        >
                          <span aria-hidden="true">{status.symbol}</span>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai"
  }).format(date);
}
