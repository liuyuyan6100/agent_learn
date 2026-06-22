import agentSignalsData from "../data/agent-signals.json";
import tokenUsageData from "../data/token-usage.json";
import { AgentSignalsSummary } from "@/src/components/agent-signals-summary";
import { TokenUsageDashboard } from "@/src/components/token-usage-dashboard";
import { assertAgentSignalsDataset } from "@/src/lib/agent-signals";
import { assertTokenUsageDataset, formatDateLabel, formatTokenCount } from "@/src/lib/token-usage";

export default function Home() {
  const agentSignals = assertAgentSignalsDataset(agentSignalsData);
  const tokenUsage = assertTokenUsageDataset(tokenUsageData);

  return (
    <main className="shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Agent 工程驾驶舱</p>
          <h1>
            <span>用真实数据</span>
            <span>展示持续</span>
            <span>Agent 实践。</span>
          </h1>
          <p className="hero-lede">
            这个仪表盘把本地 Agent 使用遥测转成可公开访问、隐私安全的证据：
            token 使用趋势、模型构成、工作流记录和下一步自动化闭环。
          </p>
        </div>
        <div className="hero-total-card" aria-label="从第一天到现在的总 token 消耗">
          <p className="eyebrow">从第一天到现在</p>
          <strong>{formatTokenCount(tokenUsage.totals.totalTokens)}</strong>
          <div className="hero-total-meta">
            <span>{formatDateLabel(tokenUsage.period.start)} 至今</span>
            <span>{formatTokenCount(tokenUsage.totals.directTokens)} 直接 token</span>
            <span>{tokenUsage.totals.messageCount} 条 Agent 消息</span>
            <span>{tokenUsage.totals.activeDays} 个活跃日</span>
          </div>
        </div>
      </section>

      <section className="proof-grid" aria-label="Agent 工程证据">
        <article>
          <span>01</span>
          <h2>工具遥测</h2>
          <p>token 使用记录来自本地 CLI，经过归一化后生成稳定的公开 JSON 数据契约。</p>
        </article>
        <article>
          <span>02</span>
          <h2>隐私边界</h2>
          <p>模型名称按设计公开；账号、本机路径、prompt、会话路径和内部项目名会被拒绝进入公开数据。</p>
        </article>
        <article>
          <span>03</span>
          <h2>学习闭环</h2>
          <p>后续可以把使用峰值关联到文章、实验记录和 Agent 方向日报，形成持续复盘链路。</p>
        </article>
      </section>

      <AgentSignalsSummary dataset={agentSignals} />

      <TokenUsageDashboard dataset={tokenUsage} />
    </main>
  );
}
