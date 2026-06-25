import type { Metadata } from "next";
import Link from "next/link";
import { TokenUsageDashboard } from "@/src/components/token-usage-dashboard";
import { readTokenUsageDataset } from "@/src/lib/token-usage-data";
import { formatDateLabel, formatTokenCount } from "@/src/lib/token-usage";

export const metadata: Metadata = {
  title: "Token Usage | Agent 工程仪表盘",
  description: "公开的 Agent token 使用趋势、模型构成和刷新状态。"
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsagePage() {
  const dataset = await readTokenUsageDataset();

  return (
    <main className="shell">
      <section className="subpage-hero" aria-labelledby="usage-page-title">
        <div>
          <Link className="text-link" href="/">
            返回首页
          </Link>
          <p className="eyebrow">Token Usage</p>
          <h1 id="usage-page-title">
            <span>用 token 遥测</span>
            <span>证明真实实践。</span>
          </h1>
          <p className="hero-lede">
            这里展示从本地 `tokscale` 采集并脱敏后的公开数据：总量、窗口统计、每日趋势和模型构成。
          </p>
        </div>
        <div className="subpage-stat-card" aria-label="Token 使用数据概览">
          <p className="eyebrow">累计 token</p>
          <strong>{formatTokenCount(dataset.totals.totalTokens)}</strong>
          <span>{formatDateLabel(dataset.period.start)} 至今</span>
        </div>
      </section>

      <TokenUsageDashboard dataset={dataset} />
    </main>
  );
}
