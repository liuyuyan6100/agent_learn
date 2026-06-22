"use client";

import { useState } from "react";

type RefreshStatus = "idle" | "starting" | "started" | "blocked" | "error";

export function TokenRefreshButton() {
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const [message, setMessage] = useState("");
  const busy = status === "starting" || status === "started";

  async function requestRefresh() {
    setStatus("starting");
    setMessage("正在启动刷新...");

    try {
      const response = await fetch("/api/token-refresh", {
        body: "{}",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as { retryAfterSeconds?: number };

      if (response.status === 202) {
        setStatus("started");
        setMessage("刷新已启动，构建完成后页面会更新。");
        window.setTimeout(() => window.location.reload(), 90000);
        return;
      }

      if (response.status === 409) {
        setStatus("blocked");
        setMessage("刷新正在运行。");
        return;
      }

      if (response.status === 429) {
        setStatus("blocked");
        setMessage(`刚刚刷新过，约 ${formatRetryAfter(payload.retryAfterSeconds)} 后可重试。`);
        return;
      }

      setStatus("error");
      setMessage("刷新启动失败。");
    } catch {
      setStatus("error");
      setMessage("刷新请求失败。");
    }
  }

  return (
    <div className="refresh-control">
      <button className="refresh-button" disabled={busy} onClick={requestRefresh} type="button">
        <span aria-hidden="true">↻</span>
        <span>{busy ? "刷新中" : "刷新数据"}</span>
      </button>
      {message ? (
        <span className={`refresh-message ${status}`} role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}

function formatRetryAfter(value: number | undefined): string {
  if (!value || value < 60) {
    return "1 分钟";
  }
  return `${Math.ceil(value / 60)} 分钟`;
}
