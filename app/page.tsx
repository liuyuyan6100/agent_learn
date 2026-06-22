import Link from "next/link";
import agentSignalsData from "../data/agent-signals.json";
import tokenUsageData from "../data/token-usage.json";
import { assertAgentSignalsDataset, formatAgentSignalsGeneratedAt, getRecentSignals } from "@/src/lib/agent-signals";
import { assertTokenUsageDataset, formatGeneratedAt, formatTokenCount } from "@/src/lib/token-usage";

export default function Home() {
  const agentSignals = assertAgentSignalsDataset(agentSignalsData);
  const tokenUsage = assertTokenUsageDataset(tokenUsageData);
  const recentSignal = getRecentSignals(agentSignals, 1)[0];

  return (
    <main className="shell">
      <section className="hero-panel hero-panel-compact">
        <div className="hero-copy">
          <p className="eyebrow">Agent 工程驾驶舱</p>
          <h1>
            <span>模块化展示</span>
            <span>Agent 实践。</span>
          </h1>
          <p className="hero-lede">
            首页只保留模块入口和关键概览；完整数据、列表和交互都进入独立页面，后续新增模块只需要增加一张入口卡。
          </p>
        </div>
        <div className="hero-total-card overview-card" aria-label="当前公开模块概览">
          <p className="eyebrow">当前模块</p>
          <strong>2</strong>
          <div className="hero-total-meta">
            <span>Token Usage 已上线</span>
            <span>Agent Signals 已上线</span>
            <span>{formatTokenCount(tokenUsage.totals.totalTokens)} 累计 token</span>
            <span>{agentSignals.signals.length} 条公开信号</span>
          </div>
        </div>
      </section>

      <section className="module-panel" aria-labelledby="module-panel-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Modules</p>
            <h2 id="module-panel-title">功能模块</h2>
          </div>
        </div>

        <div className="module-grid">
          <Link className="module-card" href="/usage">
            <div className="module-card-topline">
              <span>01</span>
              <span>Token Usage</span>
            </div>
            <h3>Token 使用看板</h3>
            <p>查看公开 token 总量、最近窗口、每日趋势、模型构成和数据刷新状态。</p>
            <div className="module-metrics" aria-label="Token 使用摘要">
              <span>{formatTokenCount(tokenUsage.totals.totalTokens)} 总 token</span>
              <span>{formatTokenCount(tokenUsage.windows.last30Days.totalTokens)} 近 30 天</span>
              <span>{formatGeneratedAt(tokenUsage.generatedAt)} 北京时间</span>
            </div>
            <strong>进入看板</strong>
          </Link>

          <Link className="module-card" href="/signals">
            <div className="module-card-topline">
              <span>02</span>
              <span>Agent Signals</span>
            </div>
            <h3>Agent 开发日报</h3>
            <p>浏览公开来源中的工程趋势、招聘要求、能力标签、当前差距和后续行动。</p>
            <div className="module-metrics" aria-label="Agent Signals 摘要">
              <span>{agentSignals.signals.length} 条公开信号</span>
              <span>{recentSignal ? `最近：${recentSignal.title}` : "等待第一条信号"}</span>
              <span>{formatAgentSignalsGeneratedAt(agentSignals.generatedAt)} 北京时间</span>
            </div>
            <strong>进入列表</strong>
          </Link>
        </div>
      </section>
    </main>
  );
}
