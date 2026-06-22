import type { Metadata } from "next";
import Link from "next/link";
import agentSignalsData from "../../data/agent-signals.json";
import { AgentSignalsList } from "@/src/components/agent-signals-list";
import { assertAgentSignalsDataset } from "@/src/lib/agent-signals";

export const metadata: Metadata = {
  title: "Agent Signals | Agent 工程仪表盘",
  description: "Agent 工程方向的招聘、文章、开源、产品和人工复盘信号。"
};

interface SignalsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignalsPage({ searchParams }: SignalsPageProps) {
  const params = searchParams ? await searchParams : {};
  const dataset = assertAgentSignalsDataset(agentSignalsData);
  const sourceType = firstParam(params.source);
  const capabilityTag = firstParam(params.tag);

  return (
    <main className="shell">
      <section className="subpage-hero" aria-labelledby="signals-page-title">
        <div>
          <Link className="text-link" href="/">
            返回首页
          </Link>
          <p className="eyebrow">Agent Signals</p>
          <h1 id="signals-page-title">
            <span>把外部信号</span>
            <span>转成工程行动。</span>
          </h1>
          <p className="hero-lede">
            这里记录公开来源中的 Agent 工程趋势、招聘要求、开源实践和人工复盘，
            每条记录都只保留脱敏摘要、能力要求和下一步行动。
          </p>
        </div>
        <div className="subpage-stat-card" aria-label="Agent 信号数据概览">
          <p className="eyebrow">公开记录</p>
          <strong>{dataset.signals.length}</strong>
          <span>{dataset.period.start} 至 {dataset.period.end}</span>
        </div>
      </section>

      <AgentSignalsList dataset={dataset} sourceType={sourceType} capabilityTag={capabilityTag} />
    </main>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
